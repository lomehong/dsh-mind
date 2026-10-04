import { describe, expect, it } from 'vitest'
import {
  AGENDA_SCHEMA_VERSION, completeAgendaItem, confirmAgendaItem, correctIntentModel,
  emptyAgendaState, learnIntentModel, matchTouchpoints, mergeAgendaProposals,
  pendingProposals, rejectAgendaItem,
} from '../src/agenda.ts'

const NOW = '2026-10-04T12:00:00.000Z'

describe('议程存储初始化', () => {
  it('空状态：schema 版本 + 空意图模型', () => {
    const s = emptyAgendaState(NOW)
    expect(s.schemaVersion).toBe(AGENDA_SCHEMA_VERSION)
    expect(s.items).toEqual([])
    expect(s.intent.role).toBe('')
    expect(s.intent.revisions).toBe(0)
  })
})

describe('mergeAgendaProposals（推理层产出合并）', () => {
  it('新推导项：无证据且非主人指示 → 拒绝（拒绝无依据发挥）', () => {
    const r = mergeAgendaProposals(emptyAgendaState(NOW), [{ what: '无证据的空泛事项' }], NOW)
    expect(r.added).toEqual([])
    expect(r.rejectedProposals).toBe(1)
  })

  it('带证据的新推导 → 插入为 proposed（低置信）', () => {
    const r = mergeAgendaProposals(emptyAgendaState(NOW), [{
      what: '供应商安全问卷未回收',
      evidence: [{ source: 'message_in', ref: 'm-1', note: '群里 3 天前要的问卷至今没回' }],
      expectedResult: '问卷回收并归档',
    }], NOW)
    expect(r.added).toHaveLength(1)
    expect(r.state.items[0].status).toBe('proposed')
    expect(r.state.items[0].confidence).toBe('low')
    expect(r.state.items[0].evidence).toHaveLength(1)
  })

  it('已存在项按 id 更新（不重复插入）', () => {
    const base = mergeAgendaProposals(emptyAgendaState(NOW), [{
      what: 'A 事项', id: 'AG-x',
      evidence: [{ source: 'task', ref: 't-1', note: '任务停滞' }],
    }], NOW)
    const r = mergeAgendaProposals(base.state, [{ what: 'A 事项（进展）', id: 'AG-x' }], NOW)
    expect(r.state.items.filter(i => i.what.includes('A 事项'))).toHaveLength(1)
    expect(r.updated).toHaveLength(1)
  })

  it('done/rejected 项不被同名新推导复活', () => {
    let s = emptyAgendaState(NOW)
    const r1 = mergeAgendaProposals(s, [{ what: '旧事项', id: 'AG-old', evidence: [{ source: 'task', ref: 't', note: 'x' }] }], NOW)
    s = confirmAgendaItem(r1.state, 'AG-old', NOW) ? r1.state : s
    s = completeAgendaItem(s, 'AG-old', NOW) ? s : s
    const r2 = mergeAgendaProposals(s, [{ what: '旧事项', id: 'AG-old', evidence: [{ source: 'task', ref: 't', note: 'x' }] }], NOW)
    expect(r2.updated).toEqual([])
    expect(r2.rejectedProposals).toBe(1)
  })
})

describe('校准层（主人确认/否决）', () => {
  it('proposed → confirmed 后才可 tracking/done', () => {
    let s = emptyAgendaState(NOW)
    const r = mergeAgendaProposals(s, [{ what: 'X', id: 'AG-1', evidence: [{ source: 'task', ref: 't', note: 'n' }] }], NOW)
    s = r.state
    expect(completeAgendaItem(s, 'AG-1', NOW)).toBe(false)
    expect(confirmAgendaItem(s, 'AG-1', NOW)).toBe(true)
    expect(completeAgendaItem(s, 'AG-1', NOW)).toBe(true)
  })

  it('否决记原因；被否决项不可再确认', () => {
    let s = emptyAgendaState(NOW)
    s = mergeAgendaProposals(s, [{ what: 'Y', id: 'AG-2', evidence: [{ source: 'timeline', ref: 's-9', note: 'n' }] }], NOW).state
    expect(rejectAgendaItem(s, 'AG-2', '这不是我关心的', NOW)).toBe(true)
    expect(s.items[0].rejectionNote).toBe('这不是我关心的')
    expect(confirmAgendaItem(s, 'AG-2', NOW)).toBe(false)
  })

  it('pendingProposals 只列 proposed（校准批量）', () => {
    let s = emptyAgendaState(NOW)
    s = mergeAgendaProposals(s, [
      { what: 'P1', id: 'AG-a', evidence: [{ source: 'task', ref: 't', note: 'n' }] },
      { what: 'P2', id: 'AG-b', evidence: [{ source: 'task', ref: 't', note: 'n' }] },
    ], NOW).state
    expect(pendingProposals(s)).toHaveLength(2)
    s = confirmAgendaItem(s, 'AG-a', NOW) ? s : s
    expect(pendingProposals(s).map(i => i.id)).toEqual(['AG-b'])
  })
})

describe('执行层触点匹配（廉价检测）', () => {
  const state = () => {
    let s = emptyAgendaState(NOW)
    s = mergeAgendaProposals(s, [{
      what: '供应商安全问卷跟进',
      id: 'AG-t1',
      evidence: [{ source: 'message_in', ref: 'm-1', note: 'n' }],
      touchpoint: { keywords: ['问卷', '供应商'], sources: ['message_in', 'task'] },
    }], NOW).state
    return confirmAgendaItem(s, 'AG-t1', NOW) ? s : s
  }

  it('关键词命中已确认项 → 触点命中', () => {
    const hits = matchTouchpoints(state(), [{ source: 'message_in', text: '供应商的问卷今天给了吗' }])
    expect(hits).toHaveLength(1)
    expect(hits[0].item.id).toBe('AG-t1')
  })

  it('来源不匹配 → 不命中', () => {
    expect(matchTouchpoints(state(), [{ source: 'meeting', text: '问卷议题' }])).toEqual([])
  })

  it('proposed 未确认项不参与触点匹配（防没事找事）', () => {
    let s = emptyAgendaState(NOW)
    s = mergeAgendaProposals(s, [{
      what: '未确认事项', id: 'AG-t2',
      evidence: [{ source: 'task', ref: 't', note: 'n' }],
      touchpoint: { keywords: ['评审'] },
    }], NOW).state
    expect(matchTouchpoints(s, [{ source: 'message_in', text: '评审安排在明天' }])).toEqual([])
  })
})

describe('意图模型（自举 + 校准）', () => {
  it('推理层自举合并去重，不动 revisions', () => {
    let s = emptyAgendaState(NOW)
    s = learnIntentModel(s, { longTermConcerns: ['安全情报', '团队推进'] }, NOW)
    s = learnIntentModel(s, { longTermConcerns: ['安全情报', '会议落地'] }, NOW)
    expect(s.intent.longTermConcerns).toEqual(['安全情报', '团队推进', '会议落地'])
    expect(s.intent.revisions).toBe(0)
  })

  it('主人纠正覆盖并 revisions+1（学习痕迹）', () => {
    let s = emptyAgendaState(NOW)
    s = learnIntentModel(s, { longTermConcerns: ['错的理解'] }, NOW)
    s = correctIntentModel(s, { longTermConcerns: ['对的理解'] }, NOW)
    expect(s.intent.longTermConcerns).toEqual(['对的理解'])
    expect(s.intent.revisions).toBe(1)
  })
})
