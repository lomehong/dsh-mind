/**
 * 唤醒调度纯函数（设计 §5/§11）：退避阶梯、触发收集、两级 spend cap、静音时段。
 * 全部无副作用、无时钟读取（now 由调用方注入）——确定性可测（G8）。
 */
import type { MindConfig } from './config.ts';
/** 调度状态（持久化于 run/state.json；重启恢复）。 */
export interface SchedulerState {
    /** 退避档位（0=全速连转） */
    backoffLevel: number;
    /** 当前档位已连续空转唤醒数（HOLD 计数） */
    emptiesAtLevel: number;
    /** 下次自发唤醒时刻（epoch ms；rm-then-dispatch 的凭据） */
    wakeAt: number;
    /** 最近一次唤醒开始时刻（watchdog 依据） */
    lastWakeAt: number;
    /** 主人显式停止（持久，重启仍停；与 config 损坏 fail-safe 互不覆盖） */
    stoppedByMaster: boolean;
    /** 时间线 seq 单调计数 */
    lastSeq: number;
    /** spend 台账（按日清零） */
    spend: {
        date: string;
        usedUsd: number;
        tokensIn: number;
        tokensOut: number;
        llmCalls: number;
    };
    /** 反应性窗口（合并窗口 + 小时上限计数） */
    reactive: {
        windowStart: number;
        count: number;
    };
    /** 方案 A 底座会话（复用；输入 token 超阈值即重建） */
    mindSessionId?: string;
    /** 会话事件游标（follow/page 回放定位） */
    cursor?: number;
    /** 唤醒 run 进行中（持久化：宿主崩溃后据此识别中断并弃单） */
    running?: boolean;
    /** 自治面被拒的审批数（需主人知晓/批准后心智方可做此类动作） */
    pendingApprovals: number;
}
export declare function dayKey(now: Date): string;
/** 档位 n 的自发唤醒间隔：min(base×factor^(n-1), cap)，并夹到自驱地板。
 *  地板（默认 5 分钟）实现设计 G1「最低 5 分钟一醒」；2026-09-22 成本事故：
 *  旧实现 L0 立即连转 + 5s 起跳，engaged 归零后实测 15–45s 一拍。 */
export declare function nextDelayMs(cfg: MindConfig, level: number): number;
/** 机械空醒短路的判定输入。 */
export interface ShortCircuitInputs {
    /** 反应性观察在队（对 TA 说话——必须唤起，绝不短路）。 */
    reactiveQueued: boolean;
    /** 事件触发（task-board 终态/待审批——必须唤起）。 */
    eventQueued: boolean;
    /** 上次唤醒之后新增的观察类步骤数（message_in/observation/task）。 */
    newObservations: number;
    /** 上一拍（wake 或机械 idle）也是空转。 */
    lastWasIdle: boolean;
}
/**
 * 机械空醒短路（成本闸，2026-09-22 事故引入）：自驱唤醒若「无新观察、无事件、
 * 无待批、且上一拍亦空转」，则无事可议——不调用模型，直接记 idle 步骤续排。
 * 反应性/事件触发永不短路（G3：回应人永不限速），配额由调用方保证。
 */
export declare function shouldShortCircuitSpontaneous(cfg: MindConfig, state: SchedulerState, inputs: ShortCircuitInputs): boolean;
export type WakeOutcome = 'engaged' | 'thought' | 'empty';
/**
 * 唤醒结束后推进退避状态（headlong 分级阶梯）：
 * engaged（有可见产出或反应性）→ 归零连转；empty → HOLD 拍停留后降档；
 * thought 与 empty 同阶（THOUGHT_CAP=CAP，v0.2 决策）。
 */
export declare function advanceAfterWake(state: SchedulerState, outcome: WakeOutcome, cfg: MindConfig): SchedulerState;
export type SpendLevel = 'normal' | 'soft' | 'hard';
/** 两级 cap 评估：≥硬顶=hard（停自发留反应性）；≥软顶=soft（降级快模型）。 */
export declare function evaluateSpend(state: SchedulerState, cfg: MindConfig, now: Date): SpendLevel;
/** 静音时段判定：按配置时区取本地小时（hh:mm 闭开区间，支持跨午夜）。 */
export declare function isQuietHour(now: Date, cfg: MindConfig): boolean;
export interface TriggerInputs {
    /** 待处理的 reactive 观察（合并窗口后的 message_in） */
    reactiveQueued: boolean;
    /** 事件触发（task-board 终态/待审批等；P1 恒 false，惰性启用） */
    eventQueued: boolean;
}
export interface TriggerDecision {
    fire: boolean;
    trigger: 'spontaneous' | 'reactive' | 'event' | 'watchdog' | 'none';
    reason: string;
}
/**
 * 触发收集（设计 §4.1/§5/§11）：优先级 event > reactive > watchdog > spontaneous；
 * 显式停止压倒一切；spontaneous 受静音时段与 spend hard 闸；reactive 不受退避但受
 * §5.3 护栏（窗口/小时上限由入口维护，此处只见"是否已获准入队"）。
 */
export declare function collectDueMindTriggers(now: number, state: SchedulerState, cfg: MindConfig, inputs: TriggerInputs): TriggerDecision;
/** 唤醒完成后的下次自发唤醒时刻（rm-then-dispatch：由入口原子写回 state.wakeAt）。 */
export declare function scheduleNextSpontaneous(state: SchedulerState, cfg: MindConfig, now: number, outcome: WakeOutcome): number;
/** 唤醒 run 成本核算（token × 单价；纯函数）。 */
export declare function costUsd(cfg: MindConfig, tokensIn: number, tokensOut: number): number;
