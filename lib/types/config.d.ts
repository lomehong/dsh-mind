export interface QuietHours {
    tz: string;
    start: string;
    end: string;
    enabled: boolean;
}
export interface MindConfig {
    /** 总开关（kill switch 的配置面；显式停止另存 state.stoppedByMaster） */
    enabled: boolean;
    backoffBaseMs: number;
    backoffFactor: number;
    backoffCapMs: number;
    hold: number;
    quietHours: QuietHours;
    /** 两级 spend cap（USD/日） */
    spendSoftCapUsd: number;
    spendHardCapUsd: number;
    /** 成本核算单价（USD / 每百万 token） */
    priceUsdPerMTokIn: number;
    priceUsdPerMTokOut: number;
    reactiveMergeWindowMs: number;
    reactiveHourlyMax: number;
    /** 自驱唤醒最低间隔（ms）——设计 G1「最低 5 分钟一醒」的硬地板。
     *  2026-09-22 成本事故修正：旧实现 delay(0)=0 + 5s 起跳，engaged 归零后
     *  实测 15–45s 一拍（超设计上限 20 倍），且每拍跑完整 LLM turn。 */
    minSpontaneousIntervalMs: number;
    /** 机械空醒短路：无新观察/无待办且上一拍亦空转时，不调用模型直接续排。 */
    idleShortCircuit: boolean;
    /** 唤醒 run 硬超时（续命归调度器） */
    wakeTimeoutMs: number;
    /** 时间线保留天数（滚动归档） */
    timelineRetentionDays: number;
    /** 方案 A 底座：唤醒 run 复用的分身预设 */
    presetId: string;
    /** 输入 token 超过此值即重建（弃旧）心智会话 */
    sessionResetTokens: number;
    /** 世界观察：任务看板基址（分身的感知器官——看板/记忆变化注入观察触发唤醒） */
    worldWatchUrl: string;
    /** 世界观察开关 */
    worldWatchEnabled: boolean;
}
export declare const CONFIG_DEFAULTS: MindConfig;
/** 配置合并（纯函数，测试用）：非法键回落默认并夹紧边界。 */
export declare function mergeMindConfig(raw: unknown): MindConfig;
export declare function mindHome(): string;
export declare function mindConfigPath(): string;
/** 读取配置（30s TTL 缓存；缺文件/解析失败 → 全默认，绝不抛）。 */
export declare function loadMindConfig(now?: number): MindConfig;
/** 供测试重置缓存。 */
export declare function resetConfigCache(): void;
