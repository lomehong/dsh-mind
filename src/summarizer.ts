/**
 * P3.2 分层 LLM 摘要器：低配会话上跑记忆卷积。
 *
 * - 会话：懒建一只独立低配会话（summarizerPresetId，默认 'default'；缺席回落
 *   心智预设），与心智主会话物理隔离——摘要不污染唤醒上下文，唤醒也不见摘要过程；
 * - 节奏：每次唤醒完成后尝试一次，凑满 F 条未卷积步骤才真正调用（≈每小时 1 次）；
 * - 失败语义：任何失败静默跳过本轮（机械 recap 兜底），绝不击穿宿主（LESSONS 2）。
 */
import { GatewayClient, type TypertGateway } from './gateway.ts'
import { WakeRunner } from './runner.ts'
import { loadState, saveState } from './state.ts'
import type { TimelineStep } from './timeline.ts'
import { appendRollup, buildRollupPrompt, selectRollupSpan } from './rollups.ts'
import { readAllSteps } from './recap.ts'

export interface RollupOptions {
  gateway: TypertGateway
  presetId: string
  summarizerPresetId?: string
}

/** 尝试做一轮摘要（异步尽力而为；调用方 void 掉，绝不 await 主流程）。 */
export async function tryRollup(opts: RollupOptions): Promise<{ ok: boolean; reason?: string }> {
  try {
    const state = loadState()
    const cursor = Number(state.lastRolledUpSeq ?? 0)
    const selection = selectRollupSpan(readAllSteps(), cursor)
    if (selection === null) return { ok: false, reason: 'not-due' }

    const gw = new GatewayClient(opts.gateway)
    const runner = new WakeRunner(gw, {
      presetId: opts.summarizerPresetId ?? 'default',
      title: '🧠 卷积',
      timeoutMs: 120_000,
      resetThresholdTokens: 400_000, // 摘要会话基本不涨，实际永不重建
    })
    let sessionId = state.summarizerSessionId
    const ensured = await runner.ensureSession(sessionId, 0)
    sessionId = ensured.sessionId

    const result = await runner.runWake(sessionId, buildRollupPrompt(selection.span))
    const text = result.final.trim()
    if (text === '') return { ok: false, reason: 'empty-summary' }

    const s2 = loadState()
    if ((s2.lastRolledUpSeq ?? 0) >= selection.upToSeq) return { ok: false, reason: 'stale' }
    s2.lastRolledUpSeq = selection.upToSeq
    s2.summarizerSessionId = sessionId
    saveState(s2)
    appendRollup({
      v: 1,
      seq: s2.lastSeq,
      ts: new Date().toISOString(),
      refs: { steps: [selection.span[0]!.seq!, selection.span.at(-1)!.seq!] },
      span: selection.span.length,
      text: text.slice(0, 300),
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

/** 步骤数守卫（测试/外部调用用）。 */
export function countUnrolled(steps: ReadonlyArray<TimelineStep>, lastRolledUpSeq: number): number {
  return steps.filter(s => typeof s.seq === 'number' && s.seq > lastRolledUpSeq).length
}
