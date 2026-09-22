/**
 * 唤醒提示词装配测试：函数菜单完整性、注入数据渲染、
 * 守卫兜底、半行/超长截断。
 */
import { describe, expect, it } from 'vitest'
import { buildWakePrompt, FALLBACK_GUARD, formatStepLine, FUNCTION_MENU } from '../src/wake-prompt.ts'
import type { TimelineStep } from '../src/timeline.ts'

const NOW = new Date('2026-09-18T04:00:00.000Z')

function tailStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
  return {
    v: 2, seq: 1, ts: '2026-09-18T03:59:00.000Z', type: 'thought',
    source: 'mind', content: '测试思绪', ...overrides,
  }
}

describe('buildWakePrompt', () => {
  it('包含函数菜单全部七个函数 + 输出格式 + 守卫', () => {
    const p = buildWakePrompt({ identityName: '分身', tail: [], now: NOW })
    for (const fn of ['act', 'share', 'think', 'learn', 'recall', 'goals', 'idle']) {
      expect(p).toContain(`**${fn}**`)
    }
    expect(p).toContain(FALLBACK_GUARD)
    expect(p).toContain('FINAL=')
  })

  it('渲染待处理消息/时间线/上次交接棒/记忆；无数据时省略对应区块', () => {
    const full = buildWakePrompt({
      identityName: '分身',
      guard: 'GUARD-MARKER',
      persona: 'PERSONA-MARKER',
      tail: [
        tailStep({ seq: 1, type: 'wake', fn: 'act', final: '做完 X', content: 'X 已完成' }),
        tailStep({ seq: 2, content: '新思绪' }),
      ],
      lastFinal: 'LAST-FINAL-MARKER',
      memories: ['记忆 A', '记忆 B'],
      pendingMessages: [{ from: 'alice', text: '帮我查 Y' }],
      now: NOW,
    })
    expect(full).toContain('GUARD-MARKER')
    expect(full).toContain('PERSONA-MARKER')
    expect(full).toContain('待处理消息（压倒菜单，优先 act）')
    expect(full).toContain('帮我查 Y')
    expect(full).toContain('上次交接棒')
    expect(full).toContain('LAST-FINAL-MARKER')
    expect(full).toContain('记忆 A')
    expect(full).not.toContain('FALLBACK_GUARD')

    const bare = buildWakePrompt({ identityName: '分身', tail: [], now: NOW })
    expect(bare).not.toContain('## 待处理消息')
    expect(bare).not.toContain('## 上次交接棒')
    expect(bare).not.toContain('## 相关记忆')
    expect(bare).toContain('你是主人的数字分身')
  })

  it('超长 content 截断到 140+…', () => {
    const line = formatStepLine(tailStep({ content: 'x'.repeat(300) }))
    expect(line.length).toBeLessThan(160)
    expect(line.endsWith('…')).toBe(true)
  })
})
