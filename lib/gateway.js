/**
 * typertGateway 接线封装（契约照搬 dsh-task-board/src/gateway.ts——wire-args 布局
 * 是 0.1.2 系 descriptor 表的硬约束）。
 *
 * 2026-11-16 事故修正（宿主 0.2.0-rc.2 → 0.2.2-rc.3 自愈升级后）：宿主网关把
 * InvokeRemoteRequest.peer 升为必填（"every carrier and in-process caller names it
 * explicitly"），进程内调用者不带 peer 时 assertPeerLive 读 peer.signal 直接抛
 * "Cannot read properties of undefined (reading 'signal')"——唤醒每拍必炸、时间线
 * 被错误刷屏。修正：进程内经 connection.createPeer({ principal: { kind: 'owner' } })
 * 建一只 owner Peer，随 GatewayClient 注入每一次 invoke/stream（owner principal
 * 免资源闸，与宿主浏览器 Peer 同款语义）。
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
    peer;
    constructor(gateway, peer) {
        this.gateway = gateway;
        this.peer = peer;
    }
    invoke(namespace, method, request = {}) {
        return this.gateway.invoke({ namespace, method, args: wireArgs(namespace, method, request), peer: this.peer });
    }
    async stream(namespace, method, request) {
        if (this.gateway.stream === undefined)
            throw new Error('gateway stream is unavailable');
        return await this.gateway.stream({ namespace, method, args: wireArgs(namespace, method, request), peer: this.peer });
    }
}
/** 测试/脚本用的假 owner Peer；真实运行时一律经 connection.createPeer 构造。 */
export function testGatewayPeer() {
    return { signal: new AbortController().signal, principal: { kind: 'owner' } };
}
export function sessionAddress(sessionId) {
    return { kind: 'session', sessionId };
}
