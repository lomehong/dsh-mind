/**
 * P2 第六触发源：真实世界拉取（avatar-tools 会议）。
 * 管道与凭据由运行时注入（AVATAR_AGENT_TOKEN）；拉取失败/未配 token 一律静默
 * 返回 undefined——外部抖动绝不击穿心智（LESSONS 2）。30 分钟节流防限流。
 */

export interface AvatarMeeting {
  id?: string
  title?: string
  start?: string
  source?: string
}

export interface AvatarPull {
  meetings: AvatarMeeting[]
  fingerprint: string
}

/** 拉取会议列表（组合源）；任何失败静默。 */
export async function pullAvatarMeetings(token: string | undefined, timeoutMs = 20000): Promise<AvatarPull | undefined> {
  if (!token) return undefined
  try {
    const res = await fetch('https://twin.hzins.com/avatar/api/meeting?limit=10', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return undefined
    const j = (await res.json()) as { meetings?: Array<Record<string, unknown>> }
    const list = Array.isArray(j?.meetings) ? j.meetings : []
    const meetings: AvatarMeeting[] = list.map(m => ({
      ...(m.id !== undefined && m.id !== null ? { id: String(m.id) } : {}),
      ...(m.title !== undefined && m.title !== null ? { title: String(m.title) } : {}),
      ...(m.start !== undefined && m.start !== null ? { start: String(m.start) } : {}),
      ...(m.source !== undefined && m.source !== null ? { source: String(m.source) } : {}),
    }))
    const fingerprint = JSON.stringify(meetings.map(m => [m.id ?? '', m.title ?? '', m.start ?? '']))
    return { meetings, fingerprint }
  } catch {
    return undefined
  }
}

/** 今日（本地时区）会议过滤。 */
export function todaysMeetings(meetings: AvatarMeeting[], now: Date): AvatarMeeting[] {
  const d = now
  const pad = (n: number): string => String(n).padStart(2, '0')
  const todayPrefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return meetings.filter(m => (m.start ?? '').startsWith(todayPrefix))
}
