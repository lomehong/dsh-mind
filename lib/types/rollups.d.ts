import type { TimelineStep } from './timeline.ts';
export interface RollupRecord {
    v: 1;
    seq: number;
    ts: string;
    /** 覆盖的原始步骤 seq 区间（闭区间） */
    refs: {
        steps: [number, number];
    };
    span: number;
    /** LLM 摘要正文（≤200 字） */
    text: string;
}
export declare function rollupsPath(): string;
export declare function appendRollup(rec: RollupRecord): void;
/** 读最近 n 条（新→旧；坏行跳过）。 */
export declare function readRollups(n?: number): RollupRecord[];
/** 摘要跨度选择（纯函数）：游标之后凑满 F 条 → 取最早 F 条 + 新游标；否则 null。 */
export declare function selectRollupSpan(steps: ReadonlyArray<TimelineStep>, lastRolledUpSeq: number, fanout?: number): {
    span: TimelineStep[];
    upToSeq: number;
} | null;
/** 摘要提示词（纯函数；低配会话用——只许输出摘要本身）。 */
export declare function buildRollupPrompt(span: ReadonlyArray<TimelineStep>): string;
