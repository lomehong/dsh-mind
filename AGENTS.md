# dsh-mind（@dsh-extra/dsh-mind）

分身心智运行时：时间线（append-only jsonl）+ 唤醒调度器（分级退避）+ 函数菜单
唤醒 run——让分身拥有持续心智（设计稿：套件仓 `docs/mind-runtime-design.md` v0.3，
五角色评审后版本）。

## src/ 结构
- index.ts — 插件入口：tick 调度（1s）、唤醒编排（方案 A 底座：typertGateway +
  digital-twin 预设会话）、provide 'dsh-mind' 服务（injectObservation/wakeNow/setStopped）、
  启动弃单恢复、kill switch fail-safe
- config.ts — 配置（fail-safe 回落默认；kill switch 配置面与显式停止分离，§12.2）
- scheduler.ts — 调度纯函数：退避阶梯/触发收集/两级 spend cap/静音时段（时钟注入可测）
- state.ts — run/state.json 原子读写（退避档位/wake_at/spend 台账/stoppedByMaster）
- timeline.ts — 时间线 jsonl（append-only、半行容错、滚动归档；schema v2）
- wake-prompt.ts — 唤醒提示词装配（函数菜单/守卫兜底/人格/时间线上下文/中文写作规范）
- gateway.ts — typertGateway 封装（契约照搬 dsh-task-board）
- runner.ts — 唤醒执行器（会话懒建复用/超阈值重建、follow→cursor→page 轮询 turn/end、
  FINAL 与用量抽取）
- panel-api.ts — 插件页速览 HTTP 路由（sameOrigin 门禁，LESSONS #11）
- client/index.tsx — plugins.bundle.config 五区块速览（成本行/状态/kill switch/时间线）
- tests/ — vitest（scheduler/timeline/config/wake-prompt；时钟与 DSH_HOME 注入隔离）

## 红线
- 改动前先读套件宪章（`E:\code\nodejs\dsh\docs\suite-charter.md`）与设计稿 v0.3
- dsh-mind 内部任何异常不得击穿宿主（LESSONS 2）；kill switch 显式停必须持久
- 时间线对访客不可见（硬规则）；心智 memory 写入禁「授权」陈述类型（防自铸授权）

## 构建与测试
- npm install
- npm run build / npm run build:client / npm test / npm run typecheck
