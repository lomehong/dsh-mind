/**
 * 心智时间线：append-only jsonl（设计 §3.1 schema v2）。
 * 单一写路径（全部经本模块）；半行容错（崩溃残留尾行跳过并报告）；
 * 滚动归档（timelineRetentionDays，归档件 archive-<月份>.jsonl）。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mindHome } from './config.ts'

export type StepType =
  | 'thought' | 'observation' | 'action' | 'message_in' | 'message_out'
  | 'task' | 'idle' | 'error' | 'wake'

/** 时间线步骤（设计 §3.1 schema v2）。必填 pin：v/seq/ts/type/source。 */
export interface TimelineStep {
  v: 2
  seq: number
  ts: string
  type: StepType
  source: string
  content: string
  /** 仅 wake 步骤：触发源 */
  trigger?: 'spontaneous' | 'reactive' | 'event' | 'watchdog'
  /** 仅 wake 步骤：函数选择 */
  fn?: 'act' | 'share' | 'think' | 'learn' | 'recall' | 'goals' | 'idle'
  /** 仅 wake 步骤：FINAL 交接棒 */
  final?: string
  /** 仅 wake 步骤：用量与成本 */
  usage?: { llmCalls: number; tokensIn: number; tokensOut: number; costUsd: number }
  /** 仅 wake 步骤：退避档位 */
  backoffLevel?: number
  /** 交付步骤：被解决的 message_in seq */
  resolves?: number
  refs?: Record<string, string>
}

export function timelinePath(): string {
  return join(mindHome(), 'timeline.jsonl')
}

export function archivePath(month: string): string {
  return join(mindHome(), `archive-${month}.jsonl`)
}

/**
 * 追加一步（调用方持有 seq 单调计数；写入为整行 append，单写者下原子）。
 * 失败抛错由调用方防御——时间线写失败不阻断心智主流程。
 */
export function appendStep(step: TimelineStep): void {
  const file = timelinePath()
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(step)}\n`, { encoding: 'utf8' })
}

/** 半行容错读尾部：返回最近 maxSteps 条可解析步骤（**新→旧** 排列）；崩溃残留的坏尾行被跳过并计数。 */
export function readTail(maxSteps: number): { steps: TimelineStep[]; skippedBadTail: number } {
  const file = timelinePath()
  if (!existsSync(file)) return { steps: [], skippedBadTail: 0 }
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n').filter(l => l.trim() !== '')
  const steps: TimelineStep[] = []
  let skippedBadTail = 0
  for (let i = lines.length - 1; i >= 0 && steps.length < maxSteps; i--) {
    try {
      steps.push(JSON.parse(lines[i]!) as TimelineStep)
    } catch {
      if (i === lines.length - 1) skippedBadTail += 1 // 只容忍坏尾行（崩溃残留）
      else break // 中段坏行视为文件损坏，停止回读
    }
  }
  return { steps, skippedBadTail }
}

/** 只读投影分页（P4）：取 seq < beforeSeq 的最近 limit 步（新→旧）；beforeSeq
 *  缺省 = 最新。纯数组变换（读文件仍走 readTail 全量——体量大后 P4+ 换游标存储）。 */
export function paginateSteps(
  steps: ReadonlyArray<TimelineStep>,
  limit: number,
  beforeSeq?: number,
): TimelineStep[] {
  const capped = Math.min(200, Math.max(1, Math.floor(limit)))
  const filtered = beforeSeq === undefined ? steps : steps.filter(s => typeof s.seq === 'number' && s.seq < beforeSeq)
  return filtered.slice(0, capped)
}

/**
 * 滚动归档：把 ts 早于 cutoffDays 天的步骤移入按月归档件。
 * 实现为整文件重写（时间线体量 P1 有限；P3 金字塔时代换分段存储）。
 * @returns 归档的步骤数（无文件返回 0）
 */
export function archiveOldSteps(cutoffDays: number, now = new Date()): number {
  const file = timelinePath()
  if (!existsSync(file)) return 0
  if (statSync(file).size === 0) return 0
  const cutoffMs = now.getTime() - cutoffDays * 86400000
  const keep: string[] = []
  const byMonth = new Map<string, string[]>()
  let archived = 0
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    let ts: string | undefined
    try { ts = (JSON.parse(line) as { ts?: string }).ts } catch { ts = undefined }
    const t = ts !== undefined ? Date.parse(ts) : Number.NaN
    if (Number.isNaN(t) || t >= cutoffMs) {
      keep.push(line)
      continue
    }
    archived += 1
    const month = (ts ?? now.toISOString()).slice(0, 7)
    const bucket = byMonth.get(month) ?? []
    bucket.push(line)
    byMonth.set(month, bucket)
  }
  if (archived === 0) return 0
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, keep.length > 0 ? `${keep.join('\n')}\n` : '', { encoding: 'utf8' })
  renameSync(tmp, file)
  for (const [month, lines] of byMonth) {
    const target = archivePath(month)
    const prior = existsSync(target) ? readFileSync(target, 'utf8') : ''
    const tmpA = `${target}.tmp-${process.pid}`
    writeFileSync(tmpA, prior + lines.join('\n') + '\n', { encoding: 'utf8' })
    renameSync(tmpA, target)
  }
  return archived
}

