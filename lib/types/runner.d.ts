/**
 * 唤醒执行器（方案 A，设计 §4.3）：经 typertGateway 在 digital-twin 预设的
 * 常驻心智会话上投递唤醒提示词，轮询 turn/end，抽取 FINAL 与用量。
 *
 * 会话生命周期：懒创建一次、跨唤醒复用（避免会话列表污染）；输入 token 超过
 * resetThreshold 即弃旧重建（上下文预算护栏，设计 §1 sessionResetTokens）。
 * 轮询/结算契约照搬 dsh-task-board runner（follow 激活 → cursor → page 回溯
 * turn/end）。
 */
import { GatewayClient } from './gateway.ts';
export interface WakeRunResult {
    final: string;
    toolCalls: number;
    tokensIn: number;
    tokensOut: number;
}
export interface WakeRunnerOptions {
    presetId: string;
    title: string;
    timeoutMs: number;
    resetThresholdTokens: number;
    pollIntervalMs?: number;
}
export declare class WakeRunner {
    private readonly gw;
    private readonly opts;
    private readonly pollMs;
    constructor(gw: GatewayClient, opts: WakeRunnerOptions);
    /** 确保心智会话存在（复用；缺失/超阈值时重建）。返回 [sessionId, reset]。 */
    ensureSession(currentId: string | undefined, lastTokensIn: number): Promise<{
        sessionId: string;
        reset: boolean;
    }>;
    /** 投递唤醒提示词并等待本轮 turn/end；抽取 FINAL 与用量。超时抛错（续命归调度器）。 */
    runWake(sessionId: string, prompt: string): Promise<WakeRunResult>;
    /** 单次结算探测：turn/end 已落 → 返回 page（含该轮全部记录）；否则 undefined。 */
    private inspectOnce;
}
