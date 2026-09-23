/**
 * 时间线分层 recap（设计 P3；headlong tiered_memory 的机械卷积零成本版）。
 *
 * headlong 用快模型对轨迹做逐层 LLM 摘要；P1 时间线体量有限且为控成本，
 * P3-v1 采用**机械卷积**：F=10 几何粗化的分层聚合——每层条目覆盖 F^k 步，
 * 内容为该跨度的统计画像（时间跨度/函数分布/类型分布/高频关键词/最后交接棒）。
 * 原始日志是证词，各层只是索引；唤醒上下文 = 近期原文（readTail）+ 各层
 * 一行式生命概览——有界空间覆盖一生，零 LLM 成本。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mindHome } from "./config.js";
export const RECAP_FANOUT = 10;
const STOPWORDS = new Set([
    '的', '了', '是', '在', '我', '有', '和', '与', '就', '都', '也', '不', '没', '很',
    '一个', '一下', '这个', '那个', '什么', '怎么', '然后', '所以', '因为', '如果',
    'the', 'and', 'for', 'with', 'this', 'that', 'have', 'was', 'are', 'will',
]);
/** 关键词提取（复用 dsh-memory splitKeywords 的思路：CJK 2-gram + 拉丁词 + 停用词）。 */
export function topKeywords(texts, limit = 5) {
    const freq = new Map();
    const push = (kw) => {
        if (kw.length < 2 || kw.length > 24 || STOPWORDS.has(kw))
            return;
        freq.set(kw, (freq.get(kw) ?? 0) + 1);
    };
    for (const text of texts) {
        for (const m of text.matchAll(/[A-Za-z0-9_@.#/-]{2,}/g))
            push(m[0].toLowerCase());
        for (const m of text.matchAll(/[\u4e00-\u9fff]{2,}/g)) {
            const run = m[0];
            if (run.length <= 4) {
                push(run);
                continue;
            }
            for (let i = 0; i + 2 <= run.length; i++)
                push(run.slice(i, i + 2));
        }
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([kw]) => kw);
}
function mixOf(steps) {
    const counts = new Map();
    for (const s of steps) {
        const key = s.type === 'wake' ? `wake:${s.fn ?? '?'}` : s.type;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, n]) => `${k}:${n}`)
        .join(' ');
}
/** 对一步序列做一层聚合（纯函数）。 */
export function rollupSpan(steps) {
    // 兼容两种输入形态：原始步骤（content）与低阶 RollupEntry（mix+keywords，
    // 经 recapTiers 的 as-cast 复用本函数向上卷积）——摘要的摘要是传闻，
    // 因此跨层传递的是画像与关键词，不伪造原文。
    const contents = steps.map(s => {
        const anyS = s;
        if (typeof anyS.content === 'string')
            return anyS.content;
        return [anyS.mix, ...(anyS.keywords ?? [])].filter(Boolean).join(' ');
    }).filter(c => c.trim() !== '');
    const lastWake = [...steps].reverse().find(s => s.final !== undefined || s.type === 'wake');
    const lastFinal = lastWake !== undefined
        ? (lastWake.final ??
            lastWake.lastFinal)
        : undefined;
    return {
        span: steps.length,
        from: steps[0]?.ts ?? '',
        to: steps.at(-1)?.ts ?? '',
        mix: mixOf(steps.map(s => ({ ...s, type: s.type ?? s.span?.toString() ?? 'rollup' }))),
        keywords: topKeywords(contents),
        ...(lastFinal !== undefined ? { lastFinal: String(lastFinal).slice(0, 200) } : {}),
    };
}
/** 层级线（tier k 的全部聚合，几何粗化；纯函数）。 */
export function recapTiers(steps, fanout = RECAP_FANOUT) {
    const tiers = [];
    let current = [...steps];
    while (current.length >= fanout) {
        const next = [];
        for (let i = 0; i + fanout <= current.length; i += fanout) {
            next.push(rollupSpan(current.slice(i, i + fanout)));
        }
        tiers.push(next);
        current = next;
    }
    return tiers;
}
function formatTierLine(tierIndex, entry) {
    const from = entry.from.slice(5, 16).replace('T', ' ');
    const to = entry.to.slice(5, 16).replace('T', ' ');
    const kw = entry.keywords.length > 0 ? `；关键词 ${entry.keywords.join('/')}` : '';
    const fin = entry.lastFinal !== undefined ? `；末了：${entry.lastFinal}` : '';
    return `- 第${tierIndex + 1}层（${entry.span} 步，${from} ~ ${to}）：${entry.mix}${kw}${fin}`;
}
/**
 * 生命概览（唤醒上下文用）：LLM 语义摘要（有则优先）+ 全部时间线的机械分层线；
 * 尾部明细由 readTail 承担。有界空间覆盖一生：层数 ⌈log_F N⌉，总条目 ∝ log(N)。
 */
export function renderLifeRecap(steps, cfg, fanout = RECAP_FANOUT, rollups) {
    const lines = [];
    const total = steps.length;
    if (total < fanout && (rollups === undefined || rollups.length === 0))
        return ''; // 不足一层：尾部明细已覆盖，零成本
    lines.push(`## 生命概览（全部 ${total} 步，分层分辨率随年龄递减；细读用时间线工具）`);
    // LLM 语义摘要（新→旧，最多 8 条）——每条只覆盖 refs.steps 区间的原始步骤
    for (const r of rollups ?? []) {
        const from = r.ts.slice(5, 16).replace('T', ' ');
        lines.push(`- 摘要（至 ${from}，#L${r.refs.steps[0]}~${r.refs.steps[1]}）：${r.text}`);
    }
    if (total >= fanout) {
        const tiers = recapTiers(steps, fanout);
        // 从最粗层到最细层取摘要线；条目超 12 行时均匀采样（保持粗层全量优先）
        const flat = [];
        tiers.forEach((tier, ti) => { for (const entry of tier)
            flat.push({ tier: ti, entry }); });
        const maxLines = 12;
        const picked = flat.length <= maxLines
            ? flat
            : flat.filter((_, i) => i % Math.ceil(flat.length / maxLines) === 0);
        for (const { tier, entry } of picked)
            lines.push(formatTierLine(tier, entry));
    }
    return lines.join('\n');
}
/** 从磁盘读全量时间线步骤（recap 用；体量大时 P3+ 换分段存储）。 */
export function readAllSteps() {
    const file = join(mindHome(), 'timeline.jsonl');
    if (!existsSync(file))
        return [];
    const steps = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '')
            continue;
        try {
            steps.push(JSON.parse(line));
        }
        catch { /* 坏行跳过 */ }
    }
    return steps;
}
