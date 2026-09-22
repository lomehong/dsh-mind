/**
 * 插件页速览 HTTP 路由（设计 §3.3 五区块）。
 * LESSONS #11：插件自有 HTTP 路由不在上游认证围栏内——全部路由 sameOrigin 门禁
 * （带 Origin 且跨源 → 403；先例：dsh-memory v0.2.6 整改）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MindConfig } from './config.ts';
import type { SchedulerState } from './scheduler.ts';
export interface PanelDeps {
    getConfig(): MindConfig;
    getState(): SchedulerState;
    setStoppedByMaster(stopped: boolean): void;
    isRunning(): boolean;
}
export declare function registerPanelApi(web: {
    register(route: {
        kind: string;
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void;
    }): void;
}, deps: PanelDeps): void;
