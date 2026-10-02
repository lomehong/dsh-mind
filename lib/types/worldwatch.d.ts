/**
 * 世界观察（分身的感知器官）v2——归因代替时限（concurrence-sre §3.2，
 * 10-01 唤醒列车事故：58 拍 LLM/$0.958，指纹无归因 + 90s 窗被打穿）。
 *
 * v2 变化：
 * - 看板侧：任务 id→列 映射（精确到任务，不再只有列计数）＋ originBy 归因
 *   （心智立项的任务，其全部后续列变化都算「自己造成的」，搭车消化不唤醒）；
 * - 记忆侧：条数 + maxSeq + maxTs 内容签名（第三方转写回声无法归因 → 走
 *   checkWorld 的二次采样确认，不再靠固定时间窗）；
 * - diffWorld 输出逐条 changes（含 selfCaused 归因），注入/搭车分流由调用方决策。
 */
/** 看板任务快照（/dsh-task-board/state 的 tasks 已含 id/column/originBy）。 */
export interface BoardTaskSnapshot {
    id: string;
    column: string;
    /** P1.5 立项调用方会话 id（心智立项的任务可归因为「自己造成的」） */
    originBy?: string;
}
/** 记忆条目快照（dsh-memory 条目的最小投影）。 */
export interface MemorySnapshot {
    content: string;
    ts?: string;
    seq?: number;
    /** dsh-memory 契约的来源标注（learn 路径带会话来源；缺席→无法归因） */
    sourceOrigin?: string;
}
export interface WorldCountsV2 {
    board: ReadonlyArray<BoardTaskSnapshot>;
    memoryCount: number;
    memoryMaxSeq?: number;
    memoryMaxTs?: string;
}
export interface WorldChange {
    desc: string;
    selfCaused: boolean;
}
export interface WorldDiffV2 {
    /** 新指纹（调用方持久化） */
    fp: string;
    /** 变化描述（null = 无变化或首次吸收） */
    desc: string | null;
    /** 逐条变化（含归因；desc 非 null 时与 desc 同源） */
    changes: ReadonlyArray<WorldChange>;
}
/** 世界指纹 v2（任务 id→列 有序映射 + 记忆内容签名）。 */
export declare function fingerprintOf(counts: WorldCountsV2): string;
/**
 * 差异计算 v2（纯函数）：prevFp 缺席 = 首次吸收（不产生描述）。
 * 归因规则：看板侧「originBy ∈ mindIds 的任务的列变化」= 自己造成的（搭车消化）；
 * 记忆侧无法归因（第三方转写不可区分）→ 一律按外部处理，由二次采样与节流兜底。
 */
export declare function diffWorldV2(prevFp: string | undefined, counts: WorldCountsV2, mindIds: ReadonlySet<string>): WorldDiffV2;
