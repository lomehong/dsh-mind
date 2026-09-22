import type { SchedulerState } from './scheduler.ts';
export declare const STATE_DEFAULT: SchedulerState;
export declare function statePath(): string;
export declare function loadState(): SchedulerState;
export declare function saveState(state: SchedulerState): void;
