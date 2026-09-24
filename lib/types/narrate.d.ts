/**
 * 心智叙事层：把时间线步骤（机器语义）翻译为第一人称生活语言（人的语义）。
 *
 * 纯函数、零依赖（仅类型导入），客户端与测试共用。
 * 原则：机器状态翻译成人的状态；治理/成本数据降为可展开的细节；
 * error 温和呈现（「念头断了」而非「报错」）；idle 折叠为休息。
 */
import type { TimelineStep } from './timeline.ts';
export type NarratedKind = 'you' | 'mind' | 'moment' | 'rest' | 'break';
export interface NarratedStep {
    seq: number;
    ts: string;
    kind: NarratedKind;
    /** 第一人称主句（TA 的视角）。 */
    title: string;
    /** 正文（TA 说的话/做的事）。 */
    body?: string;
    /** 工程细节（触发源/用量/成本），人视图默认收起。 */
    detail?: string;
    tone?: 'normal' | 'subtle' | 'warn';
    /** 折叠明细（仅合并的休息步）：原始各拍可展开查看。 */
    fold?: {
        count: number;
        fromTs: string;
        toTs: string;
        items: NarratedStep[];
    };
}
/** 单步 → 叙事。未知类型回落为 moment（保守呈现，不丢内容）。 */
export declare function narrateStep(s: TimelineStep): NarratedStep;
export interface DayGroup {
    /** 今天 / 昨天 / M月D日（跨年带年份）。 */
    label: string;
    /** 天内旧→新。 */
    steps: NarratedStep[];
}
/** 折叠连续的休息步：人不会每分钟写一篇一模一样的空日记（设计 §12.1 idle 折叠纪律）。
 *  折叠结果携带 fold 明细（原始各拍），UI 可点击展开查看。 */
export declare function coalesceRests(steps: NarratedStep[]): NarratedStep[];
/** 新→旧 的步骤流 → 天分组（新天在前，天内旧→新，连续休息折叠）。 */
export declare function groupByDay(steps: TimelineStep[], now: Date): DayGroup[];
export interface PresenceInput {
    enabled: boolean;
    stoppedByMaster: boolean;
    running: boolean;
    quiet?: {
        enabled: boolean;
        active: boolean;
        start: string;
        end: string;
    };
    wakeAt: number;
    spend?: {
        usedUsd: number;
        hardCapUsd: number;
    };
    /** 注入 pending 消息数（对 TA 说话后 TA 还没醒时 >0）。 */
    pending?: number;
    /** P5 请求账：等待主人的 open 请求数（§6.5——存在语义之外的依赖语义）。 */
    openAsks?: number;
    /** 最早一条请求的 what（存在句素材）。 */
    openAskWhat?: string;
}
/** 在场感一句话：TA 现在怎么样（第一人称）。 */
export declare function presenceLine(s: PresenceInput, now?: number): string;
/** 时间感知问候（页面头部）。 */
export declare function greeting(now: Date): string;
export type BeingMood = 'stopped' | 'asleep' | 'attentive' | 'thinking' | 'awake';
export interface BeingStatusInput {
    enabled: boolean;
    stoppedByMaster: boolean;
    running: boolean;
    quiet?: {
        enabled: boolean;
        active: boolean;
        start: string;
        end: string;
    };
    pending?: number;
}
/** 状态 → 形体情态（优先级：叫停 > 入睡 > 注意到你 > 思考 > 清醒）。 */
export declare function beingMood(s: BeingStatusInput | undefined): BeingMood;
