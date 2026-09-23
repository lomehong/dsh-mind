/**
 * 世界观察（分身的感知器官）：监测任务看板与记忆库在两次唤醒之间的变化。
 *
 * 为什么需要：分身的唤醒素材只有自己的时间线——世界安静它就只能空转。
 * 看板有任务流转、记忆库有新条目（主人/其他代理写入），都是「有事可干」的
 * 真实信号。变化 → 注入观察 → 反应性唤醒（事件触发永不下钻短路，G3）。
 *
 * 防自激：唤醒收尾时会静默吸收自己造成的变化（task_delegate 落板、learn
 * 写记忆），只有**别人**造成的变化才触发观察。
 */

export interface WorldCounts {
  /** 看板各列的任务数（待规划/待办/进行中/已完成/已失败） */
  taskCols: Record<string, number>
  /** 记忆库条目数 */
  memoryCount: number
}

export interface WorldDiff {
  /** 新指纹（调用方持久化） */
  fp: string
  /** 变化描述（null = 无变化或首次吸收） */
  desc: string | null
}

/** 世界指纹（稳定的键序）。 */
export function fingerprintOf(counts: WorldCounts): string {
  const cols = Object.keys(counts.taskCols).sort()
  const part = cols.map(c => `${c}:${counts.taskCols[c]}`).join(',')
  return JSON.stringify({ c: part, m: counts.memoryCount })
}

function parseFp(fp: string | undefined): WorldCounts | null {
  if (fp === undefined || fp === '') return null
  try {
    const raw = JSON.parse(fp) as { c?: string; m?: number }
    const cols: Record<string, number> = {}
    for (const pair of (raw.c ?? '').split(',')) {
      const [k, n] = pair.split(':')
      if (k !== '' && k !== undefined) cols[k] = Number(n) || 0
    }
    return { taskCols: cols, memoryCount: raw.m ?? 0 }
  } catch {
    return null
  }
}

/** 差异计算（纯函数）：prevFp 缺席 = 首次吸收（不产生描述）。 */
export function diffWorld(prevFp: string | undefined, counts: WorldCounts): WorldDiff {
  const fp = fingerprintOf(counts)
  if (prevFp === undefined) return { fp, desc: null }
  if (fp === prevFp) return { fp, desc: null }
  const prev = parseFp(prevFp)
  const parts: string[] = []
  if (prev !== null) {
    const cols = new Set([...Object.keys(prev.taskCols), ...Object.keys(counts.taskCols)])
    for (const c of cols) {
      const before = prev.taskCols[c] ?? 0
      const after = counts.taskCols[c] ?? 0
      if (after !== before) parts.push(`看板「${c}」${after > before ? `+${after - before}` : after - before}`)
    }
    const dm = counts.memoryCount - prev.memoryCount
    if (dm > 0) parts.push(`记忆库 +${dm} 条`)
  }
  if (parts.length === 0) parts.push('有变化')
  return { fp, desc: `世界观察：${parts.join('；')}` }
}
