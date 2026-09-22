const FN_LABELS = {
    think: '我在想',
    act: '我在办一件事',
    share: '我想告诉你',
    learn: '我记住了这件事',
    recall: '我在回想',
    goals: '我在盘算接下来的安排',
    idle: '我歇了一会儿',
};
/** 单步 → 叙事。未知类型回落为 moment（保守呈现，不丢内容）。 */
export function narrateStep(s) {
    const base = { seq: s.seq, ts: s.ts };
    const clip = (t, n = 400) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
    switch (s.type) {
        case 'message_in':
            return { ...base, kind: 'you', title: `你说（来自 ${s.refs?.from ?? s.source}）`, body: clip(s.content) };
        case 'message_out':
            return { ...base, kind: 'mind', title: '我对你说', body: clip(s.content) };
        case 'wake': {
            const fn = s.fn ?? 'think';
            if (fn === 'idle') {
                return { ...base, kind: 'rest', title: FN_LABELS.idle, tone: 'subtle' };
            }
            const label = FN_LABELS[fn] ?? '我在想';
            const parts = [];
            if (s.trigger !== undefined)
                parts.push(s.trigger);
            if (s.usage !== undefined)
                parts.push(`${s.usage.tokensIn}/${s.usage.tokensOut} tok · $${s.usage.costUsd.toFixed(4)}`);
            return {
                ...base,
                kind: 'moment',
                title: `${label}…`,
                body: clip(s.final ?? s.content),
                ...(parts.length > 0 ? { detail: parts.join(' · ') } : {}),
            };
        }
        case 'thought':
            return { ...base, kind: 'moment', title: '我有个念头', body: clip(s.content) };
        case 'observation':
            return { ...base, kind: 'moment', title: '我注意到', body: clip(s.content) };
        case 'task':
            return { ...base, kind: 'moment', title: '我接了一件活', body: clip(s.content) };
        case 'idle':
            return { ...base, kind: 'rest', title: '我歇了一会儿', tone: 'subtle' };
        case 'error':
            return { ...base, kind: 'break', title: '有个念头断了，醒来会接着排', body: clip(s.content, 200), tone: 'warn' };
        default:
            return { ...base, kind: 'moment', title: '……', body: clip(s.content) };
    }
}
const dayKeyOf = (ts) => ts.slice(0, 10);
/** 新→旧 的步骤流 → 天分组（新天在前，天内旧→新）。 */
export function groupByDay(steps, now) {
    const today = dayKeyOf(now.toISOString());
    const yesterday = dayKeyOf(new Date(now.getTime() - 86400000).toISOString());
    const groups = [];
    let current;
    for (const step of [...steps].reverse()) { // 旧→新
        const key = dayKeyOf(step.ts);
        if (current === undefined || dayKeyOf(current.steps[current.steps.length - 1].ts) !== key) {
            const label = key === today ? '今天' : key === yesterday ? '昨天'
                : `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日${key.slice(0, 4) !== String(now.getFullYear()) ? `（${key.slice(0, 4)}）` : ''}`;
            current = { label, steps: [] };
            groups.unshift(current); // 新天放最前
        }
        current.steps.push(narrateStep(step));
    }
    return groups;
}
/** 在场感一句话：TA 现在怎么样（第一人称）。 */
export function presenceLine(s, now = Date.now()) {
    if (s.stoppedByMaster)
        return '我在休息——是你让我停的，需要时叫我';
    if (!s.enabled)
        return '我在沉睡（总开关未开）';
    if (s.quiet?.active === true)
        return `我睡着了（${s.quiet.start}–${s.quiet.end}），醒来会继续`;
    if (s.running)
        return '我正在想事情……';
    if (s.spend !== undefined && s.spend.usedUsd >= s.spend.hardCapUsd)
        return '我今天想得够多了，在省着用（明天继续）';
    if ((s.pending ?? 0) > 0)
        return '我刚收到你的话，正在准备回应……';
    if (s.wakeAt > now) {
        const mins = Math.round((s.wakeAt - now) / 60000);
        return mins >= 1 ? `我在安静一会儿，约 ${mins} 分钟后自己醒` : '我马上就醒';
    }
    return '我在';
}
/** 时间感知问候（页面头部）。 */
export function greeting(now) {
    const h = now.getHours();
    if (h < 5)
        return '夜深了';
    if (h < 9)
        return '早上好';
    if (h < 12)
        return '上午好';
    if (h < 14)
        return '中午好';
    if (h < 18)
        return '下午好';
    if (h < 23)
        return '晚上好';
    return '夜深了';
}
