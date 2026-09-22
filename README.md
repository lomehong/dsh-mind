# dsh-mind — 分身心智运行时（P1 心智本体）

让数字分身拥有**持续心智**：按自身节奏持续思考/行动，外部消息只是时间线上的观察
之一。设计来源：`docs/mind-runtime-design.md` v0.3（套件仓），借鉴
[laude-institute/headlong](https://github.com/laude-institute/headlong) 的 persistent
agency 模型并按 DSH 套件治理架构本地化。

## 它做什么（P1）

- **自驱唤醒循环**：调度器按分级退避（5s×2→封顶 5 分钟，HOLD=3）唤醒分身；每次
  唤醒从函数菜单选恰好一件事（act/share/think/learn/recall/goals/idle）
- **心智时间线**：append-only jsonl 记录分身的一生（thought/action/wake/idle…），
  滚动归档、半行容错
- **唤醒 run**（方案 A）：经 typertGateway 在 digital-twin 预设会话上执行——分身
  完整工具面（记忆读写、task_delegate、web…）天然可用，治理随账本走
- **成本护栏**：两级 spend cap（80% 软顶降级 / 100% 硬顶停自发）、静音时段、
  **自驱地板**（`minSpontaneousIntervalMs`，默认 5 分钟——设计 G1「最低 5 分钟一醒」，
  反应性/事件触发不受限）、**机械空醒短路**（`idleShortCircuit`，默认开：无新观察、
  无待办且上一拍亦空转时不调用模型，直接记 idle 续排）、kill switch（fail-safe 语义见设计 §12.2）
- **心智主页（UI/UX v2，v0.3.0）**：存在体（The Being）为绝对主体——大尺寸呼吸光球
  （光晕中隐现人形剪影），状态全部翻译为身体语言：呼吸节奏（思考加速/入睡绵长）、
  光的色温与明暗、内部涌动、收到你的话时的涟漪；生活流（「TA 的一天」）与照护
  折叠为陪衬；留言闭环与工程视图保留
- **常驻存在体（右下角）**：TA 住在整个 dsh 窗口里（shell.overlay 全帧浮层，
  不拦截操作）——任何页面右下角都有 TA 在呼吸，点击就地展开面板：看见 TA、
  对 TA 说话、翻 TA 最近的生活、照看 TA
- **入口**：conversation.view「心智」Tab（当前宿主）+ main/sidebar.panellist
  （新宿主自动升级）+ 插件页人物卡

P1 无渠道依赖（渠道适配器是 P2）：兄弟插件全缺席时心智照常运行（宪章原则二）。

## 安装

```
dsh plugin --profile web add <本仓路径或 Release tgz>
```

重启 dsh 后生效。数据目录：`$DSH_HOME/dsh-mind/`（timeline.jsonl / run/state.json /
config.json）。

## 配置（config.json，可省略=全默认）

```json
{
  "enabled": true,
  "backoffBaseMs": 5000, "backoffFactor": 2, "backoffCapMs": 300000, "hold": 3,
  "quietHours": { "tz": "Asia/Shanghai", "start": "01:00", "end": "08:00", "enabled": true },
  "spendSoftCapUsd": 1, "spendHardCapUsd": 5,
  "priceUsdPerMTokIn": 0.27, "priceUsdPerMTokOut": 1.1,
  "reactiveMergeWindowMs": 60000, "reactiveHourlyMax": 20,
  "minSpontaneousIntervalMs": 300000, "idleShortCircuit": true,
  "presetId": "digital-twin"
}
```

kill switch：心智主页「照看 TA → 让 TA 休息」、工程视图「⏸ 暂停心智」，
或 `config.json` 的 `enabled: false`。
显式停止持久化（重启仍停）；配置文件损坏回落内置默认保守运行（§12.2 双状态）。

**成本事故记录（2026-09-22）**：旧实现 `delay(0)=0` + 5s 起跳，任何 engaged 唤醒
把阶梯归零 → 实测 15–45s 一拍（超设计上限 20 倍），且每拍跑完整 LLM turn
（~4.4K token/次）；同时 runner 读错用量字段名（`usage.input` 应为宿主契约的
`inputTokens`）致计量恒 0、两级 cap 形同虚设。v0.3.5 修正：自驱地板 5 分钟 +
机械空醒短路 + 计量字段对齐宿主 `TokenUsage` 契约。

## 心智主页 HTTP 面（sameOrigin 门禁，LESSONS #11）

| 路由 | 方法 | 门禁 | 用途 |
|---|---|---|---|
| `/dsh-mind/status` | GET | sameOrigin | 在场感状态（v3：静音时段/下次唤醒/待批数） |
| `/dsh-mind/timeline?n=` | GET | sameOrigin | 生活流数据源（≤200 步） |
| `/dsh-mind/say` | POST | + `x-mind-key` | 主人留言：message_in 落时间线 + 反应性唤醒 |
| `/dsh-mind/kill` | POST | + `x-mind-key` | 休息开关 |
| `/dsh-mind/token` | GET | sameOrigin | 下发写门禁键（进程启动随机生成） |

写门禁键为启动时随机值（先例 dsh-memory）：跨站表单/脚本无法携带自定义头，
跨源请求同时被 sameOrigin 闸拒绝。

## 单独可用性（宪章原则二）

兄弟插件全缺席时：心智照常思考并把结论写进时间线（时间线即记忆）；dsh-twin 缺席
用兜底人格+守卫；task-board 缺席时 act 收窄为只读动作。im-channel 适配器是 P2。

## 许可

MIT
