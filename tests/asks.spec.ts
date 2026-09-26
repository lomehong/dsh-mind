/**
 * P5 请求账（asks）测试：
 * - openAsk：入账 / 同文指纹去重 / cap=10 丢最旧
 * - settleAsk / settleAsksByGoal：显式结算 + 目标销账联动
 * - staleAsks / dueEscalations：久悬判定 + 24h 节流升级
 * - parseAskPayload：FINAL 结构化解析（全半角分隔符/缺省/自由文本兜底）
 * - buildWakePrompt：「等待主人的请求」区块注入
 * 纯函数层，无 DSH_HOME 依赖（G8 确定性）。
 */
import { describe, expect, it } from 'vitest'
import {
  ASKS_CAP,
  dueEscalations,
  openAsk,
  parseAskPayload,
  parseAskSettleIds,
  settleAsk,
  settleAsksByGoal,
  staleAsks,
  type AskEntry,
} from '../src/asks.ts'
import { buildWakePrompt, DEFAULT_PROMPT_BLOCKS } from '../src/wake-prompt.ts'

const H = 3_600_000

function ask(over: Partial<AskEntry> & { id: string; ts: string }): AskEntry {
  return {
    seq: 1,
    what: `请求 ${over.id}`,
    state: 'open',
    notifiedAt: Date.parse(over.ts),
    ...over,
  }
}

describe('openAsk 入账', () => {
  it('新请求追加；同文 open 请求去重（大小写/空白不敏感）且账本不变', () => {
    const a = ask({ id: 'a-1', ts: '2026-09-24T01:00:00Z', what: 'npm 凭据与发布授权' })
    const { list, duplicated } = openAsk([], a)
    expect(duplicated).toBe(false)
    expect(list).toHaveLength(1)
    const again = openAsk(list, ask({ id: 'a-2', ts: '2026-09-24T02:00:00Z', what: '  NPM 凭据与发布授权  ' }))
    expect(again.duplicated).toBe(true)
    expect(again.list).toHaveLength(1)
    expect(again.list[0]!.id).toBe('a-1')
  })

  it('已结清（非 open）的同文不再拦截；超出 cap 丢最旧', () => {
    const settled = ask({ id: 'a-0', ts: '2026-09-24T00:00:00Z', what: 'npm 凭据', state: 'satisfied' })
    expect(openAsk([settled], ask({ id: 'a-1', ts: '2026-09-24T01:00:00Z', what: 'npm 凭据' })).duplicated).toBe(false)
    let list: AskEntry[] = []
    for (let i = 0; i < ASKS_CAP + 3; i += 1) {
      list = openAsk(list, ask({ id: `a-${i}`, ts: '2026-09-24T01:00:00Z', what: `不同的请求 ${i}` })).list
    }
    expect(list).toHaveLength(ASKS_CAP)
    expect(list[0]!.id).toBe('a-3') // 最旧三条被丢
  })
})

describe('结算', () => {
  it('settleAsk 按 id 移除', () => {
    const list = [
      ask({ id: 'a-1', ts: '2026-09-24T01:00:00Z' }),
      ask({ id: 'a-2', ts: '2026-09-24T02:00:00Z' }),
    ]
    expect(settleAsk(list, 'a-1')).toHaveLength(1)
    expect(settleAsk(list, 'a-1')[0]!.id).toBe('a-2')
  })

  it('settleAsksByGoal：目标销账联动只清同题 open 请求', () => {
    const list = [
      ask({ id: 'a-1', ts: '2026-09-24T01:00:00Z', what: 'npm 凭据', goalTitle: '发布 dsh-mind 到 npm' }),
      ask({ id: 'a-2', ts: '2026-09-24T02:00:00Z', what: '实机窗口', goalTitle: '实机验证' }),
      ask({ id: 'a-3', ts: '2026-09-24T03:00:00Z', what: '无关联请求' }),
    ]
    const next = settleAsksByGoal(list, ['发布 dsh-mind 到 npm', '不相关的目标'])
    expect(next.map(a => a.id)).toEqual(['a-2', 'a-3'])
    expect(settleAsksByGoal(list, []).map(a => a.id)).toEqual(['a-1', 'a-2', 'a-3'])
  })
})

describe('久悬与升级节流', () => {
  const now = Date.UTC(2026, 8, 26, 0, 0, 0) // 2026-09-26 00:00Z
  it('staleAsks 只含超过阈值的 open 请求', () => {
    const list = [
      ask({ id: 'old', ts: new Date(now - 25 * H).toISOString() }),
      ask({ id: 'new', ts: new Date(now - 2 * H).toISOString() }),
    ]
    expect(staleAsks(list, now).map(a => a.id)).toEqual(['old'])
  })

  it('dueEscalations：从未升级的久悬必升级；24h 内升级过的不重复', () => {
    const list = [
      ask({ id: 'never', ts: new Date(now - 30 * H).toISOString() }),
      ask({ id: 'recent', ts: new Date(now - 30 * H).toISOString(), lastEscalatedAt: now - 5 * H }),
      ask({ id: 'due', ts: new Date(now - 30 * H).toISOString(), lastEscalatedAt: now - 25 * H }),
      ask({ id: 'fresh', ts: new Date(now - 2 * H).toISOString() }),
    ]
    expect(dueEscalations(list, now).map(a => a.id)).toEqual(['never', 'due'])
  })
})

describe('parseAskPayload', () => {
  it('全格式解析（全角分隔符）', () => {
    const p = parseAskPayload('npm 凭据与发布授权｜为了：完成 npm 发布线｜给了之后：绑定执行窗口发布｜目标：发布 dsh-mind 到 npm')
    expect(p.what).toBe('npm 凭据与发布授权')
    expect(p.why).toBe('完成 npm 发布线')
    expect(p.howto).toBe('绑定执行窗口发布')
    expect(p.goalTitle).toBe('发布 dsh-mind 到 npm')
  })

  it('半角分隔符与缺省段容错；自由文本整体作为 what', () => {
    const p1 = parseAskPayload('实机窗口 | 给了之后：跑实机清单')
    expect(p1.what).toBe('实机窗口')
    expect(p1.why).toBeUndefined()
    expect(p1.howto).toBe('跑实机清单')
    const p2 = parseAskPayload('就想要一个明确的授权答复')
    expect(p2.what).toBe('就想要一个明确的授权答复')
    expect(p2.why).toBeUndefined()
    expect(parseAskPayload('   ').what).toBe('')
  })
})

describe('buildWakePrompt 注入「等待主人的请求」区块', () => {
  it('有 open 请求时注入区块（含 id、悬置时长与 howto）；无请求时不注入', () => {
    const base = {
      identityName: '分身',
      tail: [],
      now: new Date(Date.UTC(2026, 8, 26, 0, 0, 0)),
    }
    const withAsks = buildWakePrompt({
      ...base,
      openAsks: [{ id: 'a-1', ageHours: 30, what: 'npm 凭据与发布授权', howto: '绑定执行窗口发布' }],
    }, DEFAULT_PROMPT_BLOCKS)
    expect(withAsks).toContain('## 等待主人的请求')
    expect(withAsks).toContain('[a-1] 悬置 30 小时：「npm 凭据与发布授权」')
    expect(withAsks).toContain('（给了之后：绑定执行窗口发布）')
    expect(withAsks).toContain('[ask/ok') // 自查销账协议提示

    const withoutAsks = buildWakePrompt({ ...base }, DEFAULT_PROMPT_BLOCKS)
    expect(withoutAsks).not.toContain('## 等待主人的请求')
  })

  it('菜单含 ask 动词与 FINAL [ask] 格式约定', () => {
    const prompt = buildWakePrompt({ identityName: '分身', tail: [], now: new Date() }, DEFAULT_PROMPT_BLOCKS)
    expect(prompt).toContain('**ask**')
    expect(prompt).toContain('[ask]')
  })
})

describe('parseAskSettleIds（[ask/ok <id>] 显式销账标记）', () => {
  it('解析单个与多个标记，去重保序', () => {
    expect(parseAskSettleIds('查完了，身份卡已有名字。[ask/ok a-1234-abcd]')).toEqual(['a-1234-abcd'])
    expect(parseAskSettleIds('[ask/ok a-1] 顺带这张也结了 [ask/ok a-2]')).toEqual(['a-1', 'a-2'])
    expect(parseAskSettleIds('重复 [ask/ok a-1] 再提一次 [ask/ok a-1]')).toEqual(['a-1'])
  })

  it('无标记/坏格式返回空数组；不误伤 [ask] 开单标记', () => {
    expect(parseAskSettleIds('没有任何标记')).toEqual([])
    expect(parseAskSettleIds('[ask] 凭据｜为了：发布｜给了之后：发版')).toEqual([])
    expect(parseAskSettleIds('[ask/ok] 缺 id')).toEqual([])
    expect(parseAskSettleIds('[ask/ok 带空格 id]')).toEqual([])
  })
})
