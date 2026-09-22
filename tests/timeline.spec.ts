/**
 * 时间线测试：追加/半行容错读尾/滚动归档（DSH_HOME 隔离临时目录，DSH-memory 同款模式）。
 */
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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
  home = mkdtempSync(join(tmpdir(), 'dsh-tl-home-'))
  dshHome = mkdtempSync(join(tmpdir(), 'dsh-tl-state-'))
  process.env.DSH_HOME = dshHome
})

afterEach(() => {
  delete process.env.DSH_HOME
})

function step(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 2, seq: 1, ts: '2026-09-18T10:00:00.000Z', type: 'thought',
    source: 'mind', content: '测试步骤', ...overrides,
  }
}

describe('时间线追加与半行容错', () => {
  it('追加后按新→旧读回；坏尾行被跳过并计数', async () => {
    const { appendStep, readTail, timelinePath } = await import('../src/timeline.ts')
    appendStep(step({ seq: 1, content: 'a' }) as never)
    appendStep(step({ seq: 2, content: 'b' }) as never)
    // 模拟崩溃残留半行
    appendFileSync(timelinePath(), '{"v":2,"seq":3,"ts":"2026-09-18T10', { encoding: 'utf8' })
    const { steps, skippedBadTail } = readTail(10)
    expect(skippedBadTail).toBe(1)
    expect(steps.map(s => s.seq)).toEqual([2, 1])
    expect(steps[0]!.content).toBe('b')
  })

  it('空文件读尾返回空', async () => {
    const { readTail } = await import('../src/timeline.ts')
    expect(readTail(10)).toEqual({ steps: [], skippedBadTail: 0 })
  })
})

describe('滚动归档', () => {
  it('把超期步骤移入按月归档件，新步骤留在主文件', async () => {
    const { appendStep, archiveOldSteps, readTail, archivePath } = await import('../src/timeline.ts')
    const now = new Date('2026-09-18T10:00:00.000Z')
    appendStep(step({ seq: 1, ts: '2026-03-01T00:00:00.000Z', content: '旧步骤' }) as never)
    appendStep(step({ seq: 2, ts: '2026-09-18T09:00:00.000Z', content: '新步骤' }) as never)
    const archived = archiveOldSteps(180, now)
    expect(archived).toBe(1)
    const { steps } = readTail(10)
    expect(steps.map(s => s.content)).toEqual(['新步骤'])
    const arch = JSON.parse(`[${readFileSync(archivePath('2026-03'), 'utf8').trim().split('\n').join(',')}]`) as Array<{ content: string }>
    expect(arch).toHaveLength(1)
    expect(arch[0]!.content).toBe('旧步骤')
  })

  it('无超期步骤时零归档零重写', async () => {
    const { appendStep, archiveOldSteps, timelinePath } = await import('../src/timeline.ts')
    appendStep(step({ seq: 1, ts: '2026-09-18T09:00:00.000Z' }) as never)
    const before = readFileSync(timelinePath(), 'utf8')
    expect(archiveOldSteps(180, new Date('2026-09-18T10:00:00.000Z'))).toBe(0)
    expect(readFileSync(timelinePath(), 'utf8')).toBe(before)
  })
})
