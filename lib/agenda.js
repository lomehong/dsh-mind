/**
 * P2 跟进议程 + 意图模型（主人 2026-10-04 定稿的四层机制核心）：
 *
 *   观察层（情境流采集，已有）→ 推理层（低频深度分析：推导议程/更新意图模型）
 *   → 执行层（每 5 分钟触点检测 vs 已确认议程 → 命中才深度跟进）
 *   → 校准层（主人）：推导项必须确认才执行；否决降权；意图模型可审查纠正。
 *
 * 设计铁律（来自与主人的对谈，2026-10-04）：
 * - 议程大部分由分身从情境流推导（带证据链），部分来自主人指示；
 * - 「不痛不痒」的解药 = 每条推导必须引用具体证据（消息/任务/时间）；
 * - 未经确认的推导项只停留 proposed，绝不执行（防「没事找事」复发）；
 * - 意图模型自举于观察，主人可随时纠正，纠正留痕（revision 递增）。
 */
export const AGENDA_SCHEMA_VERSION = 1;
export function emptyAgendaState(now = new Date().toISOString()) {
    return {
        schemaVersion: AGENDA_SCHEMA_VERSION,
        items: [],
        intent: {
            role: '',
            workPatterns: [],
            longTermConcerns: [],
            contactPreferences: [],
            revisions: 0,
            updatedAt: now,
        },
    };
}
/** 议程项 id：时间可排序 + 随机后缀防碰撞。 */
export function newAgendaId(now = Date.now()) {
    return `AG-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
/**
 * 合并推理层产出：按 id 更新已存在项；新 id 且带 ≥1 证据（或 source=master）→ 插入为 proposed。
 * 主人指示项（evidence 为空但 source=master 标记）视为高置信。
 * 已 done/rejected 的项不被同名新推导复活（防翻旧账）。
 */
/** 议程项语义相似判定（去重用）：归一化后前缀重叠 ≥12 字符视为同项。 */
export function agendaWhatSimilar(a, b) {
    const norm = (s) => s.replace(/[\s（）()「」『』【】、，。：:；;'"·—\-_/\\]/g, '');
    const na = norm(a);
    const nb = norm(b);
    if (na === '' || nb === '')
        return false;
    const short = na.length <= nb.length ? na : nb;
    const long = na.length <= nb.length ? nb : na;
    return long.startsWith(short.slice(0, Math.min(12, short.length)));
}
/**
 * 合并推理层产出：按 id 更新已存在项；语义重复（agendaWhatSimilar，多轮分析堆
 * 语义重复的实测缺陷 2026-10-05）→ 更新既有项而非新增；新 id 且带 ≥1 证据
 * （或主人指示）→ 插入为 proposed。已 done/rejected 不被复活（防翻旧账）。
 */
export function mergeAgendaProposals(state, proposals, now = new Date().toISOString()) {
    const items = [...state.items];
    const added = [];
    const updated = [];
    let rejectedProposals = 0;
    for (const p of proposals) {
        const what = (p.what ?? '').trim();
        if (what === '') {
            rejectedProposals += 1;
            continue;
        }
        let existing = items.find(i => i.id === p.id);
        if (existing === undefined) {
            existing = items.find(i => (i.status === 'proposed' || i.status === 'confirmed' || i.status === 'tracking') && agendaWhatSimilar(i.what, what));
        }
        if (existing !== undefined) {
            if (existing.status === 'done' || existing.status === 'rejected') {
                rejectedProposals += 1;
                continue;
            }
            const next = {
                ...existing,
                what: what || existing.what,
                evidence: p.evidence ?? existing.evidence,
                touchpoint: p.touchpoint ?? existing.touchpoint,
                expectedResult: p.expectedResult ?? existing.expectedResult,
                updatedAt: now,
            };
            const idx = items.findIndex(i => i.id === existing.id);
            items[idx] = next;
            updated.push(next);
            continue;
        }
        const evidence = p.evidence ?? [];
        const masterDirect = evidence.length === 0 && p.confidence === 'high';
        if (evidence.length === 0 && !masterDirect) {
            rejectedProposals += 1;
            continue;
        }
        const item = {
            id: p.id ?? newAgendaId(),
            what,
            evidence,
            touchpoint: p.touchpoint ?? { keywords: what.split(/\s+/).filter(w => w.length >= 2).slice(0, 3) },
            expectedResult: p.expectedResult ?? '',
            confidence: p.confidence ?? (evidence.length > 0 ? 'low' : 'high'),
            status: 'proposed',
            createdAt: now,
            updatedAt: now,
        };
        items.push(item);
        added.push(item);
    }
    return { state: { ...state, items }, added, updated, rejectedProposals };
}
/** 主人确认：proposed → confirmed（此后触点命中才允许深度跟进）。 */
export function confirmAgendaItem(state, id, now = new Date().toISOString()) {
    const item = state.items.find(i => i.id === id);
    if (item === undefined || item.status !== 'proposed')
        return false;
    item.status = 'confirmed';
    item.updatedAt = now;
    return true;
}
/** 主人否决：→ rejected + 记原因（供意图模型降权学习）。 */
export function rejectAgendaItem(state, id, note, now = new Date().toISOString()) {
    const item = state.items.find(i => i.id === id);
    if (item === undefined || item.status !== 'proposed')
        return false;
    item.status = 'rejected';
    item.rejectionNote = note;
    item.updatedAt = now;
    return true;
}
/** 跟进完成销账。 */
export function completeAgendaItem(state, id, now = new Date().toISOString()) {
    const item = state.items.find(i => i.id === id);
    if (item === undefined || (item.status !== 'confirmed' && item.status !== 'tracking'))
        return false;
    item.status = 'done';
    item.updatedAt = now;
    return true;
}
export function matchTouchpoints(state, events) {
    const hits = [];
    const active = state.items.filter(i => i.status === 'confirmed' || i.status === 'tracking');
    for (const item of active) {
        for (const event of events) {
            const sourceOk = item.touchpoint.sources === undefined || item.touchpoint.sources.length === 0 || item.touchpoint.sources.includes(event.source);
            if (!sourceOk)
                continue;
            const kw = item.touchpoint.keywords.filter(k => k.length >= 2);
            if (kw.length === 0)
                continue;
            if (kw.some(k => event.text.includes(k))) {
                hits.push({ item, event });
                break;
            }
        }
    }
    return hits;
}
/** 待主人确认的批量清单（校准层：攒批一次问，防碎片打扰）。 */
export function pendingProposals(state) {
    return state.items.filter(i => i.status === 'proposed');
}
/** 意图模型纠正（主人）：整段覆盖 + revisions+1。 */
export function correctIntentModel(state, patch, now = new Date().toISOString()) {
    return {
        ...state,
        intent: {
            ...state.intent,
            ...patch,
            revisions: state.intent.revisions + 1,
            updatedAt: now,
        },
    };
}
/** 推理层自举：从观察更新意图模型（不动 revisions——主人纠正才计数）。 */
export function learnIntentModel(state, patch, now = new Date().toISOString()) {
    const mergeUnique = (base, add) => add === undefined ? base : Array.from(new Set([...base, ...add.filter(x => typeof x === 'string' && x.trim() !== '')]));
    return {
        ...state,
        intent: {
            role: patch.role?.trim() ? patch.role : state.intent.role,
            workPatterns: mergeUnique(state.intent.workPatterns, patch.workPatterns),
            longTermConcerns: mergeUnique(state.intent.longTermConcerns, patch.longTermConcerns),
            contactPreferences: mergeUnique(state.intent.contactPreferences, patch.contactPreferences),
            revisions: state.intent.revisions,
            updatedAt: now,
        },
    };
}
/** 从 FINAL 文本提取 ```agenda 代码块并解析；缺席/坏 JSON → undefined（本拍无产出）。 */
export function parseAgendaAnalysisBlock(final) {
    const match = /```agenda\s*\n([\s\S]*?)```/.exec(final);
    if (match === null)
        return undefined;
    try {
        const parsed = JSON.parse(match[1]);
        if (parsed === null || typeof parsed !== 'object')
            return undefined;
        return parsed;
    }
    catch {
        return undefined;
    }
}
