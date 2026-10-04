/** 调度状态持久化：run/state.json（tmp+rename 原子写，0600）。 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mindHome } from './config.ts'
import type { SchedulerState } from './scheduler.ts'

export const STATE_DEFAULT: SchedulerState = {
  backoffLevel: 0,
  emptiesAtLevel: 0,
  wakeAt: 0,
  lastWakeAt: 0,
  stoppedByMaster: false,
  lastSeq: 0,
  pendingApprovals: 0,
  openPendings: [],
  openAsks: [],
  idleStreak: 0,
  spend: { date: '1970-01-01', usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 },
  reactive: { windowStart: 0, count: 0 },
}

export function statePath(): string {
  return join(mindHome(), 'run', 'state.json')
}

export function loadState(): SchedulerState {
  try {
    const raw = JSON.parse(readFileSync(statePath(), 'utf8')) as Partial<SchedulerState>
    const base: SchedulerState = { ...STATE_DEFAULT, ...raw }
    base.spend = { ...STATE_DEFAULT.spend, ...(raw.spend ?? {}) }
    base.reactive = { ...STATE_DEFAULT.reactive, ...(raw.reactive ?? {}) }
    // pendingApprovals 防护：显式 null/undefined（跨版本/竞态写入）归零
    base.pendingApprovals = Number(base.pendingApprovals) || 0
    base.idleStreak = Number(base.idleStreak) || 0
    // P2 议程推理 duty 防护：负值/坏类型归零（宁缺毋错）
    base.agendaAnalysisAt = Number(base.agendaAnalysisAt) || 0
    base.agendaObservations = Number(base.agendaObservations) || 0
    // openPendings 防护：非数组/坏条目丢弃（承诺账宁缺毋错）
    base.openPendings = Array.isArray(base.openPendings)
      ? base.openPendings.filter(p =>
        p !== null && typeof p === 'object'
        && typeof (p as { seq?: unknown }).seq === 'number'
        && typeof (p as { ts?: unknown }).ts === 'string'
        && typeof (p as { text?: unknown }).text === 'string')
      : []
    // openAsks 防护（P5 请求账）：非数组/坏条目丢弃；state 非 open 视为已结清
    base.openAsks = Array.isArray(base.openAsks)
      ? base.openAsks.filter(a =>
        a !== null && typeof a === 'object'
        && typeof (a as { id?: unknown }).id === 'string'
        && typeof (a as { ts?: unknown }).ts === 'string'
        && typeof (a as { what?: unknown }).what === 'string'
        && (a as { state?: unknown }).state === 'open')
      : []
    return base
  } catch {
    return {
      ...STATE_DEFAULT,
      spend: { ...STATE_DEFAULT.spend },
      reactive: { ...STATE_DEFAULT.reactive },
      openPendings: [],
      openAsks: [],
    }
  }
}

export function saveState(state: SchedulerState): void {
  const file = statePath()
  mkdirSync(join(file, '..'), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(state, null, 1)}\n`, { encoding: 'utf8' })
  renameSync(tmp, file)
}

/** P2 单写者队列（concurrence-sre R1/R2）：跨 await 的读改写一律经此串行——
 *  队列保证互斥，fn 内拿到的是刚从磁盘装载的新鲜态，fn 返回后立即落盘。
 *  纪律：fn 内不得再调用 loadState/saveState（写点收敛），不得吞异常。
 *  纯同步的 load→save 微写点（无 await 夹缝）可保持原样（JS 单线程下天然原子）。 */
let writeQueue: Promise<unknown> = Promise.resolve()

export function mutateState<T>(fn: (state: SchedulerState) => T): Promise<T> {
  const task = writeQueue.then(() => {
    const s = loadState()
    const result = fn(s)
    saveState(s)
    return result
  })
  writeQueue = task.catch(() => { /* 队列不断链：失败由调用方处置 */ })
  return task as Promise<T>
}

/** 唤醒入口的 seq 对账（R3 防重号）：timeline 追加与 state.lastSeq 是两个文件，
 *  崩溃残留可能让 timeline seq 领先 lastSeq——唤醒前取 max，杜绝 seq 复用。 */
export function reconcileSeqWithTail(state: SchedulerState, tailSeqs: ReadonlyArray<number>): void {
  for (const seq of tailSeqs) {
    if (typeof seq === 'number' && seq > state.lastSeq) state.lastSeq = seq
  }
}
