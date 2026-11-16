/**
 * 唤醒调度纯函数测试（设计 §5/§11；G8 确定性用例）。
 * 时钟由调用方注入——无真实 sleep，全部即时断言。
 */
import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, type MindConfig } from '../src/config.ts'
import {
  advanceAfterWake, collectDueMindTriggers, costUsd, dayKey, decayRejections, errorAggDecision, errorAggRowContent, evaluateSpend,
  isQuietHour, nextDelayMs, scheduleNextSpontaneous, shouldShortCircuitSpontaneous,
  type SchedulerState,
} from '../src/scheduler.ts'

const cfg: MindConfig = JSON.parse(JSON.stringify(CONFIG_DEFAULTS))

function state(overrides: Partial<SchedulerState> = {}): SchedulerState {
  return {
    backoffLevel: 0, emptiesAtLevel: 0, wakeAt: 0, lastWakeAt: 0,
    stoppedByMaster: false, lastSeq: 0,
    spend: { date: '2026-09-18', usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 },
    reactive: { windowStart: 0, count: 0 },
    ...overrides,
  }
}

const NOON = Date.UTC(2026, 8, 18, 4, 0, 0) // 2026-09-18 12:00 Asia/Shanghai（非静音）

describe('同文错误聚合（P0 时间线防刷屏，2026-11-16 事故防复发）', () => {
  const ERR = '唤醒失败（reactive）：Cannot read properties of undefined (reading \'signal\')'

  it('首拍 → append 原样落行（count=1，可观测性优先）', () => {
    const d = errorAggDecision(undefined, ERR, '2026-11-16T01:00:00.000Z')
    expect(d.kind).toBe('append')
    expect(d.agg).toEqual({ content: ERR, count: 1, firstTs: '2026-11-16T01:00:00.000Z', lastTs: '2026-11-16T01:00:00.000Z' })
  })

  it('同文重复 → count 只计数不落行；每 50 拍才置 digest', () => {
    let agg = errorAggDecision(undefined, ERR, 't1').agg
    for (let n = 2; n <= 49; n++) {
      const d = errorAggDecision(agg, ERR, `t${n}`)
      expect(d.kind).toBe('count')
      if (d.kind !== 'count') return
      expect(d.digest).toBe(false)
      agg = d.agg
    }
    const at50 = errorAggDecision(agg, ERR, 't50')
    expect(at50.kind).toBe('count')
    if (at50.kind === 'count') {
      expect(at50.agg.count).toBe(50)
      expect(at50.digest).toBe(true) // 第 50 拍落一条计数摘要
    }
    const at51 = errorAggDecision(at50.kind === 'count' ? at50.agg : agg, ERR, 't51')
    if (at51.kind === 'count') expect(at51.digest).toBe(false)
  })

  it('内容变化 → flush-and-append：旧账收口 + 新内容按首拍处理', () => {
    const agg = errorAggDecision(undefined, ERR, 't1').agg
    const grown = errorAggDecision(agg, ERR, 't2')
    if (grown.kind !== 'count') throw new Error('expected count')
    const d = errorAggDecision(grown.agg, '唤醒失败（spontaneous）：另一种错误', 't3')
    expect(d.kind).toBe('flush-and-append')
    if (d.kind !== 'flush-and-append') return
    expect(d.flush.content).toBe(ERR)
    expect(d.flush.count).toBe(2)
    expect(d.agg.content).toBe('唤醒失败（spontaneous）：另一种错误')
    expect(d.agg.count).toBe(1)
  })

  it('脏账防护：count<=0 或空内容视同无在账 → append', () => {
    expect(errorAggDecision({ content: ERR, count: 0, firstTs: 'a', lastTs: 'b' }, ERR, 't1').kind).toBe('append')
    expect(errorAggDecision({ content: '', count: 3, firstTs: 'a', lastTs: 'b' }, ERR, 't1').kind).toBe('append')
  })

  it('计数/合计行正文携带次数与首末时间，内容截断 140 字', () => {
    const agg = { content: 'x'.repeat(300), count: 50, firstTs: 'F', lastTs: 'L' }
    const digest = errorAggRowContent(agg, 'digest')
    expect(digest).toContain('×50')
    expect(digest).toContain('首 F 末 L')
    expect(digest.length).toBeLessThan(220)
    const flush = errorAggRowContent(agg, 'flush')
    expect(flush).toContain('同文错误合计')
  })
})

describe('退避阶梯', () => {
  it('自驱地板：默认 5 分钟内不醒（G1「最低 5 分钟一醒」；2026-09-22 成本事故修正）', () => {
    expect(nextDelayMs(cfg, 0)).toBe(300000)
    expect(nextDelayMs(cfg, 1)).toBe(300000)
    expect(nextDelayMs(cfg, 2)).toBe(300000)
    // P1.6 封顶 4h 后阶梯真实生效：L7=5s×2^6=320000 越过地板；L20 到达 4h 封顶
    expect(nextDelayMs(cfg, 7)).toBe(320000)
    expect(nextDelayMs(cfg, 20)).toBe(14400000)
  })

  it('地板可配置：调低地板后回到原阶梯（5s×2^(n-1) 夹 cap）', () => {
    const fast: MindConfig = { ...cfg, minSpontaneousIntervalMs: 5000 }
    expect(nextDelayMs(fast, 0)).toBe(5000)
    expect(nextDelayMs(fast, 1)).toBe(5000)
    expect(nextDelayMs(fast, 2)).toBe(10000)
    expect(nextDelayMs(fast, 7)).toBe(320000)
  })

  it('engaged 归零连转；empty 按 HOLD=3 逐档降', () => {
    const s = state({ backoffLevel: 2, emptiesAtLevel: 0 })
    const engaged = advanceAfterWake(s, 'engaged', cfg)
    expect(engaged.backoffLevel).toBe(0)
    expect(engaged.emptiesAtLevel).toBe(0)
    // HOLD=3：前两次空转停留原档，第三次升档
    const l1 = advanceAfterWake(s, 'empty', cfg)
    expect(l1.backoffLevel).toBe(2)
    expect(l1.emptiesAtLevel).toBe(1)
    const l2 = advanceAfterWake(l1, 'empty', cfg)
    expect(l2.emptiesAtLevel).toBe(2)
    const l3 = advanceAfterWake(l2, 'empty', cfg)
    expect(l3.backoffLevel).toBe(3)
    expect(l3.emptiesAtLevel).toBe(0)
  })

  it('scheduleNextSpontaneous：engaged 后按地板等待；empty 后同样不早于地板', () => {
    const now = 1_000_000
    expect(scheduleNextSpontaneous(state(), cfg, now, 'engaged')).toBe(now + 300000)
    expect(scheduleNextSpontaneous(state({ backoffLevel: 1 }), cfg, now, 'empty')).toBe(now + 300000)
  })
})

describe('机械空醒短路（成本闸）', () => {
  const quiet = { reactiveQueued: false, eventQueued: false, newObservations: 0, lastWasIdle: true }

  it('无新观察、无待办、上一拍亦空转 → 短路（不调用模型）', () => {
    expect(shouldShortCircuitSpontaneous(cfg, state(), quiet)).toBe(true)
  })

  it('有新观察 → 不短路（可能有话要说/有事要做）', () => {
    expect(shouldShortCircuitSpontaneous(cfg, state(), { ...quiet, newObservations: 1 })).toBe(false)
  })

  it('反应性/事件/待批 → 永不短路（G3：回应人永不限速）', () => {
    expect(shouldShortCircuitSpontaneous(cfg, state(), { ...quiet, reactiveQueued: true })).toBe(false)
    expect(shouldShortCircuitSpontaneous(cfg, state(), { ...quiet, eventQueued: true })).toBe(false)
    expect(shouldShortCircuitSpontaneous(cfg, state({ pendingApprovals: 1 }), quiet)).toBe(false)
  })

  it('上一拍非空转 → 不短路（连续思考不被截断）', () => {
    expect(shouldShortCircuitSpontaneous(cfg, state(), { ...quiet, lastWasIdle: false })).toBe(false)
  })

  it('可配置关闭', () => {
    expect(shouldShortCircuitSpontaneous({ ...cfg, idleShortCircuit: false }, state(), quiet)).toBe(false)
  })
})

describe('两级 spend cap', () => {
  it('normal/soft/hard 三档；跨日清零', () => {
    expect(evaluateSpend(state({ spend: { date: '2026-09-18', usedUsd: 0.5, tokensIn: 0, tokensOut: 0, llmCalls: 0 } }), cfg, new Date(NOON))).toBe('normal')
    expect(evaluateSpend(state({ spend: { date: '2026-09-18', usedUsd: 1, tokensIn: 0, tokensOut: 0, llmCalls: 0 } }), cfg, new Date(NOON))).toBe('soft')
    expect(evaluateSpend(state({ spend: { date: '2026-09-18', usedUsd: 5, tokensIn: 0, tokensOut: 0, llmCalls: 0 } }), cfg, new Date(NOON))).toBe('hard')
    expect(evaluateSpend(state({ spend: { date: '2026-09-17', usedUsd: 99, tokensIn: 0, tokensOut: 0, llmCalls: 0 } }), cfg, new Date(NOON))).toBe('normal')
  })

  it('spend hard 阻断 spontaneous，不阻断 reactive；soft 只提示降档', () => {
    const hard = state({ spend: { date: '2026-09-18', usedUsd: 5, tokensIn: 0, tokensOut: 0, llmCalls: 0 }, wakeAt: NOON - 1 })
    expect(collectDueMindTriggers(NOON, hard, cfg, { reactiveQueued: false, eventQueued: false }).fire).toBe(false)
    const reactive = collectDueMindTriggers(NOON, hard, cfg, { reactiveQueued: true, eventQueued: false })
    expect(reactive.fire).toBe(true)
    expect(reactive.trigger).toBe('reactive')
  })

  it('costUsd 按 token×单价核算', () => {
    // 1M in + 1M out → 0.27 + 1.1
    expect(costUsd(cfg, 1_000_000, 1_000_000)).toBeCloseTo(1.37, 6)
  })
})

describe('静音时段', () => {
  it('默认 Asia/Shanghai 01:00–08:00 生效（UTC 17:30=北京 01:30 静音；UTC 04:00=北京 12:00 非静音）', () => {
    expect(isQuietHour(new Date(Date.UTC(2026, 8, 18, 17, 30)), cfg)).toBe(true)
    expect(isQuietHour(new Date(Date.UTC(2026, 8, 18, 4, 0)), cfg)).toBe(false)
  })
  it('enabled=false 或非法时区：不静音 / 兜底退回 UTC 判定', () => {
    const off = { ...cfg, quietHours: { ...cfg.quietHours, enabled: false } }
    expect(isQuietHour(new Date(Date.UTC(2026, 8, 18, 17, 30)), off)).toBe(false)
    const badTz = { ...cfg, quietHours: { ...cfg.quietHours, tz: 'Not/AZone' } }
    // 非法时区 → Intl 抛错 → 兜底按 UTC 判定：UTC 17:30 ∉ [01:00,08:00) → false
    expect(isQuietHour(new Date(Date.UTC(2026, 8, 18, 17, 30)), badTz)).toBe(false)
    expect(isQuietHour(new Date(Date.UTC(2026, 8, 18, 2, 0)), badTz)).toBe(true) // UTC 02:00 ∈ 窗口
  })
})

describe('触发收集', () => {
  it('显式停止压倒一切', () => {
    const s = state({ stoppedByMaster: true, wakeAt: NOON - 1 })
    const d = collectDueMindTriggers(NOON, s, cfg, { reactiveQueued: true, eventQueued: true })
    expect(d.fire).toBe(false)
  })

  it('优先级 event > reactive > watchdog > spontaneous', () => {
    const due = state({ wakeAt: NOON - 1, lastWakeAt: NOON - 7200000 })
    const all = collectDueMindTriggers(NOON, due, cfg, { reactiveQueued: true, eventQueued: true })
    expect(all.trigger).toBe('event')
    const react = collectDueMindTriggers(NOON, due, cfg, { reactiveQueued: true, eventQueued: false })
    expect(react.trigger).toBe('reactive')
    const wd = collectDueMindTriggers(NOON, due, cfg, { reactiveQueued: false, eventQueued: false })
    // due 也到点，但 watchdog 静默（2×timeout=20min）优先级在 spontaneous 之前判定
    expect(wd.trigger).toBe('watchdog')
  })

  it('未到点不触发；quiet hours 阻断 spontaneous 但保留 reactive', () => {
    const notDue = state({ wakeAt: NOON + 60000 })
    expect(collectDueMindTriggers(NOON, notDue, cfg, { reactiveQueued: false, eventQueued: false }).fire).toBe(false)
    const quietTs = Date.UTC(2026, 8, 18, 17, 30) // 北京 01:30 静音
    const quiet = state({ wakeAt: quietTs - 1 })
    const d = collectDueMindTriggers(quietTs, quiet, cfg, { reactiveQueued: false, eventQueued: false })
    expect(d.fire).toBe(false)
    const react = collectDueMindTriggers(quietTs, quiet, cfg, { reactiveQueued: true, eventQueued: false })
    expect(react.fire).toBe(true)
  })
})

describe('dayKey', () => {
  it('ISO 日期键', () => {
    expect(dayKey(new Date(NOON))).toBe('2026-09-18')
  })
})

describe('P0 止血：watchdog 后置（静音/硬顶优先）', () => {
  it('静音期内不合成 watchdog 唤醒（夜间成本洞修复）', () => {
    const quietNight = Date.UTC(2026, 8, 18, 18, 0, 0) // 2026-09-19 02:00 Asia/Shanghai（静音中）
    const stalled = quietNight - cfg.wakeTimeoutMs * 3 // 静默已超 2×硬超时
    const s = state({ lastWakeAt: stalled, wakeAt: quietNight + 60000 })
    const d = collectDueMindTriggers(quietNight, s, cfg, { reactiveQueued: false, eventQueued: false })
    expect(d.fire).toBe(false)
    expect(d.reason).toBe('quiet hours')
  })
  it('非静音、未触硬顶时 watchdog 照常触发（存活探针保留）', () => {
    const s = state({ lastWakeAt: NOON - cfg.wakeTimeoutMs * 3 })
    const d = collectDueMindTriggers(NOON, s, cfg, { reactiveQueued: false, eventQueued: false })
    expect(d.fire).toBe(true)
    expect(d.trigger).toBe('watchdog')
  })
  it('watchdog 让位 spend 硬顶：硬顶期不合成唤醒', () => {
    const s = state({
      lastWakeAt: NOON - cfg.wakeTimeoutMs * 3,
      spend: { date: dayKey(new Date(NOON)), usedUsd: 5, tokensIn: 0, tokensOut: 0, llmCalls: 0 },
    })
    const d = collectDueMindTriggers(NOON, s, cfg, { reactiveQueued: false, eventQueued: false })
    expect(d.fire).toBe(false)
    expect(d.reason).toBe('spend hard cap')
  })
})

describe('P0 止血：C1 软顶节流', () => {
  it('过软顶后自驱间隔 ≥ 地板×3（默认 15 分钟）', () => {
    const soft = state({ spend: { date: dayKey(new Date(NOON)), usedUsd: 1.5, tokensIn: 0, tokensOut: 0, llmCalls: 0 } })
    const next = scheduleNextSpontaneous(soft, cfg, NOON, 'empty')
    expect(next - NOON).toBeGreaterThanOrEqual(900000)
  })
  it('未过软顶保持地板 5 分钟（对照）', () => {
    const next = scheduleNextSpontaneous(state(), cfg, NOON, 'empty')
    expect(next - NOON).toBe(300000)
  })
})

describe('P0 止血：被拒审批 24h 滚动衰减（decayRejections）', () => {
  it('窗口外剔除、窗口内保留、未来时间戳丢弃（脏数据防御）', () => {
    const now = Date.UTC(2026, 8, 18, 4, 0, 0)
    const h = 3600000
    const out = decayRejections([now - 25 * h, now - 23 * h, now - h, now + h], now)
    expect(out).toEqual([now - 23 * h, now - h])
  })
  it('空列表幂等', () => {
    const now = Date.UTC(2026, 8, 18, 4, 0, 0)
    expect(decayRejections([], now)).toEqual([])
  })
})