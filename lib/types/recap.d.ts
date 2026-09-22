import { type MindConfig } from './config.ts';
import type { TimelineStep } from './timeline.ts';
export declare const RECAP_FANOUT = 10;
/** 一条层内聚合（tier k 的一个条目覆盖 F^k 步）。 */
export interface RollupEntry {
    /** 覆盖步数（F^k） */
    span: number;
    from: string;
    to: string;
    /** 函数/类型分布（"act:3 think:2" 形态，降序） */
    mix: string;
    /** 高频关键词（去停用词后 top 5） */
    keywords: string[];
    /** 跨度内最后一次 FINAL 交接棒（截断） */
    lastFinal?: string;
}
/** 关键词提取（复用 dsh-memory splitKeywords 的思路：CJK 2-gram + 拉丁词 + 停用词）。 */
export declare function topKeywords(texts: ReadonlyArray<string>, limit?: number): string[];
/** 对一步序列做一层聚合（纯函数）。 */
export declare function rollupSpan(steps: ReadonlyArray<TimelineStep>): RollupEntry;
/** 层级线（tier k 的全部聚合，几何粗化；纯函数）。 */
export declare function recapTiers(steps: ReadonlyArray<TimelineStep>, fanout?: number): RollupEntry[][];
/**
 * 生命概览（唤醒上下文用）：全部时间线的分层线 + 尾部明细由 readTail 承担。
 * 有界空间覆盖一生：层数 ⌈log_F N⌉，总条目 ∝ log(N)。
 */
export declare function renderLifeRecap(steps: ReadonlyArray<TimelineStep>, cfg: MindConfig, fanout?: number): string;
/** 从磁盘读全量时间线步骤（recap 用；体量大时 P3+ 换分段存储）。 */
export declare function readAllSteps(): TimelineStep[];
