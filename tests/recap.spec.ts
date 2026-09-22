/**
 * 分层 recap 测试：F=10 几何粗化、聚合画像、生命概览渲染（P3 机械卷积零成本版）。
 */
import { describe, expect, it } from 'vitest'
import { CONFIG_DEFAULTS } from '../src/config.ts'
import { recapTiers, renderLifeRecap, rollupSpan, topKeywords } from '../src/recap.ts'
import type { TimelineStep } from '../src/timeline.ts'

function step(seq: number, content: string, type: TimelineStep['type'] = 'thought'): TimelineStep {
  const base = Date.UTC(2026, 8, 18, 0, 0, 0) + seq * 60000
  return {
    v: 2, seq, ts: new Date(base).toISOString(), type, source: 'mind', content,
    ...(type === 'wake' ? { fn: 'think', final: `交接棒 ${seq}` } : {}),
  }
}

describe('topKeywords', () => {
  it('CJK 2-gram + 整段(≤4字) + 拉丁词计数，停用词过滤，降序取前 N', () => {
    const kws = topKeywords([
      '发布会安排在 3月1日', '发布会物料清单', '发布会 rehearsal for Q3 launch',
    ], 3)
    // 短 run 整段保留（发布会）；长 run 切 2-gram（发布/布会 各命中 2 次并列第一）；
    // limit=3 下 q3（1 次）排在并列 2 次的词元之后
    expect(kws[0]).toBe('发布')
    expect(kws).toContain('布会')
  })
})

describe('rollupSpan / recapTiers', () => {
  it('span 聚合画像：mix 降序（wake 按 fn 细分）+ 关键词 + 最后交接棒', () => {
    const steps = [
      step(1, '查 Q3 数据', 'wake'),
      step(2, '数据已入库', 'observation'),
      step(3, '把结论发给 alice', 'wake'),
    ]
    const entry = rollupSpan(steps)
    expect(entry.span).toBe(3)
    expect(entry.mix).toContain('wake:think:2')
    expect(entry.mix).toContain('observation:1')
    expect(entry.keywords).toContain('q3')
    expect(entry.lastFinal).toBe('交接棒 3')
  })

  it('F=10 几何粗化：25 步 → tier1 两条聚合，不足 fanout 不再向上', () => {
    const steps = Array.from({ length: 25 }, (_, i) => step(i + 1, `步骤 ${i + 1}`, i % 3 === 0 ? 'wake' : 'observation'))
    const tiers = recapTiers(steps, 10)
    expect(tiers).toHaveLength(1)
    expect(tiers[0]!.length).toBe(2)
    expect(tiers[0]![0]!.span).toBe(10)
  })

  it('50 步 → tier1 五条；tier2 需 ≥fanout 条 tier1（≥100 步）才出现', () => {
    const steps = Array.from({ length: 50 }, (_, i) => step(i + 1, `步骤 ${i + 1}`))
    const tiers = recapTiers(steps, 10)
    expect(tiers).toHaveLength(1)
    expect(tiers[0]!.length).toBe(5)
    expect(tiers[0]![0]!.span).toBe(10)
    const more = Array.from({ length: 120 }, (_, i) => step(i + 1, `步骤 ${i + 1}`))
    const tiers120 = recapTiers(more, 10)
    expect(tiers120).toHaveLength(2)
    expect(tiers120[1]!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('renderLifeRecap', () => {
  it('不足一层（<10 步）返回空串（尾部明细已覆盖，零 token）', () => {
    const steps = Array.from({ length: 5 }, (_, i) => step(i + 1, `步骤 ${i + 1}`))
    expect(renderLifeRecap(steps, CONFIG_DEFAULTS)).toBe('')
  })

  it('25 步渲染生命概览头 + 分层线；条目超 12 行均匀采样', () => {
    const steps = Array.from({ length: 25 }, (_, i) => step(i + 1, `步骤 ${i + 1} 关于部署`))
    const out = renderLifeRecap(steps, CONFIG_DEFAULTS)
    expect(out).toContain('## 生命概览（全部 25 步')
    expect(out).toContain('第1层')
    const lines = out.split('\n').filter(l => l.startsWith('- 第'))
    expect(lines.length).toBe(2)
  })
})
