/**
 * P3.2 分层 LLM 摘要的存储与跨度选择：
 * - rollups.jsonl：LLM 卷积产物（带 step-id 引用区间），唤醒上下文的「生命概览」
 *   优先取这里的语义摘要，机械统计（recap.ts）兜底；
 * - selectRollupSpan：凑满 F 条未卷积步骤即给出摘要跨度（纯函数，确定性可测）。
 *
 * 摘要的摘要是传闻——每条记录只覆盖一段原始步骤（refs.steps=[from,to]），
 * 不跨层伪造；原始日志仍是证词，摘要只是索引。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mindHome } from "./config.js";
import { RECAP_FANOUT } from "./recap.js";
export function rollupsPath() {
    return join(mindHome(), 'rollups.jsonl');
}
export function appendRollup(rec) {
    const file = rollupsPath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(rec)}\n`, { encoding: 'utf8', flag: 'a' });
}
/** 读最近 n 条（新→旧；坏行跳过）。 */
export function readRollups(n = 12) {
    const file = rollupsPath();
    if (!existsSync(file))
        return [];
    const out = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '')
            continue;
        try {
            const rec = JSON.parse(line);
            if (rec?.v === 1 && typeof rec.text === 'string' && rec.refs?.steps?.length === 2)
                out.push(rec);
        }
        catch { /* 坏行跳过 */ }
    }
    return out.length > n ? out.slice(out.length - n).reverse() : out.reverse();
}
/** 摘要跨度选择（纯函数）：游标之后凑满 F 条 → 取最早 F 条 + 新游标；否则 null。 */
export function selectRollupSpan(steps, lastRolledUpSeq, fanout = RECAP_FANOUT) {
    const pending = steps.filter(s => typeof s.seq === 'number' && s.seq > lastRolledUpSeq);
    if (pending.length < fanout)
        return null;
    const span = pending.slice(0, fanout);
    return { span, upToSeq: span.at(-1).seq };
}
/** 摘要提示词（纯函数；低配会话用——只许输出摘要本身）。 */
export function buildRollupPrompt(span) {
    const lines = span.map(s => `[#${s.seq} ${s.ts.slice(5, 16).replace('T', ' ')} ${s.type}${s.fn !== undefined ? `/${s.fn}` : ''}] ${s.content.slice(0, 200)}`);
    return [
        '你是分身的记忆管理员。把下面一段时间线步骤压缩成**一条**摘要，供分身很久以后回忆「这段时间发生了什么」。要求：',
        '- 只保留会长期重要的事实、决定、教训、未竟事项；日常空转与客套全部丢弃',
        '- 最多 120 字，陈述句，不用列表不用格式词，输出摘要本身（不要前导语）',
        '',
        ...lines,
    ].join('\n');
}
