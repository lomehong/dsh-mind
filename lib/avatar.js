/**
 * P2 第六触发源：真实世界拉取（avatar-tools 会议）。
 * 管道与凭据由运行时注入（AVATAR_AGENT_TOKEN）；拉取失败/未配 token 一律静默
 * 返回 undefined——外部抖动绝不击穿心智（LESSONS 2）。30 分钟节流防限流。
 */
/** 拉取会议列表（组合源）；失败原因精确透出（401=token 无效/过期，需御符重签）。 */
export async function pullAvatarMeetings(token, timeoutMs = 20000) {
    if (!token)
        return { ok: false, reason: 'AVATAR_AGENT_TOKEN 未注入运行时环境' };
    try {
        const res = await fetch('https://twin.hzins.com/avatar/api/meeting?limit=10', {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 401)
            return { ok: false, reason: 'HTTP 401——token 无效或已过期，需御符（ai-huntian.hzins.com）重新签发并更新环境变量' };
        if (!res.ok)
            return { ok: false, reason: `HTTP ${res.status}` };
        const j = (await res.json());
        const list = Array.isArray(j?.meetings) ? j.meetings : [];
        const meetings = list.map(m => ({
            ...(m.id !== undefined && m.id !== null ? { id: String(m.id) } : {}),
            ...(m.title !== undefined && m.title !== null ? { title: String(m.title) } : {}),
            ...(m.start !== undefined && m.start !== null ? { start: String(m.start) } : {}),
            ...(m.source !== undefined && m.source !== null ? { source: String(m.source) } : {}),
        }));
        const fingerprint = JSON.stringify(meetings.map(m => [m.id ?? '', m.title ?? '', m.start ?? '']));
        return { ok: true, meetings, fingerprint };
    }
    catch (e) {
        return { ok: false, reason: `fetch 异常: ${e instanceof Error ? e.message : String(e)}` };
    }
}
/** 今日（本地时区）会议过滤。 */
export function todaysMeetings(meetings, now) {
    const d = now;
    const pad = (n) => String(n).padStart(2, '0');
    const todayPrefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return meetings.filter(m => (m.start ?? '').startsWith(todayPrefix));
}
