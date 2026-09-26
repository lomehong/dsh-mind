/**
 * P5 请求账（asks，纯函数层）：心智→主人的「解锁请求」跟踪（设计 §6.5 方向二：不静默）。
 *
 * 语义：模型选 `ask`（§4.2）→ 入账 openAsk；入账即经渠道一次性投递（同文指纹去重，
 * 24h 内不重复轰炸）；久悬（默认 24h）→ 每 24h 节流重投递（stalePendings 久悬语义
 * 的镜像，方向相反）；结清：关联目标 [目标·完成]/[目标·放弃] 销账时联动自动结清。
 * 账本存 run/state.json（运行时状态，**不进 memory**——请求不是授权，§3.2 同纪律）。
 * 纯函数、无副作用、时钟由调用方注入——确定性可测（G8）。
 */
/** 账本防爆上限：超出丢最旧（pendings 同款）。 */
export const ASKS_CAP = 10;
/** 同文指纹：what 归一化（小写 + 去空白），重复开单不重不投。 */
function fingerprintOf(what) {
    return what.toLowerCase().replace(/\s+/g, '');
}
/** 入账（纯函数）。同文 open 请求已在案 → duplicated=true，账本不变（不重不投）。 */
export function openAsk(list, entry, cap = ASKS_CAP) {
    const fp = fingerprintOf(entry.what);
    if (fp !== '' && list.some(a => a.state === 'open' && fingerprintOf(a.what) === fp)) {
        return { list: [...list], duplicated: true };
    }
    const next = [...list, entry];
    return { list: next.length > cap ? next.slice(next.length - cap) : next, duplicated: false };
}
/** 显式结算：按 id 移除（时间线 wake 步骤即审计留痕，账本只存 open）。 */
export function settleAsk(list, id) {
    return list.filter(a => a.id !== id);
}
/** 关联目标销账联动：goalTitle ∈ settledTitles 的 open 请求自动结清（§6.5）。 */
export function settleAsksByGoal(list, settledTitles) {
    const titles = new Set(settledTitles.map(t => t.trim()).filter(t => t !== ''));
    if (titles.size === 0)
        return [...list];
    return list.filter(a => !(a.state === 'open' && a.goalTitle !== undefined && titles.has(a.goalTitle.trim())));
}
/** open 请求视图（运行时状态各处只消费 open；坏条目守卫在 state.ts 装载层）。 */
export function openAsksOf(list) {
    return list.filter(a => a !== null && typeof a === 'object' && a.state === 'open' && typeof a.what === 'string');
}
/** 久悬请求（age > thresholdHours；纯函数）。 */
export function staleAsks(list, nowMs, thresholdHours = 24) {
    return openAsksOf(list).filter(a => {
        const t = Date.parse(a.ts);
        return !Number.isNaN(t) && nowMs - t > thresholdHours * 3_600_000;
    });
}
/** 到期升级：久悬 且（从未升级 或 距上次升级 ≥ everyHours）→ 本拍需要重投递。
 *  「永不升级」视为协议违规（§6.5）；节流由 everyHours 保证防噪。 */
export function dueEscalations(list, nowMs, thresholdHours = 24, everyHours = 24) {
    return staleAsks(list, nowMs, thresholdHours).filter(a => {
        if (a.lastEscalatedAt === undefined)
            return true;
        return nowMs - a.lastEscalatedAt >= everyHours * 3_600_000;
    });
}
/** 从 FINAL 文本解析结构化请求（调用方已剥去 "[ask] " 前缀）。
 *  约定：`<要什么>｜为了：<为什么>｜给了之后：<下一步>｜目标：<目标标题>`；
 *  容错：全/半角分隔符皆可，缺节省略；what 为空视为不可入账（调用方跳过）。 */
export function parseAskPayload(text) {
    const parts = text.trim().split(/[｜|]/).map(s => s.trim()).filter(s => s !== '');
    const what = (parts[0] ?? '').slice(0, 200);
    let why;
    let howto;
    let goalTitle;
    for (const p of parts.slice(1)) {
        if (why === undefined && /^为了[:：]/.test(p))
            why = p.slice(3).trim() || undefined;
        else if (howto === undefined && /^给了之后[:：]/.test(p))
            howto = p.slice(5).trim() || undefined;
        else if (goalTitle === undefined && /^目标[:：]/.test(p))
            goalTitle = p.slice(3).trim().slice(0, 200) || undefined;
    }
    return {
        what,
        ...(why !== undefined ? { why: why } : {}),
        ...(howto !== undefined ? { howto: howto } : {}),
        ...(goalTitle !== undefined ? { goalTitle: goalTitle } : {}),
    };
}
/** 从 FINAL 文本解析显式结清标记（v0.10.1，§6.5 结清路径之三：TA 自查销账）。
 *  约定：FINAL 任意位置 `[ask/ok <id>]`，可多张（如 `[ask/ok a-1] [ask/ok a-2]`）。
 *  场景：请求单的前提已消失（身份卡已填好/所等凭据已另有来源）或已另行办结——
 *  防止「开单时为真、之后一直为假」的过时请求单悬置等主人（v0.10 实测事故）。 */
export function parseAskSettleIds(text) {
    const ids = [];
    for (const m of text.matchAll(/\[ask\/ok\s+([A-Za-z0-9_-]+)\s*\]/g)) {
        const id = m[1] ?? '';
        if (id !== '' && !ids.includes(id))
            ids.push(id);
    }
    return ids;
}
