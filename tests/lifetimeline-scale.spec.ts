/**
 * P4 时间轴语义缩放纯函数测试。
 * 全部用本地 Date 构造断言（组件按本地时区渲染，断言天然时区安全）。
 */
import { describe, expect, it } from 'vitest'
import { bucketStart, levelForSpan, nextBucketStart, ticksForRange, type ScaleLevel } from '../src/lifetimeline-scale.ts'

const DAY = 86_400_000

describe('levelForSpan', () => {
  it('跨度语义分级', () => {
    expect(levelForSpan(3 * 365 * DAY)).toBe('year')
    expect(levelForSpan(200 * DAY)).toBe('month')
    expect(levelForSpan(20 * DAY)).toBe('week')
    expect(levelForSpan(3 * DAY)).toBe('day')
    expect(levelForSpan(12 * 3_600_000)).toBe('hour')
  })
})

describe('bucketStart', () => {
  it('年/月/日/时 归桶（本地时区）', () => {
    const t = new Date(2026, 8, 23, 15, 42).getTime() // 2026-09-23 15:42 本地
    expect(bucketStart('year', t)).toBe(new Date(2026, 0, 1).getTime())
    expect(bucketStart('month', t)).toBe(new Date(2026, 8, 1).getTime())
    expect(bucketStart('day', t)).toBe(new Date(2026, 8, 23).getTime())
    expect(bucketStart('hour', t)).toBe(new Date(2026, 8, 23, 15).getTime())
  })
  it('周桶从周一起算', () => {
    const wed = new Date(2026, 8, 23, 10, 0) // 2026-09-23 是周三
    const mon = bucketStart('week', wed.getTime())
    expect(new Date(mon).getDay()).toBe(1)
    expect(new Date(mon).getDate()).toBe(21)
  })
  it('nextBucketStart：月桶推进到下月 1 日', () => {
    const b = new Date(2026, 8, 1).getTime()
    expect(new Date(nextBucketStart('month', b)).getMonth()).toBe(9)
  })
})

describe('ticksForRange', () => {
  it('年刻度落在整年边界', () => {
    const ticks = ticksForRange('year', new Date(2024, 3, 1).getTime(), new Date(2027, 2, 1).getTime())
    expect(ticks.map(t => t.label)).toEqual(['2024年', '2025年', '2026年', '2027年'])
  })
  it('月刻度逐月推进', () => {
    const ticks = ticksForRange('month', new Date(2026, 0, 15).getTime(), new Date(2026, 2, 15).getTime())
    expect(ticks.map(t => t.label)).toEqual(['1月', '2月', '3月'])
  })
  it('日刻度逐日推进', () => {
    const ticks = ticksForRange('day', new Date(2026, 8, 22).getTime(), new Date(2026, 8, 24).getTime())
    expect(ticks.length).toBe(3)
    expect(ticks[1]!.label).toBe('9/23')
  })
})
