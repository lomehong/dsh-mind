import { loadMindConfig } from "./config.js";
import { GatewayClient } from "./gateway.js";
import { registerPanelApi } from "./panel-api.js";
import { WakeRunner } from "./runner.js";
import { advanceAfterWake, collectDueMindTriggers, costUsd, dayKey, scheduleNextSpontaneous, } from "./scheduler.js";
import { loadState, saveState } from "./state.js";
import { appendStep, archiveOldSteps, readTail } from "./timeline.js";
import { buildWakePrompt } from "./wake-prompt.js";
export const name = 'dsh-mind';
export const provide = ['dsh-mind'];
const TICK_MS = 1000;
/** 触发源 → 函数菜单结果映射（idle/watchdog 合成唤醒除外）。 */
function outcomeOf(final, toolCalls) {
    if (/^idle\b/i.test(final.trim()))
        return 'empty';
    if (toolCalls > 0)
        return 'engaged';
    return final.trim().length > 60 ? 'engaged' : 'thought';
}
export function apply(ctx) {
    const logger = ctx.logger ?? console;
    logger.info?.('[dsh-mind] 心智运行时已加载（P1 心智本体）');
    let running = false;
    let disposed = false;
    /** reactive 观察队列（P1 无渠道注入源；P2 由适配器喂入）。 */
    const reactiveQueue = [];
    const deps = {
        getConfig: () => loadMindConfig(),
        getState: () => loadState(),
        setStoppedByMaster(stopped) {
            const state = loadState();
            state.stoppedByMaster = stopped;
            if (stopped) {
                state.wakeAt = 0; // 停机即清排程；恢复时由 tick 重新排（错过不补）
            }
            else {
                state.wakeAt = Date.now() + 1000; // 恢复：1s 后开始排程
            }
            saveState(state);
            logger.info?.(`[dsh-mind] kill switch → ${stopped ? '已停' : '已恢复'}`);
        },
        isRunning: () => running,
    };
    // 面板 HTTP 路由（sameOrigin 门禁；LESSONS #11）
    try {
        ctx.inject(['webServer'], (wctx) => {
            const web = wctx.get('webServer');
            if (web !== undefined) {
                registerPanelApi(web, deps);
                logger.info?.('[dsh-mind] 速览路由已注册（/dsh-mind/*）');
            }
        });
    }
    catch (error) {
        logger.warn?.('[dsh-mind] 面板路由注册失败（显式降级）:', error instanceof Error ? error.message : String(error));
    }
    // ------------------------------------------------------------------
    // 唤醒执行（方案 A：typertGateway 临时/复用 digital-twin 预设会话）
    // ------------------------------------------------------------------
    async function runWake(trigger) {
        if (trigger.trigger === 'none')
            throw new Error('唤醒触发为 none（不应到达）');
        const cfg = loadMindConfig();
        const now = new Date();
        let state = loadState();
        state.lastWakeAt = Date.now();
        state.running = true;
        saveState(state);
        const gwLike = ctx.get('typertGateway');
        if (gwLike === undefined)
            throw new Error('typertGateway 缺席（宿主服务不可用）');
        const gw = new GatewayClient(gwLike);
        const runner = new WakeRunner(gw, {
            presetId: cfg.presetId,
            title: '🧠 mind',
            timeoutMs: cfg.wakeTimeoutMs,
            resetThresholdTokens: cfg.sessionResetTokens,
        });
        // 底座会话：懒建复用（state.mindSessionId），超阈值重建
        const ensured = await runner.ensureSession(state.mindSessionId, state.spend.tokensIn);
        state = loadState();
        state.mindSessionId = ensured.sessionId;
        if (ensured.reset) {
            delete state.cursor;
            state.spend.tokensIn = 0;
            state.spend.tokensOut = 0;
        }
        saveState(state);
        // 上下文装配：守卫/人格（dsh-twin 服务面，缺席兜底）+ 时间线尾部 + 记忆召回
        let guard;
        let persona;
        try {
            const twin = ctx.get('dsh-twin');
            const preview = twin?.preview?.();
            guard = typeof preview?.guard === 'string' ? preview.guard : undefined;
            persona = typeof preview?.persona === 'string' ? preview.persona : undefined;
        }
        catch { /* twin 缺席 → 兜底 */ }
        let memories = [];
        try {
            const memory = ctx.get('dsh-memory');
            if (memory?.loadSharedMemory !== undefined) {
                const entries = memory.filterMemoriesForRead !== undefined
                    ? memory.filterMemoriesForRead(memory.loadSharedMemory())
                    : memory.loadSharedMemory();
                memories = entries.slice(-8).map(e => e.content);
            }
        }
        catch { /* 记忆缺席 → 空召回 */ }
        // readTail 返回新→旧；提示词区块按旧→新叙述
        const tail = readTail(20).steps.slice().reverse();
        const prompt = buildWakePrompt({
            identityName: '分身',
            guard,
            persona,
            tail,
            lastFinal: tail.filter(s => s.type === 'wake').at(-1)?.final,
            memories,
            pendingMessages: reactiveQueue.splice(0, reactiveQueue.length).map(q => ({ from: q.from, text: q.text })),
            now,
        });
        const result = await runner.runWake(ensured.sessionId, prompt);
        const outcome = outcomeOf(result.final, result.toolCalls);
        const cost = costUsd(cfg, result.tokensIn, result.tokensOut);
        // 台账推进（按日清零）+ 时间线 + 退避推进 + 下次排程
        state = loadState();
        const today = dayKey(new Date());
        if (state.spend.date !== today)
            state.spend = { date: today, usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 };
        state.spend.usedUsd += cost;
        state.spend.tokensIn += result.tokensIn;
        state.spend.tokensOut += result.tokensOut;
        state.spend.llmCalls += 1;
        state.lastSeq += 1;
        const wakeStep = {
            v: 2, seq: state.lastSeq, ts: new Date().toISOString(), type: 'wake', source: 'mind',
            trigger: trigger.trigger, fn: fnOf(result.final), content: result.final.slice(0, 400),
            final: result.final, usage: { llmCalls: 1, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: cost },
            backoffLevel: state.backoffLevel,
        };
        appendStep(wakeStep);
        state.wakeAt = scheduleNextSpontaneous(state, cfg, Date.now(), outcome);
        state = advanceAfterWake(state, outcome, cfg);
        state.running = false;
        saveState(state);
        logger.info?.(`[dsh-mind] 唤醒完成 fn=${wakeStep.fn} outcome=${outcome} cost=$${cost.toFixed(4)}`);
    }
    function fnOf(final) {
        const m = final.trim().match(/^\[(act|share|think|learn|recall|goals|idle)\]/i);
        if (m !== null)
            return m[1].toLowerCase();
        if (/^idle\b/i.test(final.trim()))
            return 'idle';
        return 'think';
    }
    // 启动恢复：上次运行若中断（running 卡住）→ 显式弃单（sre B2）
    try {
        const state = loadState();
        if (state.running === true) {
            state.lastSeq += 1;
            appendStep({
                v: 2, seq: state.lastSeq, ts: new Date().toISOString(), type: 'error', source: 'mind',
                content: '上次运行中断（宿主重启）：该唤醒显式弃单，只续排程不续执行',
            });
            state.running = false;
            state.wakeAt = Date.now() + 5000;
            saveState(state);
            logger.warn?.('[dsh-mind] 检测到中断的唤醒，已显式弃单');
        }
        const archived = archiveOldSteps(loadMindConfig().timelineRetentionDays);
        if (archived > 0)
            logger.info?.(`[dsh-mind] 时间线归档 ${archived} 步`);
    }
    catch (error) {
        logger.warn?.('[dsh-mind] 启动恢复失败（不阻断）:', error instanceof Error ? error.message : String(error));
    }
    // 调度 tick（1s；宿主 timer 常驻语义——宿主活着心智就活着，设计 §12.1）
    const tick = setInterval(() => {
        try {
            if (disposed || running)
                return;
            const state = loadState();
            const cfg = loadMindConfig();
            const decision = collectDueMindTriggers(Date.now(), state, cfg, {
                reactiveQueued: reactiveQueue.length > 0,
                eventQueued: false, // P1 无事件源；P2 接 task-board 事件
            });
            if (!decision.fire)
                return;
            running = true;
            void runWake(decision)
                .catch((error) => {
                // 错误退避：失败按 empty 推进 + 显式 error 步骤（errored run ≠ idle）
                try {
                    const s = loadState();
                    s.lastSeq += 1;
                    appendStep({
                        v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'error', source: 'mind',
                        content: `唤醒失败（${decision.trigger}）：${error instanceof Error ? error.message : String(error)}`,
                    });
                    s.wakeAt = scheduleNextSpontaneous(s, loadMindConfig(), Date.now(), 'empty');
                    s.running = false;
                    saveState(s);
                }
                catch { /* 双重失败：等 watchdog */ }
                logger.error?.('[dsh-mind] 唤醒失败:', error instanceof Error ? error.stack ?? error.message : String(error));
            })
                .finally(() => {
                running = false;
            });
        }
        catch (error) {
            // tick 本体任何异常不得击穿宿主（G7）
            logger.error?.('[dsh-mind] tick 异常（已吞）:', error instanceof Error ? error.message : String(error));
        }
    }, TICK_MS);
    tick.unref?.();
    // dispose：停 tick，状态留存
    const lifecycle = ctx;
    if (typeof lifecycle.on === 'function') {
        lifecycle.on('dispose', () => {
            disposed = true;
            clearInterval(tick);
        });
    }
    // 服务面（P2 渠道适配器将消费；P1 仅供观察与测试）
    const service = {
        injectObservation(from, text) {
            try {
                const cfg = loadMindConfig();
                const state = loadState();
                const now = Date.now();
                // 合并窗口 + 小时上限（§5.3）：窗口内并入队尾文本，超额只并入不新增触发
                if (now - state.reactive.windowStart > cfg.reactiveMergeWindowMs) {
                    state.reactive = { windowStart: now, count: 1 };
                }
                else {
                    state.reactive.count += 1;
                }
                saveState(state);
                const last = reactiveQueue.at(-1);
                if (last !== undefined && now - state.reactive.windowStart <= cfg.reactiveMergeWindowMs) {
                    last.text = `${last.text}\n[合并] ${from}: ${text}`;
                }
                else if (state.reactive.count <= cfg.reactiveHourlyMax) {
                    reactiveQueue.push({ from, text });
                }
                else {
                    // 超小时上限：并入队尾（不丢内容只降频）
                    if (last !== undefined)
                        last.text = `${last.text}\n[合并] ${from}: ${text}`;
                    else
                        reactiveQueue.push({ from, text });
                }
            }
            catch (error) {
                logger.warn?.('[dsh-mind] injectObservation 失败（已忽略）:', error instanceof Error ? error.message : String(error));
            }
        },
        /** 手动触发一次唤醒（测试/调试）。 */
        wakeNow() {
            const state = loadState();
            state.wakeAt = Date.now();
            saveState(state);
        },
        /** kill switch（与面板同语义）。 */
        setStopped(stopped) {
            deps.setStoppedByMaster(stopped);
        },
    };
    ctx.provide('dsh-mind', service);
    ctx.logger?.info?.('[dsh-mind] 服务已提供（dsh-mind：injectObservation/wakeNow/setStopped）');
}
