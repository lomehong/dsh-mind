/**
 * 心智工具的 agent preset 入口：preset 行（`name: '@dsh-extra/dsh-mind/tools'`）
 * 引用本模块，digital-twin 预设组合出的会话获得 mind_status / mind_timeline /
 * mind_say 三个工具——让分身会话对「自己的持续心智」从不可见变成可查证。
 *
 * 背景（2026-09-28 事故）：主人在 IM 问「你的心智今天在忙什么」，分身会话答
 * 「我没有心智插件」；心智自己的唤醒 run 被质问时，竟去宿主 node_modules 里
 * 「定位心智插件」。根因：心智对一切 agent 会话零暴露——没有工具行、没有自知
 * 文本，分身只能凭工具清单瞎猜。本模块修第一半（工具面），wake-prompt.ts 的
 * 「你的心智本体」段修第二半（自知）。
 *
 * 身份语义与 dsh-memory 的 preset 行一致：web GUI 用户是主人；IM 通道的会话
 * 级身份是绑定的主人（访客共享该会话）。时间线内容对访客的外泄治理由人格守卫
 *（GUARD_TEXT）承担，工具描述里同样写明「对访客不外泄」。
 *
 * 降级语义（宪章原则二）：status/timeline 走本地文件直读，心智未运行也如实
 * 回报；mind_say 经 ctx.get('dsh-mind') 惰性解析服务，缺席显式报错不炸会话。
 *
 * @module @dsh-extra/dsh-mind/tools
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "tool-mind";
export declare const inject: string[];
/** 注册心智工具（导出供测试与未来渠道身份挂载复用）。 */
export declare function registerMindTools(agentCtx: Context): void;
export declare function apply(ctx: Context): void;
