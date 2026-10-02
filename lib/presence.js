/** 纯函数分类（G8 可测）：running 且非自身的会话 → 三类；master-facing 保守伞。 */
export function classifyPresence(items, runningTaskIds, selfIds) {
    const peers = [];
    for (const s of items) {
        const id = typeof s.sessionId === 'string' ? s.sessionId : '';
        if (id === '' || selfIds.has(id))
            continue;
        if (s.running !== true)
            continue;
        let kind = 'master-facing';
        if (runningTaskIds.has(id))
            kind = 'task-execution';
        else if (s.origin === 'subagent')
            kind = 'background';
        peers.push({ sessionId: id, kind });
    }
    const strongest = peers.some(p => p.kind === 'master-facing')
        ? 'master-facing'
        : peers.length > 0 ? 'background' : 'none';
    return { strongest, peers };
}
/**
 * 在场探测：session/list + 看板 runningTasks（可选注入）→ 快照。
 * list 失败 → source='unavailable'（调用方按 fail-open 处理：沿用上次快照或视为 none）。
 */
export async function probePresence(gw, opts) {
    const at = Date.now();
    try {
        const list = (await gw.invoke('session', 'list', {}));
        const runningTaskIds = opts.runningTaskIds ?? new Set();
        const { strongest, peers } = classifyPresence(list.items ?? [], runningTaskIds, opts.selfIds);
        return { at, strongest, masterFacingCount: peers.filter(p => p.kind === 'master-facing').length, peers, source: 'session-list' };
    }
    catch {
        return { at, strongest: 'none', masterFacingCount: 0, peers: [], source: 'unavailable' };
    }
}
