/**
 * 唤醒调度纯函数（设计 §5/§11）：退避阶梯、触发收集、两级 spend cap、静音时段。
 * 全部无副作用、无时钟读取（now 由调用方注入）——确定性可测（G8）。
 */
import type { MindConfig } from './config.ts'

/** 调度状态（持久化于 run/state.json；重启恢复）。 */
export interface SchedulerState {
  /** 退避档位（0=全速连转） */
  backoffLevel: number
  /** 当前档位已连续空转唤醒数（HOLD 计数） */
  emptiesAtLevel: number
  /** 下次自发唤醒时刻（epoch ms；rm-then-dispatch 的凭据） */
  wakeAt: number
  /** 最近一次唤醒开始时刻（watchdog 依据） */
  lastWakeAt: number
  /** 主人显式停止（持久，重启仍停；与 config 损坏 fail-safe 互不覆盖） */
  stoppedByMaster: boolean
  /** 时间线 seq 单调计数 */
  lastSeq: number
  /** spend 台账（按日清零） */
  spend: { date: string; usedUsd: number; tokensIn: number; tokensOut: number; llmCalls: number }
  /** 反应性窗口（合并窗口 + 小时上限计数） */
  reactive: { windowStart: number; count: number }
  /** 方案 A 底座会话（复用；输入 token 超阈值即重建） */
  mindSessionId?: string
  /** 会话事件游标（follow/page 回放定位） */
  cursor?: number
  /** 唤醒 run 进行中（持久化：宿主崩溃后据此识别中断并弃单） */
  running?: boolean
}

export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** 档位 n 的自发唤醒间隔：delay(0)=0；delay(n≥1)=min(base×factor^(n-1), cap)。 */
export function nextDelayMs(cfg: MindConfig, level: number): number {
  if (level <= 0) return 0
  return Math.min(cfg.backoffBaseMs * Math.pow(cfg.backoffFactor, level - 1), cfg.backoffCapMs)
}

export type WakeOutcome = 'engaged' | 'thought' | 'empty'

/**
 * 唤醒结束后推进退避状态（headlong 分级阶梯）：
 * engaged（有可见产出或反应性）→ 归零连转；empty → HOLD 拍停留后降档；
 * thought 与 empty 同阶（THOUGHT_CAP=CAP，v0.2 决策）。
 */
export function advanceAfterWake(state: SchedulerState, outcome: WakeOutcome, cfg: MindConfig): SchedulerState {
  if (outcome === 'engaged') return { ...state, backoffLevel: 0, emptiesAtLevel: 0 }
  const empties = state.emptiesAtLevel + 1
  if (empties < cfg.hold) return { ...state, emptiesAtLevel: empties }
  return { ...state, backoffLevel: state.backoffLevel + 1, emptiesAtLevel: 0 }
}

export type SpendLevel = 'normal' | 'soft' | 'hard'

/** 两级 cap 评估：≥硬顶=hard（停自发留反应性）；≥软顶=soft（降级快模型）。 */
export function evaluateSpend(state: SchedulerState, cfg: MindConfig, now: Date): SpendLevel {
  const used = state.spend.date === dayKey(now) ? state.spend.usedUsd : 0
  if (used >= cfg.spendHardCapUsd) return 'hard'
  if (used >= cfg.spendSoftCapUsd) return 'soft'
  return 'normal'
}

/** 静音时段判定：按配置时区取本地小时（hh:mm 闭开区间，支持跨午夜）。 */
export function isQuietHour(now: Date, cfg: MindConfig): boolean {
  const q = cfg.quietHours
  if (!q.enabled) return false
  let hour = now.getUTCHours()
  let minute = now.getUTCMinutes()
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: q.tz, hour12: false, hour: '2-digit', minute: '2-digit',
    }).formatToParts(now)
    const h = parts.find(p => p.type === 'hour')?.value
    const m = parts.find(p => p.type === 'minute')?.value
    if (h !== undefined) hour = Number(h) % 24
    if (m !== undefined) minute = Number(m)
  } catch {
    /* 时区名非法：退回 UTC */
  }
  const nowMin = hour * 60 + minute
  const parseHm = (s: string): number => {
    const [h, m] = s.split(':')
    return (Number(h) || 0) * 60 + (Number(m) || 0)
  }
  const startMin = parseHm(q.start)
  const endMin = parseHm(q.end)
  if (startMin === endMin) return false
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin
  return nowMin >= startMin || nowMin < endMin // 跨午夜
}

export interface TriggerInputs {
  /** 待处理的 reactive 观察（合并窗口后的 message_in） */
  reactiveQueued: boolean
  /** 事件触发（task-board 终态/待审批等；P1 恒 false，惰性启用） */
  eventQueued: boolean
}

export interface TriggerDecision {
  fire: boolean
  trigger: 'spontaneous' | 'reactive' | 'event' | 'watchdog' | 'none'
  reason: string
}

/**
 * 触发收集（设计 §4.1/§5/§11）：优先级 event > reactive > watchdog > spontaneous；
 * 显式停止压倒一切；spontaneous 受静音时段与 spend hard 闸；reactive 不受退避但受
 * §5.3 护栏（窗口/小时上限由入口维护，此处只见"是否已获准入队"）。
 */
export function collectDueMindTriggers(
  now: number,
  state: SchedulerState,
  cfg: MindConfig,
  inputs: TriggerInputs,
): TriggerDecision {
  if (state.stoppedByMaster || !cfg.enabled) {
    return { fire: false, trigger: 'none', reason: 'paused' }
  }
  if (inputs.eventQueued) return { fire: true, trigger: 'event', reason: 'event queued' }
  if (inputs.reactiveQueued) return { fire: true, trigger: 'reactive', reason: 'message queued' }
  const spend = evaluateSpend(state, cfg, new Date(now))
  // watchdog：lastWakeAt 起静默超 2×硬超时 → 合成唤醒（不复活暂停态——paused 已在上面返回）
  if (state.lastWakeAt > 0 && now - state.lastWakeAt > cfg.wakeTimeoutMs * 2) {
    return { fire: true, trigger: 'watchdog', reason: 'watchdog silence' }
  }
  if (isQuietHour(new Date(now), cfg)) {
    return { fire: false, trigger: 'none', reason: 'quiet hours' }
  }
  if (spend === 'hard') {
    return { fire: false, trigger: 'none', reason: 'spend hard cap' }
  }
  if (state.wakeAt > 0 && now >= state.wakeAt) {
    return { fire: true, trigger: 'spontaneous', reason: spend === 'soft' ? 'due (soft: fast model)' : 'due' }
  }
  return { fire: false, trigger: 'none', reason: 'not due' }
}

/** 唤醒完成后的下次自发唤醒时刻（rm-then-dispatch：由入口原子写回 state.wakeAt）。 */
export function scheduleNextSpontaneous(state: SchedulerState, cfg: MindConfig, now: number, outcome: WakeOutcome): number {
  const next = advanceAfterWake(state, outcome, cfg)
  return now + nextDelayMs(cfg, next.backoffLevel)
}

/** 唤醒 run 成本核算（token × 单价；纯函数）。 */
export function costUsd(cfg: MindConfig, tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1e6) * cfg.priceUsdPerMTokIn + (tokensOut / 1e6) * cfg.priceUsdPerMTokOut
}
