/**
 * P3.2 / P2.1 / 密度治理 测试：
 * - rollups：跨度选择 + 存储往返 + 生命概览摘要行
 * - pendings：入账上限 / 清账边界 / 久悬升级
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { TimelineStep } from '../src/timeline.ts'
import { renderLifeRecap, RECAP_FANOUT } from '../src/recap.ts'
import { appendRollup, readRollups, selectRollupSpan, buildRollupPrompt } from '../src/rollups.ts'
import { pushPending, resolvePendingsBefore, stalePendings } from '../src/pendings.ts'

let dir: string | undefined
try {
  dir = mkdtempSync(join(tmpdir(), 'dsh-mind-rollups-'))
  process.env.DSH_HOME = dir
  vi.mock('node:os', () => ({ homedir: () => dir }))
} catch { /* 环境异常时后续用例自会暴露 */ }
afterAll(() => { if (dir !== undefined) rmSync(dir, { recursive: true, force: true }) })

function step(seq: number, content = `步骤 ${seq}`, type = 'wake'): TimelineStep {
  return { v: 2, seq, ts: new Date(Date.UTC(2026, 8, 23, 1, seq)).toISOString(), type: type as TimelineStep['type'], source: 'mind', content }
}

describe('rollups 跨度选择', () => {
  it('凑满 F 条才给跨度，且取最早 F 条与新游标', () => {
    const steps = Array.from({ length: RECAP_FANOUT + 3 }, (_, i) => step(i + 1))
    const none = selectRollupSpan(steps.slice(0, 4), 0)
    expect(none).toBeNull()
    const sel = selectRollupSpan(steps, 0)
    expect(sel).not.toBeNull()
    expect(sel!.span.length).toBe(RECAP_FANOUT)
    expect(sel!.upToSeq).toBe(RECAP_FANOUT)
    // 游标推进后剩余不足 F → 不再选
    expect(selectRollupSpan(steps, RECAP_FANOUT)).toBeNull()
  })
})

describe('rollups 存储往返', () => {
  it('追加后按新→旧读回，坏行跳过', () => {
    appendRollup({ v: 1, seq: 1, ts: '2026-09-23T01:10:00Z', refs: { steps: [1, 10] }, span: 10, text: '第一段摘要' })
    appendRollup({ v: 1, seq: 2, ts: '2026-09-23T02:20:00Z', refs: { steps: [11, 20] }, span: 10, text: '第二段摘要' })
    const all = readRollups(12)
    expect(all.length).toBe(2)
    expect(all[0]!.text).toBe('第二段摘要') // 新→旧
    expect(all[1]!.refs.steps).toEqual([1, 10])
  })
})

describe('生命概览的 LLM 摘要行', () => {
  it('有摘要时优先呈现摘要行；无摘要且步数不足时为空', () => {
    const steps = Array.from({ length: 60 }, (_, i) => step(i + 1))
    const recap = renderLifeRecap(steps, {} as never, RECAP_FANOUT, [
      { ts: '2026-09-23T01:10:00Z', refs: { steps: [1, 10] }, text: '完成了 G4 复核并立项登记包' },
    ])
    expect(recap).toContain('完成了 G4 复核并立项登记包')
    expect(recap).toContain('#L1~10')
    // 步数不足且无摘要 → 空（省 token）
    expect(renderLifeRecap(steps.slice(0, 3), {} as never, RECAP_FANOUT)).toBe('')
  })
})

describe('rollup 提示词', () => {
  it('含逐条编号步骤与压缩指令', () => {
    const p = buildRollupPrompt([step(3, '复核 G4 并通过'), step(4, '立项登记包', 'thought')])
    expect(p).toContain('#3')
    expect(p).toContain('复核 G4 并通过')
    expect(p).toContain('120 字')
  })
})

describe('P2.1 承诺账', () => {
  it('入账封顶丢最旧', () => {
    let list = pushPending([], { seq: 1, ts: '2026-09-23T01:00:00Z', text: 'a' })
    for (let i = 2; i <= 25; i++) list = pushPending(list, { seq: i, ts: '2026-09-23T02:00:00Z', text: `m${i}` })
    expect(list.length).toBe(20)
    expect(list[0]!.text).toBe('m6') // 最旧的被挤出
  })
  it('清账只结唤醒前挂起的，唤醒期间新来的保留', () => {
    const list = [
      { seq: 1, ts: '2026-09-23T01:00:00Z', text: '唤醒前' },
      { seq: 2, ts: '2026-09-23T01:30:00Z', text: '唤醒中' },
    ]
    const after = resolvePendingsBefore(list, '2026-09-23T01:10:00Z')
    expect(after.length).toBe(1)
    expect(after[0]!.text).toBe('唤醒中')
  })
  it('久悬升级：超 24h 才提醒，最多 3 条', () => {
    const now = Date.UTC(2026, 8, 24, 2, 0, 0)
    const list = [
      { seq: 1, ts: new Date(now - 30 * 3_600_000).toISOString(), text: '旧事一' },
      { seq: 2, ts: new Date(now - 25 * 3_600_000).toISOString(), text: '旧事二' },
      { seq: 3, ts: new Date(now - 2 * 3_600_000).toISOString(), text: '新事' },
      { seq: 4, ts: new Date(now - 50 * 3_600_000).toISOString(), text: '旧事三' },
      { seq: 5, ts: new Date(now - 60 * 3_600_000).toISOString(), text: '旧事四' },
    ]
    const stale = stalePendings(list, now)
    expect(stale.length).toBe(3) // 上限 3
    expect(stale.map(s => s.text)).toEqual(['旧事一', '旧事二', '旧事三'])
  })
})
