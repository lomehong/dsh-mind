import type { SchedulerState } from './scheduler.ts';
export declare const STATE_DEFAULT: SchedulerState;
export declare function statePath(): string;
export declare function loadState(): SchedulerState;
export declare function saveState(state: SchedulerState): void;
export declare function mutateState<T>(fn: (state: SchedulerState) => T): Promise<T>;
/** 唤醒入口的 seq 对账（R3 防重号）：timeline 追加与 state.lastSeq 是两个文件，
 *  崩溃残留可能让 timeline seq 领先 lastSeq——唤醒前取 max，杜绝 seq 复用。 */
export declare function reconcileSeqWithTail(state: SchedulerState, tailSeqs: ReadonlyArray<number>): void;
