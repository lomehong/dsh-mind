/**
 * P4 测试：goals 精化提取 + 时间线分页。
 */
import { describe, expect, it } from 'vitest'
import { extractGoalEntries, goalMarkerOf, settleGoals } from '../src/goals.ts'
import { paginateSteps } from '../src/timeline.ts'
import type { TimelineStep } from '../src/timeline.ts'

function step(seq: number, content: string, type = 'thought'): TimelineStep {
  return { v: 2, seq, ts: new Date(Date.UTC(2026, 8, 23, 2, seq)).toISOString(), type: type as TimelineStep['type'], source: 'mind', content }
}

describe('goals 提取', () => {
  it('识别 [目标] 活跃标记，忽略非目标内容', () => {
    expect(goalMarkerOf('[目标] 学完 Rust')).toBe('active')
    expect(goalMarkerOf('[目标·完成] 学完 Rust')).toBe('done')
    expect(goalMarkerOf('[目标·放弃] 搬家')).toBe('dropped')
    expect(goalMarkerOf('普通 thought')).toBeNull()
  })
  it('提取活跃目标并剥离标记', () => {
    const goals = extractGoalEntries([
      { content: '[目标] 把 dsh 套件装进盒子里', ts: '2026-09-23T01:00:00Z' },
      { content: '普通记录' },
      { content: '[目标] ', ts: '2026-09-23T01:01:00Z' },
    ])
    expect(goals.length).toBe(1)
    expect(goals[0]!.title).toBe('把 dsh 套件装进盒子里')
  })
  it('结清：完成记录晚于建立 → 移除；早于 → 仍活跃（重复立目标）', () => {
    const entries = [
      { content: '[目标] 学 Rust', ts: '2026-09-20T01:00:00Z' },
      { content: '[目标·完成] 学 Rust', ts: '2026-09-22T01:00:00Z' },
      { content: '[目标] 重学 Rust', ts: '2026-09-23T01:00:00Z' },
    ]
    const active = settleGoals(extractGoalEntries(entries), entries)
    expect(active.map(g => g.title)).toEqual(['重学 Rust'])
  })
})

describe('时间线分页（只读投影游标）', () => {
  // readTail 实际返回新→旧（seq 降序）——测试数据对齐真实形态
  const steps = Array.from({ length: 30 }, (_, i) => step(30 - i, `s${30 - i}`))
  it('无游标：取最新 limit 条', () => {
    const page = paginateSteps(steps, 10)
    expect(page.length).toBe(10)
    expect(page[0]!.seq).toBe(30) // 新→旧
  })
  it('游标：取 seq < before 的最近 limit 条', () => {
    const page = paginateSteps(steps, 10, 21)
    expect(page[0]!.seq).toBe(20)
    expect(page[9]!.seq).toBe(11)
  })
  it('limit 夹紧到 [1, 200]', () => {
    expect(paginateSteps(steps, 0).length).toBe(1)
    expect(paginateSteps(steps, 999).length).toBe(30)
  })
})
