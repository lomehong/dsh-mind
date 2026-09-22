/**
 * 唤醒执行器（方案 A，设计 §4.3）：经 typertGateway 在 digital-twin 预设的
 * 常驻心智会话上投递唤醒提示词，轮询 turn/end，抽取 FINAL 与用量。
 *
 * 会话生命周期：懒创建一次、跨唤醒复用（避免会话列表污染）；输入 token 超过
 * resetThreshold 即弃旧重建（上下文预算护栏）。轮询/结算契约照搬
 * dsh-task-board runner（follow 激活 → cursor → page 回溯 turn/end）。
 */
import { GatewayClient } from './gateway.ts';
export interface WakeRunnerOptions {
    presetId: string;
    title: string;
    timeoutMs: number;
    resetThresholdTokens: number;
    pollIntervalMs?: number;
}
export interface WakeRunResult {
    final: string;
    toolCalls: number;
    tokensIn: number;
    tokensOut: number;
}
/** 唤醒超时（携带已观测的部分用量——超时唤醒的 token 也计费，必须入台账）。 */
export declare class MindWakeTimeoutError extends Error {
    readonly usage: {
        tokensIn: number;
        tokensOut: number;
    };
    constructor(timeoutMs: number, usage: {
        tokensIn: number;
        tokensOut: number;
    });
}
export declare class WakeRunner {
    private readonly gw;
    private readonly opts;
    private readonly pollMs;
    constructor(gw: GatewayClient, opts: WakeRunnerOptions);
    /** 确保心智会话存在（复用；缺失/超阈值时重建）。 */
    ensureSession(currentId: string | undefined, lastTokensIn: number): Promise<{
        sessionId: string;
        reset: boolean;
    }>;
    /** 投递唤醒提示词并等待本轮 turn/end；按认领的 turn 号抽取 FINAL 与用量。
     *  超时抛 MindWakeTimeoutError（携带已观测的部分用量——超时唤醒的 token 也
     *  计费，必须入台账；2026-09-22 计量流失修复）。 */
    runWake(sessionId: string, prompt: string): Promise<WakeRunResult>;
    /** 单次结算探测：turn/end 已落 → 返回 page（含该轮全部记录）；否则 undefined。
     *  onUsage：逐事件把 assistant/message 的 usage 喂给调用方（高水位累积，
     *  超时路径也能把已发生费用带出去）。 */
    private inspectOnce;
}
