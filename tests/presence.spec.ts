/**
 * P1 会话在场让位测试（分类纯函数 + 让位闸全分支，G8 时钟注入）。
 * 事故背景：心智与主人的活动会话抢工作（工作区写冲突/任务板争用/重复劳动）
 * ——在场闸让 master-facing 在场时自发放位，reactive/event 永不让位（G3）。
 */
import { describe, expect, it } from 'vitest'
import { classifyPresence, type SessionItem } from '../src/presence.ts'
import { CONFIG_DEFAULTS, type MindConfig } from '../src/config.ts'
import { collectDueMindTriggers, presenceGate, decayRejections, type SchedulerState } from '../src/scheduler.ts'

const cfg: MindConfig = JSON.parse(JSON.stringify(CONFIG_DEFAULTS))
const NOON = Date.UTC(2026, 8, 18, 4, 0, 0) // 12:00 Asia/Shanghai（非静音）

function state(overrides: Partial<SchedulerState> = {}): SchedulerState {
  return {
    backoffLevel: 0, emptiesAtLevel: 0, wakeAt: NOON, lastWakeAt: NOON - 60000,
    stoppedByMaster: false, lastSeq: 0,
    spend: { date: '2026-09-18', usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 },
    reactive: { windowStart: 0, count: 0 },
    ...overrides,
  }
}

const item = (over: Partial<SessionItem> = {}): SessionItem => ({ sessionId: 's-1', running: true, ...over })

describe('classifyPresence（三态保守伞）', () => {
  it('空闲会话与自身不计入在场', () => {
    const r = classifyPresence(
      [item({ sessionId: 's-idle', running: false }), item({ sessionId: 'self', running: true })],
      new Set(), new Set(['self']),
    )
    expect(r.strongest).toBe('none')
    expect(r.peers).toEqual([])
  })
  it('交互会话 → master-facing（保守伞：IM/未知来源一并收入）', () => {
    const r = classifyPresence(
      [item({ sessionId: 's-master' }), item({ sessionId: 's-im', origin: 'im' })],
      new Set(), new Set(),
    )
    expect(r.strongest).toBe('master-facing')
    expect(r.peers.every(p => p.kind === 'master-facing')).toBe(true)
  })
  it('看板运行中任务 → task-execution；子代理 → background', () => {
    const r = classifyPresence(
      [item({ sessionId: 'task-1' }), item({ sessionId: 'sub-1', origin: 'subagent' })],
      new Set(['task-1']), new Set(),
    )
    expect(r.strongest).toBe('background')
    expect(r.peers.map(p => p.kind)).toContain('task-execution')
    expect(r.peers.map(p => p.kind)).toContain('background')
  })
  it('master-facing 优先于 background（有人在被服务 > 委派工作在跑）', () => {
    const r = classifyPresence(
      [item({ sessionId: 'sub-1', origin: 'subagent' }), item({ sessionId: 's-master' })],
      new Set(), new Set(),
    )
    expect(r.strongest).toBe('master-facing')
  })
})

describe('presenceGate（让位闸全分支）', () => {
  const NO_GATE = { trigger: undefined as never }

  it('spontaneous：master-facing → defer', () => {
    const g = presenceGate({ trigger: 'spontaneous', strongest: 'master-facing', observeDueAt: undefined, now: NOON })
    expect(g.action).toBe('defer')
  })
  it('spontaneous：background → 照常（任务执行会话不触发硬让位）', () => {
    const g = presenceGate({ trigger: 'spontaneous', strongest: 'background', observeDueAt: undefined, now: NOON })
    expect(g.action).toBe('pass')
  })
  it('reactive：永不让位（G3 回应人不限速）', () => {
    for (const strongest of ['master-facing', 'background', 'none'] as const) {
      const g = presenceGate({ trigger: 'reactive', strongest, observeDueAt: undefined, now: NOON })
      expect(g.action).toBe('pass')
    }
  })
  it('observe 到点 → observe 拍', () => {
    const g = presenceGate({ trigger: 'spontaneous', strongest: 'master-facing', observeDueAt: NOON - 1, now: NOON })
    expect(g.action).toBe('observe')
  })
})

describe('decayRejections（P0 回归锚）', () => {
  it('24h 窗口外剔除', () => {
    const now = Date.UTC(2026, 8, 18, 4, 0, 0)
    expect(decayRejections([now - 25 * 3600000, now - 3600000], now)).toEqual([now - 3600000])
  })
})
