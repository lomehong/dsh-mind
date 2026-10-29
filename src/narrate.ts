/**
 * 心智叙事层：把时间线步骤（机器语义）翻译为第一人称生活语言（人的语义）。
 *
 * 纯函数、零依赖（仅类型导入），客户端与测试共用。
 * 原则：机器状态翻译成人的状态；治理/成本数据降为可展开的细节；
 * error 温和呈现（「念头断了」而非「报错」）；idle 折叠为休息。
 */
import type { TimelineStep } from './timeline.ts'

export type NarratedKind = 'you' | 'mind' | 'moment' | 'rest' | 'break'

export interface NarratedStep {
  seq: number
  ts: string
  kind: NarratedKind
  /** 第一人称主句（TA 的视角）。 */
  title: string
  /** 正文（TA 说的话/做的事）。 */
  body?: string
  /** 工程细节（触发源/用量/成本），人视图默认收起。 */
  detail?: string
  tone?: 'normal' | 'subtle' | 'warn'
  /** 折叠明细（仅合并的休息步）：原始各拍可展开查看。 */
  fold?: { count: number; fromTs: string; toTs: string; items: NarratedStep[] }
}

const FN_LABELS: Record<string, string> = {
  think: '我在想',
  act: '我在办一件事',
  share: '我想告诉你',
  learn: '我记住了这件事',
  recall: '我在回想',
  goals: '我在盘算接下来的安排',
  idle: '我歇了一会儿',
}

/** idle 空醒识别：fn 字段或文本形态任一命中（历史数据 fn 可能被误记为 think）。 */
function isIdleWake(s: TimelineStep): boolean {
  if (s.type !== 'wake') return false
  if (s.fn === 'idle') return true
  const text = `${s.final ?? ''}\n${s.content}`
  return /(^|\n)\s*本拍\s*idle|FINAL\s*=\s*"?\[idle\]|^\[?\s*idle\b|Idle\s*—/i.test(text)
}

/** 单步 → 叙事。未知类型回落为 moment（保守呈现，不丢内容）。 */
export function narrateStep(s: TimelineStep): NarratedStep {
  const base = { seq: s.seq, ts: s.ts }
  const clip = (t: string, n = 400): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
  switch (s.type) {
    case 'message_in': {
      // 系统观察不是人的话——按来源区分措辞（世界观察/渠道 vs 主人）
      const from = s.refs?.from ?? s.source
      if (s.source === '世界观察' || from === '世界') {
        return { ...base, kind: 'moment', title: `世界有动静（${s.source}）`, body: clip(s.content) }
      }
      return { ...base, kind: 'you', title: `你说（来自 ${from}）`, body: clip(s.content) }
    }
    case 'message_out':
      return { ...base, kind: 'mind', title: '我对你说', body: clip(s.content) }
    case 'wake': {
      if (isIdleWake(s)) {
        return { ...base, kind: 'rest', title: FN_LABELS.idle!, tone: 'subtle' }
      }
      const fn = s.fn ?? 'think'
      const label = FN_LABELS[fn] ?? '我在想'
      const parts: string[] = []
      if (s.trigger !== undefined) parts.push(s.trigger)
      // 用量 0/0 是计量缺失而非真实花费——不渲染假数据（runner 计量修复前防噪）
      if (s.usage !== undefined && (s.usage.tokensIn > 0 || s.usage.tokensOut > 0)) {
        parts.push(`${s.usage.tokensIn}/${s.usage.tokensOut} tok · $${s.usage.costUsd.toFixed(4)}`)
      }
      const detail = parts.length > 0 ? parts.join(' · ') : undefined
      return {
        ...base,
        kind: 'moment',
        title: `${label}…`,
        body: clip(s.final ?? s.content),
        ...(detail !== undefined ? { detail } : {}),
      }
    }
    case 'thought':
      return { ...base, kind: 'moment', title: '我有个念头', body: clip(s.content) }
    case 'observation':
      return { ...base, kind: 'moment', title: '我注意到', body: clip(s.content) }
    case 'task':
      return { ...base, kind: 'moment', title: '我接了一件活', body: clip(s.content) }
    case 'idle':
      return { ...base, kind: 'rest', title: '我歇了一会儿', tone: 'subtle' }
    case 'error':
      return { ...base, kind: 'break', title: '有个念头断了，醒来会接着排', body: clip(s.content, 200), tone: 'warn' }
    default:
      return { ...base, kind: 'moment', title: '……', body: clip(s.content) }
  }
}

export interface DayGroup {
  /** 今天 / 昨天 / M月D日（跨年带年份）。 */
  label: string
  /** 天内旧→新。 */
  steps: NarratedStep[]
}

const dayKeyOf = (ts: string): string => ts.slice(0, 10)

/** 折叠连续的休息步：人不会每分钟写一篇一模一样的空日记（设计 §12.1 idle 折叠纪律）。
 *  折叠结果携带 fold 明细（原始各拍），UI 可点击展开查看。 */
export function coalesceRests(steps: NarratedStep[]): NarratedStep[] {
  const out: NarratedStep[] = []
  for (const step of steps) {
    const last = out[out.length - 1]
    if (step.kind === 'rest' && last !== undefined && last.kind === 'rest') {
      const fold = last.fold ?? { count: 1, fromTs: last.ts, toTs: last.ts, items: [last] }
      fold.count += 1
      fold.toTs = step.ts
      fold.items.push(step)
      out[out.length - 1] = { ...last, seq: step.seq, title: `我歇了一会儿（${fold.count} 次空醒）`, fold }
      continue
    }
    out.push(step)
  }
  return out
}

/** 新→旧 的步骤流 → 天分组（新天在前，天内旧→新，连续休息折叠）。 */
export function groupByDay(steps: TimelineStep[], now: Date): DayGroup[] {
  const today = dayKeyOf(now.toISOString())
  const yesterday = dayKeyOf(new Date(now.getTime() - 86400000).toISOString())
  const groups: DayGroup[] = []
  let current: DayGroup | undefined
  for (const step of [...steps].reverse()) { // 旧→新
    const key = dayKeyOf(step.ts)
    if (current === undefined || dayKeyOf(current.steps[current.steps.length - 1]!.ts) !== key) {
      const label = key === today ? '今天' : key === yesterday ? '昨天'
        : `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日${key.slice(0, 4) !== String(now.getFullYear()) ? `（${key.slice(0, 4)}）` : ''}`
      current = { label, steps: [] }
      groups.unshift(current) // 新天放最前
    }
    current.steps.push(narrateStep(step))
  }
  for (const g of groups) g.steps = coalesceRests(g.steps)
  return groups
}

export interface PresenceInput {
  enabled: boolean
  stoppedByMaster: boolean
  running: boolean
  quiet?: { enabled: boolean; active: boolean; start: string; end: string }
  wakeAt: number
  spend?: { usedUsd: number; hardCapUsd: number }
   /** 注入 pending 消息数（对 TA 说话后 TA 还没醒时 >0）。 */
  pending?: number
  /** P5 请求账：等待主人的 open 请求数（§6.5——存在语义之外的依赖语义）。 */
  openAsks?: number
  /** 最早一条请求的 what（存在句素材）。 */
  openAskWhat?: string
}

/** 在场感一句话：TA 现在怎么样（第一人称）。 */
export function presenceLine(s: PresenceInput, now = Date.now()): string {
  if (s.stoppedByMaster) return '我在休息——是你让我停的，需要时叫我'
  if (!s.enabled) return '我在沉睡（总开关未开）'
  if (s.quiet?.active === true) return `我睡着了（${s.quiet.start}–${s.quiet.end}），醒来会继续`
  if (s.running) return '我正在想事情……'
  if (s.spend !== undefined && s.spend.usedUsd >= s.spend.hardCapUsd) return '我今天想得够多了，在省着用（明天继续）'
  if ((s.openAsks ?? 0) > 0) return `有件事卡住了，等你给${s.openAskWhat !== undefined ? `：${s.openAskWhat}` : ''}`
  if ((s.pending ?? 0) > 0) return '我刚收到你的话，正在准备回应……'
  if (s.wakeAt > now) {
    const mins = Math.round((s.wakeAt - now) / 60000)
    return mins >= 1 ? `我在安静一会儿，约 ${mins} 分钟后自己醒` : '我马上就醒'
  }
  return '我在'
}

/** 时间感知问候（页面头部）。 */
export function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 5) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 23) return '晚上好'
  return '夜深了'
}

// ==== 存在体（The Being）形体情态 ====

export type BeingMood = 'stopped' | 'asleep' | 'attentive' | 'thinking' | 'awake'

export interface BeingStatusInput {
  enabled: boolean
  stoppedByMaster: boolean
  running: boolean
  quiet?: { enabled: boolean; active: boolean; start: string; end: string }
  pending?: number
}

/** 状态 → 形体情态（优先级：叫停 > 入睡 > 注意到你 > 思考 > 清醒）。 */

/** 剧场输入：与宿主 StatusPayload 结构同形（客户端直传，G8 纯函数）。 */
export interface BeingTheaterInput {
  running?: boolean
  backoffLevel?: number
  quiet?: { active?: boolean }
  spendLevel?: 'normal' | 'soft' | 'hard'
  pending?: number
  pendingApprovals?: number
  stoppedByMaster?: boolean
  enabled?: boolean
  tail?: ReadonlyArray<{ type?: string; fn?: string }>
}

export interface BeingTheater {
  /** 活动铭牌（emoji）：贴在存在体上的「此刻在做什么」。 */
  glyph: string
  /** 铭牌说明（一两句，可空串）。 */
  label: string
  /** 呼吸节律倍率：1 = 标准；退避越深越缓（0.7–1.8）。 */
  rhythm: number
  /** 光晕明度倍率：静音/深退避时收暗（0.45–1）。 */
  dim: number
}

/** 活动铭牌推导：最新时间线步骤的函数选择 → emoji 铭牌（P0 剧场）。 */
export function beingGlyph(s: BeingTheaterInput | undefined): { glyph: string; label: string } {
  if (s === undefined) return { glyph: '🌤', label: '' }
  if (s.stoppedByMaster || s.enabled === false) return { glyph: '⏸', label: '停着' }
  if (s.quiet?.active === true) return { glyph: '🌙', label: '睡着' }
  if ((s.pending ?? 0) > 0) return { glyph: '💬', label: '刚收到你的话' }
  if (s.running) {
    const fn = s.tail?.[0]?.fn ?? s.tail?.[0]?.type ?? ''
    if (fn === 'learn') return { glyph: '📖', label: '在查资料' }
    if (fn === 'act') return { glyph: '⌨️', label: '在干活' }
    if (fn === 'share') return { glyph: '📨', label: '在投递' }
    if (fn === 'recall') return { glyph: '🔎', label: '在回忆' }
    if (fn === 'think') return { glyph: '💭', label: '在想事' }
    return { glyph: '⌨️', label: '在干活' }
  }
  const fn = s.tail?.[0]?.fn ?? s.tail?.[0]?.type ?? ''
  if (fn === 'learn') return { glyph: '📖', label: '刚读完资料' }
  if (fn === 'goals') return { glyph: '🎯', label: '在理目标' }
  if (fn === 'ask') return { glyph: '🙋', label: '有事等你给' }
  return { glyph: '🌤', label: '醒着' }
}

/** 呼吸节律倍率：退避越深越省（呼吸放缓），硬顶时略急促（1±）。 */
export function beingRhythm(s: BeingTheaterInput | undefined): number {
  if (s === undefined) return 1
  if (s.spendLevel === 'hard') return 1.15
  const lvl = Math.max(0, Math.min(10, Number(s.backoffLevel ?? 0) || 0))
  return 1 + lvl * 0.08
}

/** 光晕明度倍率：静音/深退避时收暗（0.55–1）。 */
export function beingDim(s: BeingTheaterInput | undefined): number {
  if (s === undefined) return 1
  if (s.quiet?.active === true) return 0.55
  const lvl = Math.max(0, Math.min(10, Number(s.backoffLevel ?? 0) || 0))
  return 1 - Math.min(0.3, lvl * 0.03)
}
export function beingMood(s: BeingStatusInput | undefined): BeingMood {
  if (s === undefined) return 'awake'
  if (s.stoppedByMaster || !s.enabled) return 'stopped'
  if (s.quiet?.active === true) return 'asleep'
  if ((s.pending ?? 0) > 0) return 'attentive'
  if (s.running) return 'thinking'
  return 'awake'
}
