/**
 * 唤醒执行器（方案 A，设计 §4.3）：经 typertGateway 在 digital-twin 预设的
 * 常驻心智会话上投递唤醒提示词，轮询 turn/end，抽取 FINAL 与用量。
 *
 * 会话生命周期：懒创建一次、跨唤醒复用（避免会话列表污染）；输入 token 超过
 * resetThreshold 即弃旧重建（上下文预算护栏）。轮询/结算契约照搬
 * dsh-task-board runner（follow 激活 → cursor → page 回溯 turn/end）。
 */
import { sessionAddress } from "./gateway.js";
/** 唤醒超时（携带已观测的部分用量——超时唤醒的 token 也计费，必须入台账）。 */
export class MindWakeTimeoutError extends Error {
    usage;
    constructor(timeoutMs, usage) {
        super(`mind wake run timed out after ${timeoutMs}ms`);
        this.name = 'MindWakeTimeoutError';
        this.usage = usage;
    }
}
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
    /** 确保心智会话存在（复用；缺失/超阈值时重建）。 */
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
    /** 投递唤醒提示词并等待本轮 turn/end；按认领的 turn 号抽取 FINAL 与用量。
     *  超时抛 MindWakeTimeoutError（携带已观测的部分用量——超时唤醒的 token 也
     *  计费，必须入台账；2026-09-22 计量流失修复）。 */
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
        // 用量高水位：逐轮轮询累积新看到的 assistant/message 用量（按事件 seq 去重），
        // 超时/异常时也能把已发生的费用带出去。
        const seenSeqs = new Set();
        let hwTokensIn = 0;
        let hwTokensOut = 0;
        let page;
        for (;;) {
            if (Date.now() > deadline) {
                throw new MindWakeTimeoutError(this.opts.timeoutMs, { tokensIn: hwTokensIn, tokensOut: hwTokensOut });
            }
            await new Promise(r => setTimeout(r, this.pollMs));
            const done = await this.inspectOnce(sessionId, startedAt, seenSeqs, (u) => {
                hwTokensIn += u.tokensIn;
                hwTokensOut += u.tokensOut;
            });
            if (done !== undefined) {
                page = done;
                break;
            }
        }
        const records = (page?.records ?? []).map(r => r.event)
            .filter(e => typeof e.time === 'number' && e.time >= startedAt)
            .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        // 按 turn 号结算：本唤醒认领的 turn = 窗口内 turn/end 之 data.turn。
        // 持久会话复用下，上一唤醒的尾巴事件也会落进时间窗——只认同 turn 号的事件，
        // 避免把上一轮的用量/文本错记到本次（2026-09-22 事故：唤醒#2 结算了 turn 1 尾巴）。
        const turnEnd = records.find(e => e.type === 'turn/end');
        if (turnEnd === undefined)
            throw new Error('mind wake run ended without turn/end');
        const turnNo = turnEnd.data.turn;
        let final = '';
        let toolCalls = 0;
        let tokensIn = 0;
        let tokensOut = 0;
        for (const e of records) {
            if (e.data?.turn !== turnNo)
                continue;
            if (e.type === 'tool/call')
                toolCalls += 1;
            if (e.type === 'assistant/message') {
                const data = e.data;
                const text = textOf(data.message?.content);
                if (text.trim() !== '')
                    final = text;
                tokensIn += data.usage?.inputTokens ?? data.usage?.input ?? 0;
                tokensOut += data.usage?.outputTokens ?? data.usage?.output ?? 0;
            }
        }
        return { final, toolCalls, tokensIn, tokensOut };
    }
    /** 单次结算探测：turn/end 已落 → 返回 page（含该轮全部记录）；否则 undefined。
     *  onUsage：逐事件把 assistant/message 的 usage 喂给调用方（高水位累积，
     *  超时路径也能把已发生费用带出去）。 */
    async inspectOnce(sessionId, startedAt, seenSeqs, onUsage) {
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
        for (const r of page.records) {
            const e = r.event;
            if (e.type !== 'assistant/message')
                continue;
            const seq = typeof r.event.seq === 'number' ? r.event.seq : -1;
            if (seq >= 0 && seenSeqs.has(seq))
                continue;
            if (seq >= 0)
                seenSeqs.add(seq);
            const data = e.data;
            const input = data?.usage?.inputTokens ?? data?.usage?.input ?? 0;
            const output = data?.usage?.outputTokens ?? data?.usage?.output ?? 0;
            if (input > 0 || output > 0)
                onUsage({ tokensIn: input, tokensOut: output });
        }
        return turnEnd === undefined ? undefined : page;
    }
}
