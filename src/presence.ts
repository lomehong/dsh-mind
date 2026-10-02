/**
 * 会话在场感知（P1「会话在场让位」，arch-lead 提案 §3.1）。
 *
 * 数据源：session/list（宿主契约字段只有 running/origin/cwd——不赌 title，
 * arch-lead F6 教训：对契约外字段的假设曾让 recentActivity 链路哑火）。
 * 看板 activity() 的 runningTasks 作为任务执行现场的权威标注（看板=唯一
 * 活动权威，主人拍板）；缺席时退化为保守伞（非子代理的运行会话一律按
 * 「有人在被服务」处理——误让位的代价（沉默一会儿）远小于插话的代价）。
 *
 * 分类哲学：调度决策只需要两个桶——master-facing（有人正在被服务）与
 * background（委派工作在跑）；交互/IM 刻意不细分（方向必须安全，细分留 P2）。
 */
import type { GatewayClient } from './gateway.ts'

export type PeerKind = 'task-execution' | 'background' | 'master-facing'
export type PresenceStrength = 'master-facing' | 'background' | 'none'

export interface PresencePeer {
  sessionId: string
  kind: PeerKind
}

export interface PresenceSnapshot {
  at: number
  strongest: PresenceStrength
  masterFacingCount: number
  peers: PresencePeer[]
  source: 'session-list' | 'unavailable'
}

/** 宿主 session/list 条目（只依赖契约字段，arch-lead F6）。 */
export interface SessionItem {
  sessionId?: string
  running?: boolean
  origin?: string
  cwd?: string
}

/** 纯函数分类（G8 可测）：running 且非自身的会话 → 三类；master-facing 保守伞。 */
export function classifyPresence(
  items: ReadonlyArray<SessionItem>,
  runningTaskIds: ReadonlySet<string>,
  selfIds: ReadonlySet<string>,
): { strongest: PresenceStrength; peers: PresencePeer[] } {
  const peers: PresencePeer[] = []
  for (const s of items) {
    const id = typeof s.sessionId === 'string' ? s.sessionId : ''
    if (id === '' || selfIds.has(id)) continue
    if (s.running !== true) continue
    let kind: PeerKind = 'master-facing'
    if (runningTaskIds.has(id)) kind = 'task-execution'
    else if (s.origin === 'subagent') kind = 'background'
    peers.push({ sessionId: id, kind })
  }
  const strongest: PresenceStrength = peers.some(p => p.kind === 'master-facing')
    ? 'master-facing'
    : peers.length > 0 ? 'background' : 'none'
  return { strongest, peers }
}

/**
 * 在场探测：session/list + 看板 runningTasks（可选注入）→ 快照。
 * list 失败 → source='unavailable'（调用方按 fail-open 处理：沿用上次快照或视为 none）。
 */
export async function probePresence(
  gw: GatewayClient,
  opts: { selfIds: ReadonlySet<string>; runningTaskIds?: ReadonlySet<string> },
): Promise<PresenceSnapshot> {
  const at = Date.now()
  try {
    const list = (await gw.invoke('session', 'list', {})) as { items?: ReadonlyArray<SessionItem> }
    const runningTaskIds = opts.runningTaskIds ?? new Set<string>()
    const { strongest, peers } = classifyPresence(list.items ?? [], runningTaskIds, opts.selfIds)
    return { at, strongest, masterFacingCount: peers.filter(p => p.kind === 'master-facing').length, peers, source: 'session-list' }
  } catch {
    return { at, strongest: 'none', masterFacingCount: 0, peers: [], source: 'unavailable' }
  }
}
