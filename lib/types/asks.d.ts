/**
 * P5 请求账（asks，纯函数层）：心智→主人的「解锁请求」跟踪（设计 §6.5 方向二：不静默）。
 *
 * 语义：模型选 `ask`（§4.2）→ 入账 openAsk；入账即经渠道一次性投递（同文指纹去重，
 * 24h 内不重复轰炸）；久悬（默认 24h）→ 每 24h 节流重投递（stalePendings 久悬语义
 * 的镜像，方向相反）；结清：关联目标 [目标·完成]/[目标·放弃] 销账时联动自动结清。
 * 账本存 run/state.json（运行时状态，**不进 memory**——请求不是授权，§3.2 同纪律）。
 * 纯函数、无副作用、时钟由调用方注入——确定性可测（G8）。
 */
export interface AskEntry {
    /** 稳定 id（升级/结算键）：a-<epoch>-<rand> */
    id: string;
    /** 发起唤醒的时间线 seq（回放定位，G5） */
    seq: number;
    /** 发起时间（ISO） */
    ts: string;
    /** 要什么（主文；投递正文与同文去重的指纹） */
    what: string;
    /** 为什么（可选） */
    why?: string;
    /** 给了之后我做什么（可选；注入提示词帮模型接续） */
    howto?: string;
    /** 关联目标标题（可选；目标销账时联动结清） */
    goalTitle?: string;
    /** open | satisfied（结算即移除；satisfied 仅为类型完备，不落盘） */
    state: 'open' | 'satisfied';
    /** 最近一次投递时刻（epoch ms；入账即投递） */
    notifiedAt: number;
    /** 最近一次升级重投递时刻（epoch ms；可选） */
    lastEscalatedAt?: number;
}
/** 账本防爆上限：超出丢最旧（pendings 同款）。 */
export declare const ASKS_CAP = 10;
/** 入账（纯函数）。同文 open 请求已在案 → duplicated=true，账本不变（不重不投）。 */
export declare function openAsk(list: ReadonlyArray<AskEntry>, entry: AskEntry, cap?: number): {
    list: AskEntry[];
    duplicated: boolean;
};
/** 显式结算：按 id 移除（时间线 wake 步骤即审计留痕，账本只存 open）。 */
export declare function settleAsk(list: ReadonlyArray<AskEntry>, id: string): AskEntry[];
/** 关联目标销账联动：goalTitle ∈ settledTitles 的 open 请求自动结清（§6.5）。 */
export declare function settleAsksByGoal(list: ReadonlyArray<AskEntry>, settledTitles: ReadonlyArray<string>): AskEntry[];
/** open 请求视图（运行时状态各处只消费 open；坏条目守卫在 state.ts 装载层）。 */
export declare function openAsksOf(list: ReadonlyArray<AskEntry>): AskEntry[];
/** 久悬请求（age > thresholdHours；纯函数）。 */
export declare function staleAsks(list: ReadonlyArray<AskEntry>, nowMs: number, thresholdHours?: number): AskEntry[];
/** 到期升级：久悬 且（从未升级 或 距上次升级 ≥ everyHours）→ 本拍需要重投递。
 *  「永不升级」视为协议违规（§6.5）；节流由 everyHours 保证防噪。 */
export declare function dueEscalations(list: ReadonlyArray<AskEntry>, nowMs: number, thresholdHours?: number, everyHours?: number): AskEntry[];
/** 从 FINAL 文本解析结构化请求（调用方已剥去 "[ask] " 前缀）。
 *  约定：`<要什么>｜为了：<为什么>｜给了之后：<下一步>｜目标：<目标标题>`；
 *  容错：全/半角分隔符皆可，缺节省略；what 为空视为不可入账（调用方跳过）。 */
export declare function parseAskPayload(text: string): {
    what: string;
    why?: string;
    howto?: string;
    goalTitle?: string;
};
