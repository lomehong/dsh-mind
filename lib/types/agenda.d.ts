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
/** 议程项状态机：proposed（待主人确认）→ confirmed（跟踪中）→ done / rejected。 */
export type AgendaStatus = 'proposed' | 'confirmed' | 'tracking' | 'done' | 'rejected';
/** 一条证据：对情境流中具体条目的引用（拒绝无依据推导）。 */
export interface AgendaEvidence {
    /** 证据来源：message_in / task / timeline / memory / meeting / file … */
    source: string;
    /** 源内标识（消息 id / 任务 id / 时间线 seq / 文件路径）。 */
    ref: string;
    /** 一句话说明这条证据说明了什么。 */
    note: string;
}
/** 一条跟进议程项。 */
export interface AgendaItem {
    id: string;
    /** 什么事（一句话，具体不空泛）。 */
    what: string;
    /** 为什么值得跟进：证据链（≥1 条；proposed 必须有，主人指示的可为空）。 */
    evidence: AgendaEvidence[];
    /** 触点定义：什么新信号算「有新进展」——匹配用关键词/来源过滤。 */
    touchpoint: {
        keywords: string[];
        sources?: string[];
    };
    /** 跟进到什么结果算完成（主人强调：跟进必须有结果标准）。 */
    expectedResult: string;
    confidence: 'high' | 'low';
    status: AgendaStatus;
    /** 推导时间与最近更新时间（ISO）。 */
    createdAt: string;
    updatedAt: string;
    /** 主人否决原因（rejected 时记录，用于降权学习）。 */
    rejectionNote?: string;
}
/** 意图模型：分身对主人的理解（自举 + 主人可纠正 + 留痕）。 */
export interface IntentModel {
    /** 主人角色一句话。 */
    role: string;
    /** 工作特征（多源事务/常离工位/决策需带上下文…）。 */
    workPatterns: string[];
    /** 长期关注（安全情报/团队推进/会议落地…）。 */
    longTermConcerns: string[];
    /** 沟通与打扰偏好。 */
    contactPreferences: string[];
    /** 修正历史条数（每次主人纠正 +1，只增不减——学习痕迹）。 */
    revisions: number;
    updatedAt: string;
}
/** 议程 + 意图模型的持久化根。 */
export interface AgendaState {
    schemaVersion: 1;
    items: AgendaItem[];
    intent: IntentModel;
}
export declare const AGENDA_SCHEMA_VERSION = 1;
export declare function emptyAgendaState(now?: string): AgendaState;
/** 议程项 id：时间可排序 + 随机后缀防碰撞。 */
export declare function newAgendaId(now?: number): string;
/**
 * 合并推理层产出：按 id 更新已存在项；新 id 且带 ≥1 证据（或 source=master）→ 插入为 proposed。
 * 主人指示项（evidence 为空但 source=master 标记）视为高置信。
 * 已 done/rejected 的项不被同名新推导复活（防翻旧账）。
 */
/** 议程项语义相似判定（去重用）：归一化后前缀重叠 ≥12 字符视为同项。 */
export declare function agendaWhatSimilar(a: string, b: string): boolean;
/**
 * 合并推理层产出：按 id 更新已存在项；语义重复（agendaWhatSimilar，多轮分析堆
 * 语义重复的实测缺陷 2026-10-05）→ 更新既有项而非新增；新 id 且带 ≥1 证据
 * （或主人指示）→ 插入为 proposed。已 done/rejected 不被复活（防翻旧账）。
 */
export declare function mergeAgendaProposals(state: AgendaState, proposals: Array<Partial<AgendaItem> & {
    what: string;
}>, now?: string): {
    state: AgendaState;
    added: AgendaItem[];
    updated: AgendaItem[];
    rejectedProposals: number;
};
/** 主人确认：proposed → confirmed（此后触点命中才允许深度跟进）。 */
export declare function confirmAgendaItem(state: AgendaState, id: string, now?: string): boolean;
/** 主人否决：→ rejected + 记原因（供意图模型降权学习）。 */
export declare function rejectAgendaItem(state: AgendaState, id: string, note: string, now?: string): boolean;
/** 跟进完成销账。 */
export declare function completeAgendaItem(state: AgendaState, id: string, now?: string): boolean;
/** 触点命中判定（执行层每 5 分钟的廉价检测）：新事件文本/来源 命中任一已确认项的触点定义。 */
export interface TouchpointEvent {
    source: string;
    text: string;
}
export declare function matchTouchpoints(state: AgendaState, events: TouchpointEvent[]): Array<{
    item: AgendaItem;
    event: TouchpointEvent;
}>;
/** 待主人确认的批量清单（校准层：攒批一次问，防碎片打扰）。 */
export declare function pendingProposals(state: AgendaState): AgendaItem[];
/** 意图模型纠正（主人）：整段覆盖 + revisions+1。 */
export declare function correctIntentModel(state: AgendaState, patch: Partial<Omit<IntentModel, 'revisions' | 'updatedAt'>>, now?: string): AgendaState;
/** 推理层自举：从观察更新意图模型（不动 revisions——主人纠正才计数）。 */
export declare function learnIntentModel(state: AgendaState, patch: Partial<Omit<IntentModel, 'revisions' | 'updatedAt'>>, now?: string): AgendaState;
/** 推理层结构化产出（FINAL 中的 ```agenda 代码块）。 */
export interface AgendaAnalysisOutput {
    intent?: {
        role?: string;
        workPatterns?: string[];
        longTermConcerns?: string[];
        contactPreferences?: string[];
    };
    proposals?: Array<{
        what?: string;
        evidence?: AgendaEvidence[];
        touchpoint?: {
            keywords?: string[];
            sources?: string[];
        };
        expectedResult?: string;
        confidence?: string;
    }>;
}
/** 从 FINAL 文本提取 ```agenda 代码块并解析；缺席/坏 JSON → undefined（本拍无产出）。 */
export declare function parseAgendaAnalysisBlock(final: string): AgendaAnalysisOutput | undefined;
