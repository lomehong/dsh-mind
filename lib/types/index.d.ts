/**
 * dsh-mind — 分身心智运行时（P1 心智本体）。
 *
 * 设计：docs/mind-runtime-design.md v0.3（§4 唤醒循环 / §5 节奏与成本 /
 * §11 调度器规格 / §12 生命周期与常驻保证）。
 *
 * 宿主常驻语义：本插件 = 宿主进程内的代码，调度器是宿主 timer 上的 tick；
 * 状态全落盘（timeline / run/state.json），重启恢复、错过 due 只补一次、
 * 任何接缝异常绝不击穿宿主（LESSONS 2）。
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-mind";
export declare const provide: string[];
export declare function apply(ctx: Context): void;
