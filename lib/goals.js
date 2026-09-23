/**
 * goals 精化（P4）：目标的结构化约定与读侧提取。
 *
 * 约定（模型可写——经 learn/memory 工具，无新增工具面）：
 * - 活跃目标：内容以 `[目标]` 开头
 * - 结清：`[目标·完成]` / `[目标·放弃]` 开头的同题记录
 * - 提示词注入「当前目标」区；照护/工程面呈现活跃目标清单
 *
 * 精化规则（菜单 goals 行同步）：新目标必须带一句**完成判据**。
 */
/** 判断内容形态（纯函数）。 */
export function goalMarkerOf(content) {
    const t = content.trimStart();
    if (t.startsWith('[目标·完成]'))
        return 'done';
    if (t.startsWith('[目标·放弃]'))
        return 'dropped';
    if (t.startsWith('[目标]'))
        return 'active';
    return null;
}
/** 从记忆条目里提取目标（纯函数）。entries: {content, ts?, seq?}[]。 */
export function extractGoalEntries(entries) {
    const out = [];
    for (const e of entries) {
        if (goalMarkerOf(e.content) !== 'active')
            continue;
        const title = e.content.trimStart().slice(4).trim(); // 去掉 '[目标]'
        if (title === '')
            continue;
        out.push({ title: title.slice(0, 200), ts: e.ts ?? '', ...(e.seq !== undefined ? { seq: e.seq } : {}) });
    }
    return out;
}
/** 结清同题目标后的仍活跃清单（纯函数：done/dropped 晚于 active 同题 → 移除）。 */
export function settleGoals(active, entries) {
    const closedAt = new Map();
    for (const e of entries) {
        const m = goalMarkerOf(e.content);
        if (m === 'done' || m === 'dropped') {
            const title = e.content.trimStart().replace(/^\[目标·(完成|放弃)\]\s*/, '');
            const t = e.ts !== undefined ? Date.parse(e.ts) : NaN;
            closedAt.set(title, Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t);
        }
    }
    return active.filter(g => {
        const closed = closedAt.get(g.title);
        if (closed === undefined)
            return true;
        const mine = Date.parse(g.ts);
        // 结清记录晚于目标建立 → 已结清
        return Number.isNaN(mine) || closed <= mine;
    });
}
