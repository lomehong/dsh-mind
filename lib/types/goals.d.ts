/**
 * goals 精化（P4）：目标的结构化约定与读侧提取。
 *
 * 约定（模型可写——经 learn/memory 工具，无新增工具面）：
 * - 活跃目标：内容以 `[目标]` 开头
 * - 结清：`[目标·完成]` / `[目标·放弃]` 开头的同题记录
 * - 提示词注入「当前目标」区；照护/工程面呈现活跃目标清单
 *
 * 精化规则（菜单 goals 行同步）：新目标必须带一句**完成判据**。
 */
export interface GoalEntry {
    /** 目标标题（[目标] 后的一句话） */
    title: string;
    /** 记录时间（ISO） */
    ts: string;
    /** 源记忆条目 seq（如可用；便于回溯） */
    seq?: number;
}
/** 判断内容形态（纯函数）。 */
export declare function goalMarkerOf(content: string): 'active' | 'done' | 'dropped' | null;
/** 从记忆条目里提取目标（纯函数）。entries: {content, ts?, seq?}[]。 */
export declare function extractGoalEntries(entries: ReadonlyArray<{
    content: string;
    ts?: string;
    seq?: number;
}>): GoalEntry[];
/** 结清同题目标后的仍活跃清单（纯函数：done/dropped 晚于 active 同题 → 移除）。 */
export declare function settleGoals(active: ReadonlyArray<GoalEntry>, entries: ReadonlyArray<{
    content: string;
    ts?: string;
}>): GoalEntry[];
