/**
 * 心智工具测试：注册形状 / status 直读 / timeline 旧→新 / say 服务注入与缺席降级
 * （DSH_HOME 隔离临时目录，timeline.spec 同款模式）。
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let home = ''
let dshHome = ''

vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => home }
})

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'dsh-mind-tools-home-'))
  dshHome = mkdtempSync(join(tmpdir(), 'dsh-mind-tools-state-'))
  process.env.DSH_HOME = dshHome
})

afterEach(() => {
  delete process.env.DSH_HOME
  vi.resetModules()
})

interface RegisteredTool {
  name: string
  description: string
  parameters: object
  output: { schema: object; render: (args: unknown, value: unknown) => Array<{ type: string; text?: string }> }
  execute: (args: unknown) => Promise<unknown>
}

function makeCtx(opts: { mindService?: { injectObservation: (...a: unknown[]) => void } } = {}): {
  tools: { register: ReturnType<typeof vi.fn> }
  get: (name: string) => unknown
} {
  const tools = { register: vi.fn() }
  return {
    tools,
    get: (name: string) => (name === 'dsh-mind' ? opts.mindService : undefined),
  }
}

async function registered(): Promise<Map<string, RegisteredTool>> {
  const { apply } = await import('../src/tools.ts')
  const ctx = makeCtx()
  apply(ctx as never)
  const list = ctx.tools.register.mock.calls.map(c => c[0] as RegisteredTool)
  return new Map(list.map(t => [t.name, t]))
}

describe('mind 工具注册（preset 行 @dsh-extra/dsh-mind/tools）', () => {
  it('注册 mind_status / mind_timeline / mind_say 三个工具', async () => {
    const map = await registered()
    expect([...map.keys()].sort()).toEqual(['mind_say', 'mind_status', 'mind_timeline'])
    for (const t of map.values()) {
      expect(t.description.length).toBeGreaterThan(10)
      expect(t.output).toBeDefined()
      expect(typeof t.output.render).toBe('function')
      expect(typeof t.execute).toBe('function')
    }
  })

  it('mind_status：空数据目录回落默认且 ok', async () => {
    const map = await registered()
    const v = await map.get('mind_status')!.execute({}) as { ok: boolean; enabled: boolean; spend?: { usedUsd: number } }
    expect(v.ok).toBe(true)
    expect(v.enabled).toBe(true)
    expect(v.spend?.usedUsd).toBe(0)
    // render 不抛且产出中文文本
    const blocks = map.get('mind_status')!.output.render({}, v)
    expect(blocks[0]?.text).toContain('心智运行中')
  })

  it('mind_timeline：步骤按旧→新返回，limit 夹紧；render 输出行文本', async () => {
    const { appendStep } = await import('../src/timeline.ts')
    appendStep({ v: 2, seq: 1, ts: '2026-09-28T01:00:00.000Z', type: 'thought', source: 'mind', content: '第一步' })
    appendStep({ v: 2, seq: 2, ts: '2026-09-28T02:00:00.000Z', type: 'wake', source: 'mind', content: '第二步', fn: 'act' })
    const map = await registered()
    const v = await map.get('mind_timeline')!.execute({ limit: 99 }) as { ok: boolean; count: number; steps: string[] }
    expect(v.ok).toBe(true)
    expect(v.count).toBe(2)
    expect(v.steps[0]).toContain('#1')
    expect(v.steps[1]).toContain('#2')
    const blocks = map.get('mind_timeline')!.output.render({}, v)
    expect(blocks[0]?.text).toContain('#1')
  })

  it('mind_say：空文本拒绝；服务缺席显式降级；在位时注入并带 agent 来源', async () => {
    const map = await registered()
    const say = map.get('mind_say')!
    expect(await say.execute({ text: '  ' })).toMatchObject({ ok: false })
    expect(await say.execute({ text: 'x'.repeat(2001) })).toMatchObject({ ok: false })

    const absent = await say.execute({ text: '你好' }) as { ok: boolean; error?: string }
    expect(absent.ok).toBe(false)
    expect(absent.error).toContain('dsh-mind 服务缺席')

    const injectObservation = vi.fn()
    const ctx2 = makeCtx({ mindService: { injectObservation } })
    // 直接重注册到一个带服务的 ctx：复用 registerMindTools 的闭包语义
    const { registerMindTools } = await import('../src/tools.ts')
    registerMindTools(ctx2 as never)
    const say2 = ctx2.tools.register.mock.calls.map(c => c[0] as RegisteredTool).find(t => t.name === 'mind_say')!
    const ok = await say2.execute({ text: '记得看一下天气' }) as { ok: boolean }
    expect(ok.ok).toBe(true)
    expect(injectObservation).toHaveBeenCalledTimes(1)
    expect(injectObservation.mock.calls[0]?.[0]).toBe('主人')
    expect(injectObservation.mock.calls[0]?.[1]).toBe('记得看一下天气')
  })
})
