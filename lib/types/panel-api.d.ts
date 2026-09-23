import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MindConfig } from './config.ts';
import type { SchedulerState } from './scheduler.ts';
export interface PanelDeps {
    getConfig(): MindConfig;
    getState(): SchedulerState;
    setStoppedByMaster(stopped: boolean): void;
    isRunning(): boolean;
    /** 反应队列当前长度（对 TA 说话后的「正在处理」呈现）。 */
    reactiveQueued(): number;
    /** 自治面待主人批准数（「TA 在等你点头」）。 */
    pendingApprovals(): number;
    /** 主人留言：message_in 落时间线 + 反应性唤醒。 */
    say(text: string): void;
    /** P4 goals 精化：当前活跃目标（读侧提取自 dsh-memory [目标] 标记条目）。 */
    activeGoals(): Array<{
        title: string;
        ts: string;
    }>;
}
export declare function registerPanelApi(web: {
    register(route: {
        kind: string;
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void;
    }): void;
}, deps: PanelDeps): void;
