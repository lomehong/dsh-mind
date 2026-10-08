/**
 * P2 第六触发源：真实世界拉取（avatar-tools 会议）。
 * 管道与凭据由运行时注入（AVATAR_AGENT_TOKEN）；拉取失败/未配 token 一律静默
 * 返回 undefined——外部抖动绝不击穿心智（LESSONS 2）。30 分钟节流防限流。
 */
export interface AvatarMeeting {
    id?: string;
    title?: string;
    start?: string;
    source?: string;
}
export interface AvatarPull {
    meetings: AvatarMeeting[];
    fingerprint: string;
}
export interface AvatarPullOk {
    ok: true;
    meetings: AvatarMeeting[];
    fingerprint: string;
}
export interface AvatarPullFail {
    ok: false;
    reason: string;
}
/** 拉取会议列表（组合源）；失败原因精确透出（401=token 无效/过期，需御符重签）。 */
export declare function pullAvatarMeetings(token: string | undefined, timeoutMs?: number): Promise<AvatarPullOk | AvatarPullFail>;
/** 今日（本地时区）会议过滤。 */
export declare function todaysMeetings(meetings: AvatarMeeting[], now: Date): AvatarMeeting[];
