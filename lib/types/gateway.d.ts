/**
 * typertGateway 接线封装（契约照搬 dsh-task-board/src/gateway.ts——wire-args 布局
 * 是 0.1.2 系 descriptor 表的硬约束）。
 */
export interface GatewayInvokeSpec {
    namespace: string;
    method: string;
    args: Record<string, unknown>;
    signal?: AbortSignal;
}
export interface TypertGateway {
    invoke(spec: GatewayInvokeSpec): Promise<unknown>;
    stream?(spec: GatewayInvokeSpec): Promise<AsyncIterable<unknown>>;
}
export interface SessionSummary {
    sessionId: string;
    running?: boolean;
    title?: string;
}
export interface SessionPage {
    records: ReadonlyArray<{
        event: {
            type: string;
            seq: number;
            time: number;
            data: unknown;
        };
    }>;
    hasMore?: boolean;
    cursor?: number;
}
export declare function wireArgs(namespace: string, method: string, request: Record<string, unknown>): Record<string, unknown>;
export declare class GatewayClient {
    private readonly gateway;
    constructor(gateway: TypertGateway);
    invoke(namespace: string, method: string, request?: Record<string, unknown>): Promise<unknown>;
    stream(namespace: string, method: string, request: Record<string, unknown>): Promise<AsyncIterable<unknown>>;
}
export declare function sessionAddress(sessionId: string): {
    kind: 'session';
    sessionId: string;
};
