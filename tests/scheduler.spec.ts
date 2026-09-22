/**
 * 唤醒调度纯函数测试（设计 §5/§11；G8 确定性用例）。
 * 时钟由调用方注入——无真实 sleep，全部即时断言。
 */
import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS, type MindConfig } from '../src/config.ts'
import {
  advanceAfterWake, collectDueMindTriggers, costUsd, dayKey, evaluateSpend,
  isQuietHour, nextDelayMs, scheduleNextSpontaneous,
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

describe('退避阶梯', () => {
  it('delay(0)=0；delay(n)=min(5s×2^(n-1), 300s)', () => {
    expect(nextDelayMs(cfg, 0)).toBe(0)
    expect(nextDelayMs(cfg, 1)).toBe(5000)
    expect(nextDelayMs(cfg, 2)).toBe(10000)
    expect(nextDelayMs(cfg, 7)).toBe(300000)
    expect(nextDelayMs(cfg, 20)).toBe(300000)
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

  it('scheduleNextSpontaneous：engaged 后立即可再醒；empty 后按档位延迟', () => {
    const now = 1_000_000
    expect(scheduleNextSpontaneous(state(), cfg, now, 'engaged')).toBe(now)
    expect(scheduleNextSpontaneous(state({ backoffLevel: 1 }), cfg, now, 'empty')).toBe(now + 5000)
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
