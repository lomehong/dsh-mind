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
  kill switch（fail-safe 语义见设计 §12.2）
- **插件页速览**：成本行/状态/kill switch/时间线最近步骤

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
  "presetId": "digital-twin"
}
```

kill switch：插件页「⏸ 暂停心智」按钮，或 `config.json` 的 `enabled: false`。
显式停止持久化（重启仍停）；配置文件损坏回落内置默认保守运行（§12.2 双状态）。

## 单独可用性（宪章原则二）

兄弟插件全缺席时：心智照常思考并把结论写进时间线（时间线即记忆）；dsh-twin 缺席
用兜底人格+守卫；task-board 缺席时 act 收窄为只读动作。im-channel 适配器是 P2。

## 许可

MIT
