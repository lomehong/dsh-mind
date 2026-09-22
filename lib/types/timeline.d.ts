export type StepType = 'thought' | 'observation' | 'action' | 'message_in' | 'message_out' | 'task' | 'idle' | 'error' | 'wake';
/** 时间线步骤（设计 §3.1 schema v2）。必填 pin：v/seq/ts/type/source。 */
export interface TimelineStep {
    v: 2;
    seq: number;
    ts: string;
    type: StepType;
    source: string;
    content: string;
    /** 仅 wake 步骤：触发源 */
    trigger?: 'spontaneous' | 'reactive' | 'event' | 'watchdog';
    /** 仅 wake 步骤：函数选择 */
    fn?: 'act' | 'share' | 'think' | 'learn' | 'recall' | 'goals' | 'idle';
    /** 仅 wake 步骤：FINAL 交接棒 */
    final?: string;
    /** 仅 wake 步骤：用量与成本 */
    usage?: {
        llmCalls: number;
        tokensIn: number;
        tokensOut: number;
        costUsd: number;
    };
    /** 仅 wake 步骤：退避档位 */
    backoffLevel?: number;
    /** 交付步骤：被解决的 message_in seq */
    resolves?: number;
    refs?: Record<string, string>;
}
export declare function timelinePath(): string;
export declare function archivePath(month: string): string;
/**
 * 追加一步（调用方持有 seq 单调计数；写入为整行 append，单写者下原子）。
 * 失败抛错由调用方防御——时间线写失败不阻断心智主流程。
 */
export declare function appendStep(step: TimelineStep): void;
/** 半行容错读尾部：返回最近 maxSteps 条可解析步骤（**新→旧** 排列）；崩溃残留的坏尾行被跳过并计数。 */
export declare function readTail(maxSteps: number): {
    steps: TimelineStep[];
    skippedBadTail: number;
};
/**
 * 滚动归档：把 ts 早于 cutoffDays 天的步骤移入按月归档件。
 * 实现为整文件重写（时间线体量 P1 有限；P3 金字塔时代换分段存储）。
 * @returns 归档的步骤数（无文件返回 0）
 */
export declare function archiveOldSteps(cutoffDays: number, now?: Date): number;
