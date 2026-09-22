/**
 * 唤醒执行器（方案 A，设计 §4.3）：经 typertGateway 在 digital-twin 预设的
 * 常驻心智会话上投递唤醒提示词，轮询 turn/end，抽取 FINAL 与用量。
 *
 * 会话生命周期：懒创建一次、跨唤醒复用（避免会话列表污染）；输入 token 超过
 * resetThreshold 即弃旧重建（上下文预算护栏，设计 §1 sessionResetTokens）。
 * 轮询/结算契约照搬 dsh-task-board runner（follow 激活 → cursor → page 回溯
 * turn/end）。
 */
import { sessionAddress } from "./gateway.js";
function textOf(content) {
    if (!Array.isArray(content))
        return '';
    return content
        .filter(b => b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
        .map(b => b.text)
        .join('');
}
export class WakeRunner {
    gw;
    opts;
    pollMs;
    constructor(gw, opts) {
        this.gw = gw;
        this.opts = opts;
        this.pollMs = opts.pollIntervalMs ?? 2000;
    }
    /** 确保心智会话存在（复用；缺失/超阈值时重建）。返回 [sessionId, reset]。 */
    async ensureSession(currentId, lastTokensIn) {
        if (currentId !== undefined && lastTokensIn < this.opts.resetThresholdTokens) {
            try {
                const list = (await this.gw.invoke('session', 'list'));
                if ((list.items ?? []).some(i => i.sessionId === currentId))
                    return { sessionId: currentId, reset: false };
            }
            catch { /* list 失败：按需重建 */ }
        }
        const created = (await this.gw.invoke('session', 'create', { agentPreset: this.opts.presetId }));
        const sessionId = created.sessionId;
        try {
            await this.gw.invoke('session', 'rename', { sessionId, title: this.opts.title });
        }
        catch { /* 改名失败不影响功能 */ }
        return { sessionId, reset: true };
    }
    /** 投递唤醒提示词并等待本轮 turn/end；抽取 FINAL 与用量。超时抛错（续命归调度器）。 */
    async runWake(sessionId, prompt) {
        const startedAt = Date.now();
        const requestId = `mind-${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
        await this.gw.invoke('session', 'prompt', {
            sessionId,
            requestId,
            mode: 'queue',
            content: [{ type: 'text', text: prompt }],
        });
        const deadline = startedAt + this.opts.timeoutMs;
        let page;
        for (;;) {
            if (Date.now() > deadline)
                throw new Error(`mind wake run timed out after ${this.opts.timeoutMs}ms`);
            await new Promise(r => setTimeout(r, this.pollMs));
            const done = await this.inspectOnce(sessionId, startedAt);
            if (done !== undefined) {
                page = done;
                break;
            }
        }
        const records = (page?.records ?? []).map(r => r.event)
            .filter(e => typeof e.time === 'number' && e.time >= startedAt)
            .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        let toolCalls = 0;
        let tokensIn = 0;
        let tokensOut = 0;
        let final = '';
        for (const e of records) {
            if (e.type === 'tool/call')
                toolCalls += 1;
            if (e.type === 'assistant/message') {
                const data = e.data;
                const text = textOf(data.message?.content);
                if (text.trim() !== '')
                    final = text;
                tokensIn += data.usage?.input ?? 0;
                tokensOut += data.usage?.output ?? 0;
            }
        }
        return { final, toolCalls, tokensIn, tokensOut };
    }
    /** 单次结算探测：turn/end 已落 → 返回 page（含该轮全部记录）；否则 undefined。 */
    async inspectOnce(sessionId, startedAt) {
        let cursor;
        try {
            const stream = await this.gw.stream('session', 'follow', { address: sessionAddress(sessionId), maxMessages: 1 });
            const iterator = stream[Symbol.asyncIterator]();
            const next = await iterator.next();
            if (typeof iterator.return === 'function')
                await iterator.return();
            const follow = next.done === true ? undefined : next.value;
            if (follow === undefined || follow.type !== 'snapshot' || typeof follow.cursor !== 'number')
                return undefined;
            cursor = follow.cursor;
        }
        catch {
            return undefined;
        }
        let page;
        try {
            page = (await this.gw.invoke('session', 'page', {
                address: sessionAddress(sessionId),
                throughSeq: cursor,
                maxMessages: 200,
            }));
        }
        catch {
            return undefined;
        }
        const turnEnd = page.records
            .map(r => r.event)
            .find(e => e.type === 'turn/end' && typeof e.time === 'number' && e.time >= startedAt);
        return turnEnd === undefined ? undefined : page;
    }
}
