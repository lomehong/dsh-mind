/**
 * P2.1 pending 承诺账（纯函数层）：主人消息的「说了就要算数」跟踪。
 *
 * 语义：主人消息注入即入账；心智一次 act/share 完成即视为对该账目出手
 * （唤醒提示词的「待处理消息压倒菜单」规则保证 act 会优先消化它们），
 * 清掉该消息入账之前挂起的全部条目；久悬（默认 24h）的消息在下一次
 * 唤醒提示词里升级为「悬置提醒」，逼心智要么处理要么明说放下。
 */
export interface PendingEntry {
    seq: number;
    ts: string;
    text: string;
}
/** 入账（上限 20 条，丢最旧——账本防爆；纯函数返回新数组）。 */
export declare function pushPending(list: ReadonlyArray<PendingEntry>, entry: PendingEntry, cap?: number): PendingEntry[];
/** 清账：出手时间（唤醒开始）之前的挂起全部结清；唤醒期间新来的保留。 */
export declare function resolvePendingsBefore(list: ReadonlyArray<PendingEntry>, wakeStartTs: string): PendingEntry[];
/** 久悬条目（age > thresholdHours；纯函数）。 */
export declare function stalePendings(list: ReadonlyArray<PendingEntry>, nowMs: number, thresholdHours?: number, limit?: number): Array<{
    ageHours: number;
    text: string;
}>;
