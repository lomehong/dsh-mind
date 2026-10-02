/**
 * 世界观察（分身的感知器官）v2——归因代替时限（concurrence-sre §3.2，
 * 10-01 唤醒列车事故：58 拍 LLM/$0.958，指纹无归因 + 90s 窗被打穿）。
 *
 * v2 变化：
 * - 看板侧：任务 id→列 映射（精确到任务，不再只有列计数）＋ originBy 归因
 *   （心智立项的任务，其全部后续列变化都算「自己造成的」，搭车消化不唤醒）；
 * - 记忆侧：条数 + maxSeq + maxTs 内容签名（第三方转写回声无法归因 → 走
 *   checkWorld 的二次采样确认，不再靠固定时间窗）；
 * - diffWorld 输出逐条 changes（含 selfCaused 归因），注入/搭车分流由调用方决策。
 */

/** 看板任务快照（/dsh-task-board/state 的 tasks 已含 id/column/originBy）。 */
export interface BoardTaskSnapshot {
  id: string
  column: string
  /** P1.5 立项调用方会话 id（心智立项的任务可归因为「自己造成的」） */
  originBy?: string
}

/** 记忆条目快照（dsh-memory 条目的最小投影）。 */
export interface MemorySnapshot {
  content: string
  ts?: string
  seq?: number
  /** dsh-memory 契约的来源标注（learn 路径带会话来源；缺席→无法归因） */
  sourceOrigin?: string
}

export interface WorldCountsV2 {
  board: ReadonlyArray<BoardTaskSnapshot>
  memoryCount: number
  memoryMaxSeq?: number
  memoryMaxTs?: string
}

export interface WorldChange {
  desc: string
  selfCaused: boolean
}

export interface WorldDiffV2 {
  /** 新指纹（调用方持久化） */
  fp: string
  /** 变化描述（null = 无变化或首次吸收） */
  desc: string | null
  /** 逐条变化（含归因；desc 非 null 时与 desc 同源） */
  changes: ReadonlyArray<WorldChange>
}

/** 世界指纹 v2（任务 id→列 有序映射 + 记忆内容签名）。 */
export function fingerprintOf(counts: WorldCountsV2): string {
  const board = [...counts.board]
    .map(t => `${t.id}:${t.column}`)
    .sort()
    .join(',')
  const mem = `${counts.memoryCount}:${counts.memoryMaxSeq ?? 0}:${counts.memoryMaxTs ?? ''}`
  return JSON.stringify({ b: board, m: mem })
}

function parseFp(fp: string | undefined): { board: Map<string, string>; memoryCount: number } | null {
  if (fp === undefined || fp === '') return null
  try {
    const raw = JSON.parse(fp) as { b?: string; m?: string }
    const board = new Map<string, string>()
    for (const pair of (raw.b ?? '').split(',')) {
      const [id, col] = pair.split(':')
      if (id !== '' && id !== undefined && col !== undefined) board.set(id, col)
    }
    // m 为 v2 复合签名（count:maxSeq:maxTs）——条数取首段；v1 旧指纹（纯数字）兼容
    const memoryCount = Number((raw.m ?? '0').split(':')[0]) || 0
    return { board, memoryCount }
  } catch {
    return null
  }
}

/**
 * 差异计算 v2（纯函数）：prevFp 缺席 = 首次吸收（不产生描述）。
 * 归因规则：看板侧「originBy ∈ mindIds 的任务的列变化」= 自己造成的（搭车消化）；
 * 记忆侧无法归因（第三方转写不可区分）→ 一律按外部处理，由二次采样与节流兜底。
 */
export function diffWorldV2(
  prevFp: string | undefined,
  counts: WorldCountsV2,
  mindIds: ReadonlySet<string>,
): WorldDiffV2 {
  const fp = fingerprintOf(counts)
  if (prevFp === undefined) return { fp, desc: null, changes: [] }
  const prev = parseFp(prevFp)
  if (prev === null) return { fp, desc: null, changes: [] }
  if (fp === prevFp) return { fp, desc: null, changes: [] }

  const changes: WorldChange[] = []
  // 看板侧：id 级对比（新增/换列/消失）
  const ids = new Set([...prev.board.keys(), ...counts.board.map(t => t.id)])
  for (const id of ids) {
    const before = prev.board.get(id)
    const after = counts.board.find(t => t.id === id)?.column
    if (before === after) continue
    const t = counts.board.find(x => x.id === id)
    const selfCaused = after !== undefined && t?.originBy !== undefined && mindIds.has(t.originBy)
    const dir = after === undefined ? '已消失' : before === undefined ? `新增于「${after}」` : `「${before}」→「${after}」`
    changes.push({ desc: `任务 ${id} ${dir}`, selfCaused })
  }
  // 记忆侧（无法归因 → 外部）
  const dm = counts.memoryCount - prev.memoryCount
  if (dm !== 0) changes.push({ desc: `记忆库 ${dm > 0 ? `+${dm}` : dm} 条`, selfCaused: false })

  if (changes.length === 0) return { fp, desc: null, changes: [] }
  const desc = `世界观察：${changes.map(c => c.desc).join('；')}`
  return { fp, desc, changes }
}
