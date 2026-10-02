/**
 * 世界观察 v2 纯函数测试（归因代替时限；10-01 唤醒列车事故回归锚）。
 * 事故：指纹只有计数无归因，第三方转写回声每 ~2 分钟一批 → 58 拍 LLM/$0.958。
 * v2：任务 id→列 精确映射 + originBy 归因（心智立项 → selfCaused 搭车消化）。
 */
import { describe, expect, it } from 'vitest'
import { diffWorldV2, fingerprintOf, type WorldCountsV2 } from '../src/worldwatch.ts'

const MIND = 'mind-session-1'

function counts(over: { board?: Array<{ id: string; column: string; originBy?: string }>; memoryCount?: number; memoryMaxSeq?: number } = {}): WorldCountsV2 {
  return {
    board: over.board ?? [],
    memoryCount: over.memoryCount ?? 0,
    memoryMaxSeq: over.memoryMaxSeq,
  }
}

describe('fingerprintOf v2', () => {
  it('任务 id→列 有序映射（顺序无关）', () => {
    const a = fingerprintOf(counts({ board: [{ id: 'TB-1', column: '待办' }, { id: 'TB-2', column: '进行中' }] }))
    const b = fingerprintOf(counts({ board: [{ id: 'TB-2', column: '进行中' }, { id: 'TB-1', column: '待办' }] }))
    expect(a).toBe(b)
  })
  it('同一任务换列 → 指纹变化（列计数 +1/-1 的旧指纹会漏掉对冲流转）', () => {
    const a = fingerprintOf(counts({ board: [{ id: 'TB-1', column: '待办' }, { id: 'TB-2', column: '待办' }] }))
    const b = fingerprintOf(counts({ board: [{ id: 'TB-1', column: '待办' }, { id: 'TB-2', column: '已完成' }] }))
    expect(a).not.toBe(b)
  })
})

describe('diffWorldV2 归因', () => {
  it('心智立项任务的列变化 → selfCaused（搭车消化，不触发唤醒）', () => {
    const prev = fingerprintOf(counts({ board: [{ id: 'TB-9', column: '待审批', originBy: MIND }] }))
    const d = diffWorldV2(prev, counts({ board: [{ id: 'TB-9', column: '进行中', originBy: MIND }] }), new Set([MIND]))
    expect(d.changes).toHaveLength(1)
    expect(d.changes[0]?.selfCaused).toBe(true)
  })
  it('外部任务列变化 → 外部（照常触发）', () => {
    const prev = fingerprintOf(counts({ board: [{ id: 'TB-1', column: '待办' }] }))
    const d = diffWorldV2(prev, counts({ board: [{ id: 'TB-1', column: '进行中' }] }), new Set([MIND]))
    expect(d.changes[0]?.selfCaused).toBe(false)
    expect(d.desc).toContain('TB-1')
  })
  it('第三方对心智立项任务的转写（换列回写）按 originBy 归因为自己', () => {
    // 10-01 列车形态：第三方把心智产出转写回记忆/看板——任务归因以 originBy 为准
    const prev = fingerprintOf(counts({ board: [{ id: 'TB-9', column: '待办', originBy: MIND }] }))
    const d = diffWorldV2(prev, counts({ board: [{ id: 'TB-9', column: '已完成', originBy: MIND }] }), new Set([MIND]))
    expect(d.changes[0]?.selfCaused).toBe(true)
  })
  it('记忆条数变化 → 外部（二次采样确认兜底）', () => {
    const prev = fingerprintOf(counts({ memoryCount: 214 }))
    const d = diffWorldV2(prev, counts({ memoryCount: 219 }), new Set([MIND]))
    expect(d.changes[0]?.desc).toContain('记忆库 +5 条')
    expect(d.changes[0]?.selfCaused).toBe(false)
  })
  it('混合变化：self 与外部逐条分离', () => {
    const prev = fingerprintOf(counts({ board: [{ id: 'TB-9', column: '待办', originBy: MIND }, { id: 'TB-1', column: '待办' }], memoryCount: 10 }))
    const d = diffWorldV2(
      prev,
      counts({ board: [{ id: 'TB-9', column: '进行中', originBy: MIND }, { id: 'TB-1', column: '进行中' }], memoryCount: 12 }),
      new Set([MIND]),
    )
    expect(d.changes).toHaveLength(3)
    expect(d.changes.filter(x => x.selfCaused)).toHaveLength(1)
    expect(d.changes.filter(x => !x.selfCaused)).toHaveLength(2)
  })
  it('首次吸收：指纹落基线、无描述、无 changes', () => {
    const d = diffWorldV2(undefined, counts({ board: [{ id: 'TB-1', column: '待办' }], memoryCount: 3 }), new Set([MIND]))
    expect(d.desc).toBeNull()
    expect(d.changes).toHaveLength(0)
  })
  it('无变化：fp 相同 → null', () => {
    const c = counts({ board: [{ id: 'TB-1', column: '待办' }], memoryCount: 3 })
    const fp = fingerprintOf(c)
    const d = diffWorldV2(fp, c, new Set([MIND]))
    expect(d.desc).toBeNull()
    expect(d.changes).toHaveLength(0)
  })
})
