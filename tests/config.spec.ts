/**
 * 配置 fail-safe 测试：解析失败回落默认（保守运行）、非法键夹紧、
 * 软硬顶次序修正。kill switch（显式停）在 state 层，与配置独立。
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let dshHome = ''
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => mkdtempSync(join(tmpdir(), 'dsh-cfg-home-')) }
})

beforeEach(() => {
  dshHome = mkdtempSync(join(tmpdir(), 'dsh-cfg-state-'))
  process.env.DSH_HOME = dshHome
  vi.resetModules()
})

describe('mergeMindConfig 合并', () => {
  it('非法类型回落默认、边界夹紧、软硬顶次序修正', async () => {
    const { mergeMindConfig } = await import('../src/config.ts')
    const m = mergeMindConfig({
      enabled: 'yes', backoffBaseMs: 1, backoffCapMs: 999999999, hold: 0,
      spendSoftCapUsd: 5, spendHardCapUsd: 1, quietHours: { tz: 'Bad/Zone', start: 'bad' },
    })
    expect(m.enabled).toBe(true) // 非 boolean → 默认 true
    expect(m.backoffBaseMs).toBe(1000)
    expect(m.backoffCapMs).toBe(86400000)
    expect(m.hold).toBe(1)
    expect(m.spendHardCapUsd).toBe(5) // 硬顶 < 软顶 → 修正为软顶值
    expect(m.quietHours.tz).toBe('Bad/Zone') // 非空字符串保留（使用时 Intl 兜底退回 UTC）
    expect(m.quietHours.start).toBe('01:00') // 非法格式 → 默认
  })

  it('合法键生效（quietHours 部分覆盖保留默认其余字段）', async () => {
    const { mergeMindConfig } = await import('../src/config.ts')
    const m = mergeMindConfig({ quietHours: { enabled: false }, presetId: 'digital-twin' })
    expect(m.quietHours.enabled).toBe(false)
    expect(m.quietHours.tz).toBe('Asia/Shanghai')
    expect(m.presetId).toBe('digital-twin')
  })
})

describe('loadMindConfig fail-safe', () => {
  it('配置文件不存在 → 全默认；写坏 JSON → 全默认（不抛）', async () => {
    const { loadMindConfig, mindHome } = await import('../src/config.ts')
    expect(loadMindConfig(Date.now()).enabled).toBe(true)
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(dshHome, 'dsh-mind'), { recursive: true })
    writeFileSync(join(dshHome, 'dsh-mind', 'config.json'), '{broken json!!', 'utf8')
    const broken = loadMindConfig(Date.now() + 60000)
    expect(broken.enabled).toBe(true)
    expect(broken.backoffCapMs).toBe(300000)
  })
})
