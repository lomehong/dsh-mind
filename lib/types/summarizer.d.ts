/**
 * P3.2 分层 LLM 摘要器：低配会话上跑记忆卷积。
 *
 * - 会话：懒建一只独立低配会话（summarizerPresetId，默认 'default'；缺席回落
 *   心智预设），与心智主会话物理隔离——摘要不污染唤醒上下文，唤醒也不见摘要过程；
 * - 节奏：每次唤醒完成后尝试一次，凑满 F 条未卷积步骤才真正调用（≈每小时 1 次）；
 * - 失败语义：任何失败静默跳过本轮（机械 recap 兜底），绝不击穿宿主（LESSONS 2）。
 */
import { type TypertGateway } from './gateway.ts';
import type { TimelineStep } from './timeline.ts';
export interface RollupOptions {
    gateway: TypertGateway;
    presetId: string;
    summarizerPresetId?: string;
}
/** 尝试做一轮摘要（异步尽力而为；调用方 void 掉，绝不 await 主流程）。 */
export declare function tryRollup(opts: RollupOptions): Promise<{
    ok: boolean;
    reason?: string;
}>;
/** 步骤数守卫（测试/外部调用用）。 */
export declare function countUnrolled(steps: ReadonlyArray<TimelineStep>, lastRolledUpSeq: number): number;
