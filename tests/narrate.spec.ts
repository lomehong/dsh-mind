/** narrate 纯函数测试：机器语义 → 第一人称生活语义的翻译不变量。 */
import { describe, expect, it } from 'vitest'
import { groupByDay, greeting, narrateStep, presenceLine } from '../src/narrate.ts'
import type { TimelineStep } from '../src/timeline.ts'

const step = (over: Partial<TimelineStep>): TimelineStep => ({
  v: 2, seq: 1, ts: '2026-09-20T10:00:00.000Z', type: 'thought', source: 'mind', content: '测试内容', ...over,
})

describe('narrateStep', () => {
  it('message_in → 「你说」气泡，发送者取 refs.from', () => {
    const n = narrateStep(step({ type: 'message_in', source: 'web', content: '在吗', refs: { from: '主人' } }))
    expect(n.kind).toBe('you')
    expect(n.title).toContain('主人')
    expect(n.body).toBe('在吗')
  })

  it('wake idle → 休息（subtle），不渲染正文', () => {
    const n = narrateStep(step({ type: 'wake', fn: 'idle', content: '', final: '[idle] 无事' }))
    expect(n.kind).toBe('rest')
    expect(n.tone).toBe('subtle')
    expect(n.body).toBeUndefined()
  })

  it('wake think → 时刻卡，工程细节入 detail', () => {
    const n = narrateStep(step({
      type: 'wake', fn: 'think', trigger: 'spontaneous', content: '想了想周报',
      final: '[think] 想了想周报', usage: { llmCalls: 1, tokensIn: 5000, tokensOut: 500, costUsd: 0.0031 },
    }))
    expect(n.kind).toBe('moment')
    expect(n.title).toContain('我在想')
    expect(n.body).toBe('[think] 想了想周报')
    expect(n.detail).toContain('spontaneous')
    expect(n.detail).toContain('$0.0031')
  })

  it('error → 温和呈现（念头断了 + warn）', () => {
    const n = narrateStep(step({ type: 'error', content: '唤醒失败：超时' }))
    expect(n.kind).toBe('break')
    expect(n.tone).toBe('warn')
    expect(n.title).not.toContain('失败')
  })

  it('未知类型保守回落为 moment，内容不丢', () => {
    const n = narrateStep(step({ type: 'run-summary' as never, content: 'hi' }))
    expect(n.kind).toBe('moment')
    expect(n.body).toBe('hi')
  })

  it('wake 文本形态 idle（fn 被误记 think 的历史数据）→ rest', () => {
    const idleText = '本拍 idle：定时器未到，无变化。\n\nFINAL="[idle] Idle — 定时器未到，继续等待。"'
    const n = narrateStep(step({ type: 'wake', fn: 'think', trigger: 'spontaneous', content: idleText, final: idleText }))
    expect(n.kind).toBe('rest')
    expect(n.title).toBe('我歇了一会儿')
  })

  it('用量 0/0（计量缺失）不渲染假 detail', () => {
    const n = narrateStep(step({
      type: 'wake', fn: 'act', trigger: 'spontaneous', content: '干活', final: '[act] 干了件活',
      usage: { llmCalls: 1, tokensIn: 0, tokensOut: 0, costUsd: 0 },
    }))
    expect(n.kind).toBe('moment')
    expect(n.detail).toBe('spontaneous')
  })
})

describe('groupByDay', () => {
  const now = new Date('2026-09-20T12:00:00.000Z')
  it('天分组：新天在前，天内旧→新，今天/昨天标注', () => {
    const groups = groupByDay([
      step({ seq: 3, ts: '2026-09-20T11:00:00.000Z' }),
      step({ seq: 2, ts: '2026-09-20T09:00:00.000Z' }),
      step({ seq: 1, ts: '2026-09-19T08:00:00.000Z' }),
    ], now)
    expect(groups.map(g => g.label)).toEqual(['今天', '昨天'])
    expect(groups[0]!.steps.map(s => s.seq)).toEqual([2, 3])
    expect(groups[1]!.steps.map(s => s.seq)).toEqual([1])
  })

  it('跨年日期带年份', () => {
    const groups = groupByDay([step({ seq: 1, ts: '2025-12-31T20:00:00.000Z' })], now)
    expect(groups[0]!.label).toContain('2025')
    expect(groups[0]!.label).toContain('月')
  })

  it('连续休息折叠为一条（带次数）', () => {
    const idle = (seq: number, ts: string): TimelineStep => step({ seq, ts, type: 'wake', fn: 'idle', content: '', final: '[idle] 无事' })
    const groups = groupByDay([
      idle(5, '2026-09-20T10:05:00.000Z'),
      idle(4, '2026-09-20T10:04:00.000Z'),
      idle(3, '2026-09-20T10:03:00.000Z'),
      step({ seq: 2, ts: '2026-09-20T10:00:00.000Z', type: 'wake', fn: 'act', content: '干活', final: '[act] 干了活' }),
    ], new Date('2026-09-20T12:00:00.000Z'))
    const todaySteps = groups[0]!.steps
    const rests = todaySteps.filter(s => s.kind === 'rest')
    expect(rests).toHaveLength(1)
    expect(rests[0]!.title).toContain('3 次空醒')
    expect(todaySteps[0]!.kind).toBe('moment')
  })
})

describe('presenceLine', () => {
  const base = { enabled: true, stoppedByMaster: false, running: false, wakeAt: 0 }

  it('主人显式停 → 被叫停的休息', () => {
    expect(presenceLine({ ...base, stoppedByMaster: true })).toContain('你让我停')
  })

  it('配置关闸 → 沉睡', () => {
    expect(presenceLine({ ...base, enabled: false })).toContain('沉睡')
  })

  it('静音时段 → 睡着了（带作息区间）', () => {
    expect(presenceLine({ ...base, quiet: { enabled: true, active: true, start: '01:00', end: '08:00' } })).toContain('01:00–08:00')
  })

  it('运行中 → 正在想事情', () => {
    expect(presenceLine({ ...base, running: true })).toContain('正在想')
  })

  it('硬顶触顶 → 省着用', () => {
    expect(presenceLine({ ...base, spend: { usedUsd: 5, hardCapUsd: 5 } })).toContain('省着用')
  })

  it('有 pending 消息 → 正在准备回应', () => {
    expect(presenceLine({ ...base, pending: 1 })).toContain('准备回应')
  })

  it('有下次排程 → 安静一会儿（分钟数）', () => {
    const now = Date.now()
    expect(presenceLine({ ...base, wakeAt: now + 300000 }, now)).toContain('5 分钟')
  })

  it('兜底 → 我在', () => {
    expect(presenceLine(base)).toBe('我在')
  })
})

describe('greeting', () => {
  it('按小时问候', () => {
    expect(greeting(new Date(2026, 8, 20, 7, 0))).toBe('早上好')
    expect(greeting(new Date(2026, 8, 20, 15, 0))).toBe('下午好')
    expect(greeting(new Date(2026, 8, 20, 20, 0))).toBe('晚上好')
    expect(greeting(new Date(2026, 8, 20, 2, 0))).toBe('夜深了')
  })
})
