/**
 * dsh-mind — 分身心智运行时（P1 心智本体）。
 *
 * 设计：docs/mind-runtime-design.md v0.3（§4 唤醒循环 / §5 节奏与成本 /
 * §11 调度器规格 / §12 生命周期与常驻保证）。
 *
 * 宿主常驻语义：本插件 = 宿主进程内的代码，调度器是宿主 timer 上的 tick；
 * 状态全落盘（timeline / run/state.json），重启恢复、错过 due 只补一次、
 * 任何接缝异常绝不击穿宿主（LESSONS 2）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { loadMindConfig, mindHome, type MindConfig } from './config.ts'
import { GatewayClient, type TypertGateway } from './gateway.ts'
import { registerPanelApi } from './panel-api.ts'
import { WakeRunner } from './runner.ts'
import {
  advanceAfterWake, collectDueMindTriggers, costUsd, dayKey, scheduleNextSpontaneous,
  type SchedulerState, type TriggerDecision, type WakeOutcome,
} from './scheduler.ts'
import { loadState, saveState } from './state.ts'
import { appendStep, archiveOldSteps, readTail, type TimelineStep } from './timeline.ts'
import { buildWakePrompt } from './wake-prompt.ts'

export const name = 'dsh-mind'
export const provide = ['dsh-mind']

const TICK_MS = 1000

/** 触发源 → 函数菜单结果映射（idle/watchdog 合成唤醒除外）。 */
function outcomeOf(final: string, toolCalls: number): WakeOutcome {
  // FINAL 可能带 [fn] 前缀（提示词要求的输出格式）
  if (/^\[?\s*idle\b/i.test(final.trim())) return 'empty'
  if (toolCalls > 0) return 'engaged'
  return final.trim().length > 60 ? 'engaged' : 'thought'
}

export function apply(ctx: Context): void {
  const logger = ctx.logger ?? console
  logger.info?.('[dsh-mind] 心智运行时已加载（P1 心智本体）')

  let running = false
  let disposed = false
  /** reactive 观察队列（P1 无渠道注入源；P2 由适配器喂入）。 */
  const reactiveQueue: Array<{ from: string; text: string }> = []

  const deps = {
    getConfig: (): MindConfig => loadMindConfig(),
    getState: (): SchedulerState => loadState(),
    setStoppedByMaster(stopped: boolean): void {
      const state = loadState()
      state.stoppedByMaster = stopped
      if (stopped) {
        state.wakeAt = 0 // 停机即清排程；恢复时由 tick 重新排（错过不补）
      } else {
        state.wakeAt = Date.now() + 1000 // 恢复：1s 后开始排程
      }
      saveState(state)
      logger.info?.(`[dsh-mind] kill switch → ${stopped ? '已停' : '已恢复'}`)
    },
    isRunning: (): boolean => running,
    reactiveQueued: (): number => reactiveQueue.length,
    pendingApprovals: (): number => loadState().pendingApprovals ?? 0,
    say: (text: string): void => injectObservation('主人', text, { source: 'web' }),
  }

  // 面板 HTTP 路由（sameOrigin 门禁；LESSONS #11）
  try {
    ctx.inject(['webServer'], (wctx: Context) => {
      const web = wctx.get('webServer') as
        | { register(route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }): void }
        | undefined
      if (web !== undefined) {
        registerPanelApi(web as never, deps)
        logger.info?.('[dsh-mind] 速览路由已注册（/dsh-mind/*）')
      }
    })
  } catch (error) {
    logger.warn?.('[dsh-mind] 面板路由注册失败（显式降级）:', error instanceof Error ? error.message : String(error))
  }

  // ------------------------------------------------------------------
  // 唤醒执行（方案 A：typertGateway 临时/复用 digital-twin 预设会话）
  // ------------------------------------------------------------------
  async function runWake(trigger: TriggerDecision): Promise<void> {
    if (trigger.trigger === 'none') throw new Error('唤醒触发为 none（不应到达）')
    const cfg = loadMindConfig()
    const now = new Date()
    let state = loadState()
    state.lastWakeAt = Date.now()
    state.running = true
    saveState(state)

    const gwLike = ctx.get('typertGateway') as TypertGateway | undefined
    if (gwLike === undefined) throw new Error('typertGateway 缺席（宿主服务不可用）')
    const gw = new GatewayClient(gwLike)
    // 首次唤醒（llmCalls=0）超时加倍：完整预设装配 + 首轮工具链更慢（评审遗留项）
    const firstWake = state.spend.llmCalls === 0
    const runner = new WakeRunner(gw, {
      presetId: cfg.presetId,
      title: '🧠 mind',
      timeoutMs: cfg.wakeTimeoutMs * (firstWake ? 2 : 1),
      resetThresholdTokens: cfg.sessionResetTokens,
    })

    // 底座会话：懒建复用（state.mindSessionId），超阈值重建
    const ensured = await runner.ensureSession(state.mindSessionId, state.spend.tokensIn)
    state = loadState()
    state.mindSessionId = ensured.sessionId
    if (ensured.reset) {
      delete state.cursor
      state.spend.tokensIn = 0
      state.spend.tokensOut = 0
    }
    saveState(state)

    // 上下文装配：守卫/人格（dsh-twin 服务面，缺席兜底）+ 时间线尾部 + 记忆召回
    let guard: string | undefined
    let persona: string | undefined
    try {
      const twin = ctx.get('dsh-twin') as { preview?: () => { persona?: string; guard?: string } } | undefined
      const preview = twin?.preview?.()
      guard = typeof preview?.guard === 'string' ? preview.guard : undefined
      persona = typeof preview?.persona === 'string' ? preview.persona : undefined
    } catch { /* twin 缺席 → 兜底 */ }
    let memories: string[] = []
    try {
      const memory = ctx.get('dsh-memory') as
        | { loadSharedMemory?(): Array<{ content: string }>; filterMemoriesForRead?(e: unknown[]): unknown[] }
        | undefined
      if (memory?.loadSharedMemory !== undefined) {
        const entries = memory.filterMemoriesForRead !== undefined
          ? memory.filterMemoriesForRead(memory.loadSharedMemory())
          : memory.loadSharedMemory()
        memories = (entries as Array<{ content: string }>).slice(-8).map(e => e.content)
      }
    } catch { /* 记忆缺席 → 空召回 */ }

    // readTail 返回新→旧；提示词区块按旧→新叙述
    const tail = readTail(20).steps.slice().reverse()
    // 生命概览（P3）：全部时间线的分层 recap，有界空间覆盖一生
    let lifeRecap = ''
    try {
      const { readAllSteps, renderLifeRecap } = await import('./recap.ts')
      lifeRecap = renderLifeRecap(readAllSteps(), cfg)
    } catch (e) {
      logger.warn?.('[dsh-mind] 生命概览失败（跳过）:', e instanceof Error ? e.message : String(e))
    }
    const prompt = buildWakePrompt({
      identityName: '分身',
      guard,
      persona,
      tail,
      lifeRecap,
      lastFinal: tail.filter(s => s.type === 'wake').at(-1)?.final,
      memories,
      pendingMessages: reactiveQueue.splice(0, reactiveQueue.length).map(q => ({ from: q.from, text: q.text })),
      now,
    })

    const result = await runner.runWake(ensured.sessionId, prompt)
    // 归类：FINAL 的 [fn] 前缀优先（提示词要求的输出格式），剥前缀后入库
    const fn = fnOf(result.final)
    const finalText = result.final.replace(/^\[\s*(?:act|share|think|learn|recall|goals|idle)\s*\]\s*/i, '')
    const outcome: WakeOutcome = outcomeOf(finalText, result.toolCalls)
    const cost = costUsd(cfg, result.tokensIn, result.tokensOut)

    // 台账推进（按日清零）+ 时间线 + 退避推进 + 下次排程
    state = loadState()
    const today = dayKey(new Date())
    if (state.spend.date !== today) state.spend = { date: today, usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 }
    state.spend.usedUsd += cost
    state.spend.tokensIn += result.tokensIn
    state.spend.tokensOut += result.tokensOut
    state.spend.llmCalls += 1
    state.lastSeq += 1
    const wakeStep: TimelineStep = {
      v: 2, seq: state.lastSeq, ts: new Date().toISOString(), type: 'wake', source: 'mind',
      trigger: trigger.trigger, fn, content: finalText.slice(0, 400),
      final: finalText, usage: { llmCalls: 1, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: cost },
      backoffLevel: state.backoffLevel,
    }
    appendStep(wakeStep)
    state.wakeAt = scheduleNextSpontaneous(state, cfg, Date.now(), outcome)
    state = advanceAfterWake(state, outcome, cfg)
    state.running = false
    saveState(state)
    logger.info?.(`[dsh-mind] 唤醒完成 fn=${wakeStep.fn} outcome=${outcome} cost=$${cost.toFixed(4)}`)
  }

  function fnOf(final: string): NonNullable<TimelineStep['fn']> {
    const m = final.trim().match(/^\[(act|share|think|learn|recall|goals|idle)\]/i)
    if (m !== null) return m[1]!.toLowerCase() as NonNullable<TimelineStep['fn']>
    if (/^idle\b/i.test(final.trim())) return 'idle'
    return 'think'
  }

  // 启动恢复：上次运行若中断（running 卡住）→ 显式弃单（sre B2）；
  // 首启播种（wakeAt=0 → 永不触发的新装死锁）：开机 30s 后第一次自发唤醒
  try {
    const state = loadState()
    if (state.running === true) {
      state.lastSeq += 1
      appendStep({
        v: 2, seq: state.lastSeq, ts: new Date().toISOString(), type: 'error', source: 'mind',
        content: '上次运行中断（宿主重启）：该唤醒显式弃单，只续排程不续执行',
      })
      state.running = false
      state.wakeAt = Date.now() + 5000
      saveState(state)
      logger.warn?.('[dsh-mind] 检测到中断的唤醒，已显式弃单')
    }
    if (state.wakeAt === 0 && state.stoppedByMaster === false) {
      state.wakeAt = Date.now() + 30000 // 首启播种：开机 30s 后第一次自发唤醒
      saveState(state)
      logger.info?.('[dsh-mind] 首启播种：30s 后第一次自发唤醒')
    }
    const archived = archiveOldSteps(loadMindConfig().timelineRetentionDays)
    if (archived > 0) logger.info?.(`[dsh-mind] 时间线归档 ${archived} 步`)
  } catch (error) {
    logger.warn?.('[dsh-mind] 启动恢复失败（不阻断）:', error instanceof Error ? error.message : String(error))
  }

  // 审批自动拒绝（死锁防线，2026-09-22 事故）：心智会话（自治面）发起的需要
  // 提权/审批的动作一律拒绝——turn 会被拒绝关闭而不是永久等待；拒绝原因写入
  // 时间线与 pendingApprovals 计数，主人在速览可见、批准后续行。其他会话的
  // 审批透传（await next），不改变任何裁决。
  const events = ctx as unknown as {
    on?: (event: string, handler: (...args: never[]) => unknown) => void
  }
  if (typeof events.on === 'function') {
    events.on('approval/request', async (req: unknown, next: () => Promise<unknown>): Promise<unknown> => {
      try {
        const agentId = (req as { agent?: { id?: unknown } } | undefined)?.agent?.id
        const mindSession = loadState().mindSessionId
        if (typeof agentId === 'string' && typeof mindSession === 'string' && agentId === mindSession) {
          const tool = typeof (req as { toolName?: unknown }).toolName === 'string'
            ? (req as { toolName: string }).toolName
            : 'tool'
          const reason = typeof (req as { reason?: unknown }).reason === 'string'
            ? (req as { reason: string }).reason.slice(0, 160)
            : ''
          try {
            const s = loadState()
            s.lastSeq += 1
            s.pendingApprovals += 1
            appendStep({
              v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'observation', source: 'mind',
              content: `自治面审批被拒：${tool}（${reason}）。此类动作需主人批准后经 task_delegate 治理路径执行。`,
            })
            saveState(s)
          } catch { /* 记录失败不影响拒绝 */ }
          logger.warn?.(`[dsh-mind] 自治面审批已拒（${tool}）——分身应改走 task_delegate 治理路径`)
          return 'rejected'
        }
      } catch { /* 观察者异常不影响审批链 */ }
      return await next()
    })
  }

  // 调度 tick（1s；宿主 timer 常驻语义——宿主活着心智就活着，设计 §12.1）
  const tick = setInterval(() => {
    try {
      if (disposed || running) return
      const state = loadState()
      const cfg = loadMindConfig()
      const decision: TriggerDecision = collectDueMindTriggers(Date.now(), state, cfg, {
        reactiveQueued: reactiveQueue.length > 0,
        eventQueued: false, // P1 无事件源；P2 接 task-board 事件
      })
      if (!decision.fire) return
      running = true
      void runWake(decision)
        .catch((error: unknown) => {
          // 错误退避：失败按 empty 快进 + 显式 error 步骤（errored run ≠ idle）；
          // 超时错误携带的部分用量照常入台账（token 已计费，不能流失）
          try {
            const cfgNow = loadMindConfig()
            const s = loadState()
            s.lastSeq += 1
            appendStep({
              v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'error', source: 'mind',
              content: `唤醒失败（${decision.trigger}）：${error instanceof Error ? error.message : String(error)}`,
            })
            const usage = (error as { usage?: { tokensIn?: number; tokensOut?: number } } | undefined)?.usage
            const uIn = usage?.tokensIn ?? 0
            const uOut = usage?.tokensOut ?? 0
            if (uIn > 0 || uOut > 0) {
              const today = dayKey(new Date())
              if (s.spend.date !== today) s.spend = { date: today, usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 }
              s.spend.tokensIn += uIn
              s.spend.tokensOut += uOut
              s.spend.usedUsd += costUsd(cfgNow, uIn, uOut)
            }
            s.backoffLevel = Math.min(s.backoffLevel + 3, 10) // 错误退避加强：连错快进到大档
            s.wakeAt = scheduleNextSpontaneous(s, cfgNow, Date.now(), 'empty')
            s.running = false
            saveState(s)
          } catch { /* 双重失败：等 watchdog */ }
          logger.error?.('[dsh-mind] 唤醒失败:', error instanceof Error ? error.stack ?? error.message : String(error))
        })
        .finally(() => {
          running = false
        })
    } catch (error) {
      // tick 本体任何异常不得击穿宿主（G7）
      logger.error?.('[dsh-mind] tick 异常（已吞）:', error instanceof Error ? error.message : String(error))
    }
  }, TICK_MS)
  tick.unref?.()

  // dispose：停 tick，状态留存
  const lifecycle = ctx as unknown as { on?: (event: 'dispose', fn: () => void) => void; effect?: (fn: () => () => void) => void }
  if (typeof lifecycle.on === 'function') {
    lifecycle.on('dispose', () => {
      disposed = true
      clearInterval(tick)
    })
  }

  // 服务面（§6.2 injectObservation：渠道与 Web 面板共用的唯一观察入口）
  /** 观察注入。opts.source 提供时，观察同时作为 message_in 步骤落时间线
   * （Web 留言用，发送者记 refs.from；IM 渠道维持现状——只进唤醒上下文不落步骤，
   * 避免 P2 语义漂移）。合并窗口/小时上限照旧：不丢内容只降频。 */
  function injectObservation(from: string, text: string, opts?: { source?: string }): void {
    try {
      if (opts?.source !== undefined) {
        const s = loadState()
        s.lastSeq += 1
        appendStep({
          v: 2, seq: s.lastSeq, ts: new Date().toISOString(), type: 'message_in',
          source: opts.source, content: text.slice(0, 2000), refs: { from },
        })
        saveState(s)
      }
      const cfg = loadMindConfig()
      const state = loadState()
      const now = Date.now()
      // 合并窗口 + 小时上限（§5.3）：窗口内并入队尾文本，超额只并入不新增触发
      if (now - state.reactive.windowStart > cfg.reactiveMergeWindowMs) {
        state.reactive = { windowStart: now, count: 1 }
      } else {
        state.reactive.count += 1
      }
      saveState(state)
      const last = reactiveQueue.at(-1)
      if (last !== undefined && now - state.reactive.windowStart <= cfg.reactiveMergeWindowMs) {
        last.text = `${last.text}\n[合并] ${from}: ${text}`
      } else if (state.reactive.count <= cfg.reactiveHourlyMax) {
        reactiveQueue.push({ from, text })
      } else {
        // 超小时上限：并入队尾（不丢内容只降频）
        if (last !== undefined) last.text = `${last.text}\n[合并] ${from}: ${text}`
        else reactiveQueue.push({ from, text })
      }
    } catch (error) {
      logger.warn?.('[dsh-mind] injectObservation 失败（已忽略）:', error instanceof Error ? error.message : String(error))
    }
  }

  const service = {
    injectObservation,
    /** 手动触发一次唤醒（测试/调试）。 */
    wakeNow(): void {
      const state = loadState()
      state.wakeAt = Date.now()
      saveState(state)
    },
    /** kill switch（与面板同语义）。 */
    setStopped(stopped: boolean): void {
      deps.setStoppedByMaster(stopped)
    },
  }
  ;(ctx as unknown as { provide: (name: string, value: unknown) => void }).provide('dsh-mind', service)
  ctx.logger?.info?.('[dsh-mind] 服务已提供（dsh-mind：injectObservation/wakeNow/setStopped）')
}
