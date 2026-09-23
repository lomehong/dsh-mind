/** 世界观察差异计算测试。 */
import { describe, expect, it } from 'vitest'
import { diffWorld, fingerprintOf } from '../src/worldwatch.ts'

const base = { taskCols: { 待办: 2, 进行中: 1 }, memoryCount: 40 }

describe('diffWorld', () => {
  it('指纹稳定（同输入同指纹）', () => {
    expect(fingerprintOf(base)).toBe(fingerprintOf({ memoryCount: 40, taskCols: { 进行中: 1, 待办: 2 } }))
  })
  it('首次吸收：不产生描述', () => {
    const d = diffWorld(undefined, base)
    expect(d.desc).toBeNull()
    expect(d.fp).not.toBe('')
  })
  it('无变化：描述为空', () => {
    const first = diffWorld(undefined, base)
    expect(diffWorld(first.fp, base).desc).toBeNull()
  })
  it('看板列数变化 → 描述带增减', () => {
    const first = diffWorld(undefined, base)
    const d = diffWorld(first.fp, { taskCols: { 待办: 3, 进行中: 1 }, memoryCount: 40 })
    expect(d.desc).toContain('「待办」+1')
  })
  it('记忆库增长 → 描述带条数', () => {
    const first = diffWorld(undefined, base)
    const d = diffWorld(first.fp, { ...base, memoryCount: 43 })
    expect(d.desc).toContain('记忆库 +3 条')
  })
  it('列消失也报告（负向变化）', () => {
    const first = diffWorld(undefined, { taskCols: { 进行中: 2 }, memoryCount: 40 })
    const d = diffWorld(first.fp, { taskCols: {}, memoryCount: 40 })
    expect(d.desc).toContain('看板「进行中」-2')
  })
})
