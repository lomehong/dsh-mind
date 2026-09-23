/** missions.md 往返测试（DSH_HOME 临时目录隔离）。 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadMissions, saveMissions } from '../src/missions.ts'

const dir = mkdtempSync(join(tmpdir(), 'dsh-mind-missions-'))
process.env.DSH_HOME = dir
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

describe('missions', () => {
  it('缺文件 → 空串', () => {
    expect(loadMissions()).toBe('')
  })
  it('写入后读回（trim）', () => {
    saveMissions('\n跟进 G4 登记包\n关注套件健康度\n')
    expect(loadMissions()).toBe('跟进 G4 登记包\n关注套件健康度')
  })
  it('截断上限 4000 字', () => {
    saveMissions('x'.repeat(5000))
    expect(loadMissions().length).toBe(4000)
  })
})
