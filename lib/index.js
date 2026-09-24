import { loadMindConfig } from "./config.js";
import { GatewayClient } from "./gateway.js";
import { registerPanelApi } from "./panel-api.js";
import { WakeRunner } from "./runner.js";
import { deliverToChannels, registerMindChannel } from "./channels.js";
import { extractGoalEntries, settleGoals } from "./goals.js";
import { pushPending, resolvePendingsBefore, stalePendings } from "./pendings.js";
import { dueEscalations, openAsk, parseAskPayload, settleAsksByGoal } from "./asks.js";
import { readRollups } from "./rollups.js";
import { tryRollup } from "./summarizer.js";
import { diffWorld } from "./worldwatch.js";
import { loadMissions } from "./missions.js";
import { advanceAfterWake, collectDueMindTriggers, costUsd, dayKey, DEEP_THINK_EVERY, IDLE_STEP_EVERY, nextDelayMs, scheduleNextSpontaneous, shouldShortCircuitSpontaneous, } from "./scheduler.js";
import { loadState, saveState } from "./state.js";
import { appendStep, archiveOldSteps, readTail } from "./timeline.js";
import { buildWakePrompt } from "./wake-prompt.js";
import { resolveCurrentBlocks } from "./prompts.js";
export const name = 'dsh-mind';
export const provide = ['dsh-mind'];
const TICK_MS = 1000;
/** 触发源 → 函数菜单结果映射（idle/watchdog 合成唤醒除外）。 */
function outcomeOf(final, toolCalls) {
    // FINAL 可能带 [fn] 前缀（提示词要求的输出格式）
    if (/^\[?\s*idle\b/i.test(final.trim()))
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
    /** 读记忆条目（dsh-memory 服务面；缺席→空）。 */
    function readMemoryEntries() {
        try {
            const memory = ctx.get('dsh-memory');
            if (memory?.loadSharedMemory === undefined)
                return [];
            const entries = memory.filterMemoriesForRead !== undefined
                ? memory.filterMemoriesForRead(memory.loadSharedMemory())
                : memory.loadSharedMemory();
            return entries;
        }
        catch {
            return [];
        }
    }
    /** P4 goals 精化：当前活跃目标（[目标] 标记 − 已结清同题）。 */
    function readActiveGoals() {
        const entries = readMemoryEntries();
        return settleGoals(extractGoalEntries(entries), entries).slice(-5);
    }
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
        reactiveQueued: () => reactiveQueue.length,
        pendingApprovals: () => loadState().pendingApprovals ?? 0,
        say: (text) => injectObservation('主人', text, { source: 'web' }),
        activeGoals: () => readActiveGoals(),
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
        // 首次唤醒（llmCalls=0）超时加倍：完整预设装配 + 首轮工具链更慢（评审遗留项）
        const firstWake = state.spend.llmCalls === 0;
        const runner = new WakeRunner(gw, {
            presetId: cfg.presetId,
            title: '🧠 mind',
            timeoutMs: cfg.wakeTimeoutMs * (firstWake ? 2 : 1),
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
        // P4 goals 精化：同一装载派生「当前目标」（[目标] 标记条目，结清同题即移除）
        let goalsActive = [];
        // P5 请求账结清联动：目标 [目标·完成]/[目标·放弃] 销账 → 关联 ask 自动结清（§6.5）
        let settledGoalTitles = [];
        try {
            const memory = ctx.get('dsh-memory');
            if (memory?.loadSharedMemory !== undefined) {
                const entries = (memory.filterMemoriesForRead !== undefined
                    ? memory.filterMemoriesForRead(memory.loadSharedMemory())
                    : memory.loadSharedMemory());
                memories = entries.slice(-8).map(e => e.content);
                goalsActive = settleGoals(extractGoalEntries(entries), entries).slice(-5);
                settledGoalTitles = entries
                    .map(e => e.content.trimStart())
                    .filter(c => /^\[目标·(完成|放弃)\]/.test(c))
                    .map(c => c.replace(/^\[目标·(完成|放弃)\]\s*/, '').slice(0, 200));
            }
        }
        catch { /* 记忆缺席 → 空召回 */ }
        // readTail 返回新→旧；提示词区块按旧→新叙述
        const tail = readTail(20).steps.slice().reverse();
        // 生命概览（P3/P3.2）：LLM 语义摘要（有则优先）+ 机械分层，有界空间覆盖一生
        let lifeRecap = '';
        try {
            const { readAllSteps, renderLifeRecap, RECAP_FANOUT } = await import("./recap.js");
            lifeRecap = renderLifeRecap(readAllSteps(), cfg, RECAP_FANOUT, readRollups(8));
        }
        catch (e) {
            logger.warn?.('[dsh-mind] 生命概览失败（跳过）:', e instanceof Error ? e.message : String(e));
        }
        // 提示词块：心智 Tab 覆盖层优先，缺席回落内置默认（每次唤醒现读，保存即生效）
        const blocks = resolveCurrentBlocks();
        // 议程：主人长期事项（missions.md）+ 主人最近在忙的事（最近会话标题，感知面）
        const missions = loadMissions();
        let recentActivity = [];
        try {
            const list = (await gw.invoke('session', 'list', {}));
            const selfIds = new Set([state.mindSessionId, state.summarizerSessionId].filter(Boolean));
            recentActivity = (list.items ?? [])
                .filter(s => typeof s.title === 'string' && s.title.trim() !== '' && !selfIds.has(s.sessionId ?? ''))
                .sort((a, b) => (b.lastActiveAt ?? b.updatedAt ?? 0) - (a.lastActiveAt ?? a.updatedAt ?? 0))
                .slice(0, 6)
                .map(s => {
                const when = (s.lastActiveAt ?? s.updatedAt ?? 0) > 0
                    ? new Date(s.lastActiveAt ?? s.updatedAt ?? 0).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : '';
                return `${s.title.slice(0, 48)}${when !== '' ? `（${when}）` : ''}`;
            });
        }
        catch { /* 会话列表缺席 → 近况留空 */ }
        const prompt = buildWakePrompt({
            identityName: '分身',
            guard,
            persona,
            tail,
            lifeRecap,
            lastFinal: tail.filter(s => s.type === 'wake').at(-1)?.final,
            memories,
            goalsActive,
            missions,
            recentActivity,
            pendingMessages: reactiveQueue.splice(0, reactiveQueue.length).map(q => ({ from: q.from, text: q.text })),
            stalePendings: stalePendings(loadState().openPendings, now.getTime()),
            openAsks: (state.openAsks ?? [])
                .filter(a => a.state === 'open')
                .map(a => {
                const t = Date.parse(a.ts);
                const ageHours = Number.isNaN(t) ? 0 : Math.max(0, Math.round((now.getTime() - t) / 3_600_000));
                return { ageHours, what: a.what, ...(a.howto !== undefined ? { howto: a.howto } : {}) };
            }),
            now,
        }, blocks);
        const result = await runner.runWake(ensured.sessionId, prompt);
        // 归类：[fn] 标记可能在 FINAL="..." 内（模型先自由叙述再给 FINAL 行），
        // 全文搜首个标记；idle 优先按 fn 判定——误判 think 会让退避永不生长（v0.2.1 实测事故）
        const fn = fnOf(result.final);
        const finalText = result.final.replace(/^\[\s*(?:act|share|ask|think|learn|recall|goals|idle)\s*\]\s*/i, '');
        const outcome = fn === 'idle' ? 'empty' : fn === 'ask' ? 'engaged' : outcomeOf(finalText, result.toolCalls);
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
            trigger: trigger.trigger, fn, content: finalText.slice(0, 400),
            final: finalText, usage: { llmCalls: 1, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: cost },
            backoffLevel: state.backoffLevel,
        };
        appendStep(wakeStep);
        // P2.1 承诺账：act/share（或真动了工具）= 对唤醒前挂起的主人消息出手 → 清账
        if (fn === 'act' || fn === 'share' || result.toolCalls > 0) {
            state.openPendings = resolvePendingsBefore(state.openPendings, now.toISOString());
        }
        // P5 请求账（§6.5）：目标销账联动结清 + ask 开单入账（入账即一次性投递）
        state.openAsks = settleAsksByGoal(state.openAsks ?? [], settledGoalTitles);
        if (fn === 'ask') {
            const payload = parseAskPayload(finalText);
            if (payload.what !== '') {
                const entry = {
                    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    seq: state.lastSeq,
                    ts: now.toISOString(),
                    what: payload.what,
                    ...(payload.why !== undefined ? { why: payload.why } : {}),
                    ...(payload.howto !== undefined ? { howto: payload.howto } : {}),
                    ...(payload.goalTitle !== undefined ? { goalTitle: payload.goalTitle } : {}),
                    state: 'open',
                    notifiedAt: Date.now(),
                };
                const opened = openAsk(state.openAsks, entry);
                state.openAsks = opened.list;
                if (opened.duplicated) {
                    logger.info?.('[dsh-mind] ask 同文请求已在案（指纹去重），仅留痕不重发');
                }
                else {
                    const lines = [`我在等一样东西才能继续：${payload.what}。`];
                    if (payload.why !== undefined)
                        lines.push(`为了：${payload.why}。`);
                    if (payload.howto !== undefined)
                        lines.push(`你给了之后我会：${payload.howto}。`);
                    void deliverToChannels({ to: 'master', text: lines.join('') })
                        .then(r => {
                        if (r.delivered === 0)
                            logger.warn?.('[dsh-mind] ask 无渠道可投递（面板「等待主人」徽标承载）');
                    })
                        .catch(() => { });
                }
            }
            else {
                logger.warn?.('[dsh-mind] ask 开单缺 what（FINAL 格式不符），未入账');
            }
        }
        state.idleStreak = 0; // 真实唤醒打断机械空醒连拍
        state.lastWakeAt = Date.now(); // 锚定到唤醒【结束】：世界观察的回显抑制窗从结束点起算
        state.wakeAt = scheduleNextSpontaneous(state, cfg, Date.now(), outcome);
        state = advanceAfterWake(state, outcome, cfg);
        state.running = false;
        saveState(state);
        logger.info?.(`[dsh-mind] 唤醒完成 fn=${wakeStep.fn} outcome=${outcome} cost=$${cost.toFixed(4)}`);
        // P3.2 记忆卷积：凑满 F 条未摘要步骤才真正调用（异步尽力而为，失败静默——
        // 机械 recap 兜底，绝不因摘要失败影响唤醒主流程）
        void tryRollup({ gateway: gwLike, presetId: cfg.presetId })
            .then(r => { if (!r.ok && r.reason !== undefined && r.reason !== 'not-due')
            logger.warn?.(`[dsh-mind] 卷积跳过: ${r.reason}`); })
            .catch(() => { });
        // 世界观察：吸收自己造成的变化（task_delegate 落板/learn 写记忆不算"外部事件"）
        absorbWorld();
        // share 投递：经注册渠道送达（对齐「渠道=终端」——右下角/IM 都是出口）。
        // 全失败/无渠道 → 仅时间线留痕，不重试不阻塞（下拍复盘可再提）。
        if (fn === 'share') {
            void deliverToChannels({ to: 'master', text: finalText })
                .then(r => {
                if (r.delivered === 0)
                    logger.warn?.('[dsh-mind] share 无渠道可投递（仅时间线留痕）');
            })
                .catch(() => { });
        }
    }
    function fnOf(final) {
        // 标记可能在文本中部（FINAL="..." 内），全文搜首个；找不到再看 idle 文本形态
        const m = final.match(/\[(act|share|ask|think|learn|recall|goals|idle)\]/i);
        if (m !== null)
            return m[1].toLowerCase();
        if (/^idle\b/i.test(final.trim()) || /本拍\s*idle/i.test(final))
            return 'idle';
        return 'think';
    }
    // 启动恢复：上次运行若中断（running 卡住）→ 显式弃单（sre B2）；
    // 首启播种（wakeAt=0 → 永不触发的新装死锁）：开机 30s 后第一次自发唤醒
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
        if (state.wakeAt === 0 && state.stoppedByMaster === false) {
            state.wakeAt = Date.now() + 30000; // 首启播种：开机 30s 后第一次自发唤醒
            saveState(state);
            logger.info?.('[dsh-mind] 首启播种：30s 后第一次自发唤醒');
        }
        const archived = archiveOldSteps(loadMindConfig().timelineRetentionDays);
        if (archived > 0)
            logger.info?.(`[dsh-mind] 时间线归档 ${archived} 步`);
    }
    catch (error) {
        logger.warn?.('[dsh-mind] 启动恢复失败（不阻断）:', error instanceof Error ? error.message : String(error));
    }
    // 审批自动拒绝（死锁防线，2026-09-22 事故）：心智会话（自治面）发起的需要
    // 提权/审批的动作一律拒绝——turn 会被拒绝关闭而不是永久等待；拒绝原因写入
    // 时间线与 pendingApprovals 计数，主人在速览可见、批准后续行。其他会话的
    // 审批透传（await next），不改变任何裁决。
    const events = ctx;
    if (typeof events.on === 'function') {
        events.on('approval/request', async (req, next) => {
            try {
                const agentId = req?.agent?.id;
                const mindSession = loadState().mindSessionId;
                if (typeof agentId === 'string' && typeof mindSession === 'string' && agentId === mindSession) {
                    const tool = typeof req.toolName === 'string'
                        ? req.toolName
                        : 'tool';
                    const reason = typeof req.reason === 'string'
                        ? req.reason.slice(0, 160)
                        : '';
                    try {
                        const s = loadState();
                        s.lastSeq += 1;
                        s.pendingApprovals += 1;
                        appendStep({
                            v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'observation', source: 'mind',
                            content: `自治面审批被拒：${tool}（${reason}）。此类动作需主人批准后经 task_delegate 治理路径执行。`,
                        });
                        saveState(s);
                    }
                    catch { /* 记录失败不影响拒绝 */ }
                    logger.warn?.(`[dsh-mind] 自治面审批已拒（${tool}）——分身应改走 task_delegate 治理路径`);
                    return 'rejected';
                }
            }
            catch { /* 观察者异常不影响审批链 */ }
            return await next();
        });
    }
    /** 世界观察（分身的感知器官）：两次唤醒之间看板/记忆有变化 → 注入观察
     *  触发反应性唤醒。看板缺失/网络失败静默（感知不到就回到自驱节奏）。
     *  防自激：指纹即时更新（同一变化只注入一次）；唤醒收尾再吸收自己造成的变化。 */
    async function checkWorld() {
        const cfgNow = loadMindConfig();
        if (!cfgNow.worldWatchEnabled)
            return;
        const taskCols = {};
        try {
            const resp = await fetch(`${cfgNow.worldWatchUrl}/dsh-task-board/state`, { signal: AbortSignal.timeout(5000) });
            const body = (await resp.json());
            for (const t of body.state?.tasks ?? []) {
                const c = t.column ?? '?';
                taskCols[c] = (taskCols[c] ?? 0) + 1;
            }
        }
        catch { /* 看板缺席/超时：本轮只看记忆 */ }
        const entries = readMemoryEntries();
        const counts = { taskCols, memoryCount: entries.length };
        const s = loadState();
        const diff = diffWorld(s.worldFingerprint, counts);
        if (diff.fp === s.worldFingerprint)
            return;
        s.worldFingerprint = diff.fp;
        // 自回显压制：唤醒【结束】90 秒内的世界变化多半是 TA 自己动作的回显
        // （absorbWorld 异步收尾与 20s 巡查 tick 有竞态窗口）——静默吸收不注入
        const recentWake = s.lastWakeAt > 0 && Date.now() - s.lastWakeAt < 90000;
        saveState(s);
        if (diff.desc !== null && !running && !recentWake) {
            logger.info?.(`[dsh-mind] ${diff.desc}——注入观察触发唤醒`);
            injectObservation('世界', diff.desc, { source: '世界观察' });
        }
    }
    /** 唤醒收尾：静默吸收自己造成的世界变化（task_delegate 落板/learn 写记忆），
     *  防「自己动手 → 世界变化 → 又被自己观察」的自激循环。 */
    function absorbWorld() {
        void checkWorld().catch(() => { });
    }
    /** 机械空醒（成本闸）：不调用模型，记 idle 步骤并按空转推进阶梯。
     *  2026-09-22 成本事故：空转拍也曾各跑一次完整 LLM turn（实测 ~4.4K tok/次）。 */
    function mechanicalIdle() {
        try {
            const cfgNow = loadMindConfig();
            const s = loadState();
            // 密度治理：连续机械空醒每 IDLE_STEP_EVERY 拍才落一条 idle 步骤
            // （5 分钟地板 × 6 ≈ 30 分钟一条可审计心跳），其余拍静默续排
            s.lastSeq += 1;
            const streak = (Number(s.idleStreak) || 0) + 1;
            s.idleStreak = streak;
            if (streak % IDLE_STEP_EVERY === 0) {
                appendStep({
                    v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'idle', source: 'mind',
                    content: `空醒短路：无新观察、无待办，上一拍亦空转——略过本次思考。（连续空醒 ${streak} 拍）`,
                });
            }
            // P5 请求账升级（§6.5）：>24h 未结清每 24h 节流重投递——机械拍也能触达主人
            const escalations = dueEscalations(s.openAsks ?? [], Date.now());
            if (escalations.length > 0) {
                const nowMs = Date.now();
                s.openAsks = (s.openAsks ?? []).map(a => escalations.some(e => e.id === a.id) ? { ...a, lastEscalatedAt: nowMs } : a);
                for (const a of escalations) {
                    const t = Date.parse(a.ts);
                    const ageH = Number.isNaN(t) ? 24 : Math.max(1, Math.round((nowMs - t) / 3_600_000));
                    void deliverToChannels({ to: 'master', text: `提醒：我还在等「${a.what}」，已经 ${ageH} 小时了。给了我就继续。` })
                        .catch(() => { });
                }
                logger.info?.(`[dsh-mind] 请求账升级重投递 ${escalations.length} 条`);
            }
            s.lastWakeAt = Date.now();
            const advanced = advanceAfterWake(s, 'empty', cfgNow);
            advanced.lastSeq = s.lastSeq;
            advanced.lastWakeAt = s.lastWakeAt;
            advanced.idleStreak = s.idleStreak;
            advanced.wakeAt = Date.now() + nextDelayMs(cfgNow, advanced.backoffLevel);
            saveState(advanced);
        }
        catch (e) {
            logger.warn?.('[dsh-mind] 机械空醒失败（不阻断）:', e instanceof Error ? e.message : String(e));
        }
    }
    // 调度 tick（1s；宿主 timer 常驻语义——宿主活着心智就活着，设计 §12.1）
    let watchTicks = 0;
    const tick = setInterval(() => {
        try {
            if (disposed || running)
                return;
            // 世界观察（每 ~20s 一次巡查；变化注入观察触发反应性唤醒——分身的感知器官）
            watchTicks += 1;
            if (watchTicks % 20 === 0) {
                void checkWorld();
                return;
            }
            const state = loadState();
            const cfg = loadMindConfig();
            const decision = collectDueMindTriggers(Date.now(), state, cfg, {
                reactiveQueued: reactiveQueue.length > 0,
                eventQueued: false, // 看板/记忆事件经 checkWorld 以 reactive 注入（§6.4 语义）
            });
            if (!decision.fire)
                return;
            // 自驱空醒短路：无新事可议时不调用模型（反应性/事件触发永不短路）
            if (decision.trigger === 'spontaneous') {
                const tail = readTail(20).steps;
                const lastMoment = tail.find(s => s.type === 'wake' || s.type === 'idle');
                const lastWasIdle = lastMoment !== undefined && (lastMoment.type === 'idle' || lastMoment.fn === 'idle');
                const newObservations = tail.filter(s => (s.type === 'message_in' || s.type === 'observation' || s.type === 'task')
                    && Date.parse(s.ts) > state.lastWakeAt).length;
                // 深思考拍：每 DEEP_THINK_EVERY 个短路拍强制一次真醒——安静世界也要推进
                // 长期事项（纯短路会让分身永远不再自发思考，结构性闲置）
                const dueDeepThink = (state.idleStreak ?? 0) + 1 >= DEEP_THINK_EVERY;
                if (!dueDeepThink && shouldShortCircuitSpontaneous(cfg, state, {
                    reactiveQueued: reactiveQueue.length > 0,
                    eventQueued: false,
                    newObservations,
                    lastWasIdle,
                })) {
                    mechanicalIdle();
                    return;
                }
            }
            running = true;
            void runWake(decision)
                .catch((error) => {
                // 错误退避：失败按 empty 快进 + 显式 error 步骤（errored run ≠ idle）；
                // 超时错误携带的部分用量照常入台账（token 已计费，不能流失）
                try {
                    const cfgNow = loadMindConfig();
                    const s = loadState();
                    s.lastSeq += 1;
                    appendStep({
                        v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'error', source: 'mind',
                        content: `唤醒失败（${decision.trigger}）：${error instanceof Error ? error.message : String(error)}`,
                    });
                    const usage = error?.usage;
                    const uIn = usage?.tokensIn ?? 0;
                    const uOut = usage?.tokensOut ?? 0;
                    if (uIn > 0 || uOut > 0) {
                        const today = dayKey(new Date());
                        if (s.spend.date !== today)
                            s.spend = { date: today, usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 };
                        s.spend.tokensIn += uIn;
                        s.spend.tokensOut += uOut;
                        s.spend.usedUsd += costUsd(cfgNow, uIn, uOut);
                    }
                    s.backoffLevel = Math.min(s.backoffLevel + 3, 10); // 错误退避加强：连错快进到大档
                    s.wakeAt = scheduleNextSpontaneous(s, cfgNow, Date.now(), 'empty');
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
    // 服务面（§6.2 injectObservation：渠道与 Web 面板共用的唯一观察入口）
    /** 观察注入。opts.source 提供时，观察同时作为 message_in 步骤落时间线
     * （Web 留言用，发送者记 refs.from；IM 渠道维持现状——只进唤醒上下文不落步骤，
     * 避免 P2 语义漂移）。合并窗口/小时上限照旧：不丢内容只降频。 */
    function injectObservation(from, text, opts) {
        try {
            if (opts?.source !== undefined) {
                const s = loadState();
                s.lastSeq += 1;
                appendStep({
                    v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'message_in',
                    source: opts.source, content: text.slice(0, 2000), refs: { from },
                });
                saveState(s);
            }
            const cfg = loadMindConfig();
            const state = loadState();
            const now = Date.now();
            // P2.1 承诺账：主人的话先入账（act/share 出手即清；超 24h 升级为唤醒提醒）
            state.openPendings = pushPending(state.openPendings, {
                seq: state.lastSeq, ts: new Date(now).toISOString(), text: text.slice(0, 200),
            });
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
    }
    const service = {
        injectObservation,
        /** 渠道适配器注册（§6.1 单向注册：渠道侧惰性调用，如 im-channel）。
         *  注册后心智的 share 产出会经 deliver 投递到该渠道。返回注销函数。 */
        registerChannel(channel) {
            return registerMindChannel(channel);
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
