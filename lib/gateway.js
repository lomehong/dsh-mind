/**
 * typertGateway 接线封装（契约照搬 dsh-task-board/src/gateway.ts——wire-args 布局
 * 是 0.1.2 系 descriptor 表的硬约束）。
 */
export function wireArgs(namespace, method, request) {
    if (namespace === 'agentPresets' && method === 'list')
        return {};
    if (namespace === 'session' && method === 'list')
        return { _request: request };
    return { request };
}
export class GatewayClient {
    gateway;
    constructor(gateway) {
        this.gateway = gateway;
    }
    invoke(namespace, method, request = {}) {
        return this.gateway.invoke({ namespace, method, args: wireArgs(namespace, method, request) });
    }
    async stream(namespace, method, request) {
        if (this.gateway.stream === undefined)
            throw new Error('gateway stream is unavailable');
        return await this.gateway.stream({ namespace, method, args: wireArgs(namespace, method, request) });
    }
}
export function sessionAddress(sessionId) {
    return { kind: 'session', sessionId };
}
