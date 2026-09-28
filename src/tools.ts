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
import type { Context } from '@deepseek-ai/cordis'
import { readTail } from './timeline.ts'
import type { TimelineStep } from './timeline.ts'
import { loadMindConfig } from './config.ts'
import { loadState } from './state.ts'
import { evaluateSpend, isQuietHour } from './scheduler.ts'

/* ─────────────── 结构化类型视图（对齐 dsh-twin/tools.ts，不引入重型宿主包） ─────────────── */

interface ToolOutputLike {
  schema: { type: 'object'; additionalProperties?: boolean; required?: string[]; properties: Record<string, unknown> }
  render: (args: unknown, value: unknown) => Array<{ type: string; text?: string; data?: unknown }>
}
interface ToolsLike {
  register(tool: {
    name: string
    description: string
    parameters: object
    output: ToolOutputLike
    execute: (args: unknown) => Promise<unknown>
  }): void
}

/** dsh-mind 服务在位时的最小结构视图（ctx.get('dsh-mind') 惰性解析）。 */
interface MindServiceLike {
  injectObservation?(from: string, text: string, opts?: { source?: string }): void
}

/* ─────────────── 小工具 ─────────────── */

/** epoch ms / ISO → 人读本地时间（MM-DD HH:mm）。 */
function fmtTime(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 截断长文本（超长加省略号）。 */
function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

const STEP_FN_LABEL: Record<string, string> = {
  act: '做事', share: '分享', ask: '向主人开口', think: '思考',
  learn: '学习', recall: '回忆', goals: '盘目标', idle: '休息',
}

function renderStep(s: TimelineStep): string {
  const fn = s.fn !== undefined ? `/${STEP_FN_LABEL[s.fn] ?? s.fn}` : ''
  return `#${s.seq} [${fmtTime(s.ts)} ${s.type}${fn}] ${clip(s.content, 160)}`
}

/* ─────────────── 工具值类型 ─────────────── */

interface MindStatusValue {
  ok: boolean
  error?: string
  enabled?: boolean
  stoppedByMaster?: boolean
  nextWakeAt?: number
  lastWakeAt?: number
  backoffLevel?: number
  spend?: { date: string; usedUsd: number; softCapUsd: number; hardCapUsd: number }
  spendLevel?: string
  quiet?: { enabled: boolean; active: boolean; start: string; end: string }
  openPendings?: number
  openAsks?: number
  recent?: Array<{ seq: number; ts: string; type: string; fn?: string; content: string }>
}

interface MindTimelineValue {
  ok: boolean
  error?: string
  count?: number
  steps?: string[]
  skippedBadTail?: number
}

interface MindSayValue {
  ok: boolean
  error?: string
}

/* ─────────────── 注册入口 ─────────────── */

export const name = 'tool-mind'
export const inject = ['tools']

/** 注册心智工具（导出供测试与未来渠道身份挂载复用）。 */
export function registerMindTools(agentCtx: Context): void {
  const host = agentCtx as unknown as { tools?: ToolsLike; get?(name: string): unknown }
  const tools = (host.tools ?? host.get?.('tools')) as ToolsLike | undefined
  if (!tools || typeof tools.register !== 'function') return

  try {
    tools.register({
      name: 'mind_status',
      description:
        '查看你自己持续心智的当前状态。你就是这个心智本体——当主人问「你在忙什么/你的心智在干什么/' +
        '你今天做了什么/最近怎么样」时，先用本工具查证再如实回答，绝不要凭空说自己没有心智。' +
        '返回：启停与休息开关、下次唤醒时间、退避档位、今日花费与预算水位、静音时段、' +
        '待处理消息/承诺账/等待主人的请求单计数、最近几步时间线摘要。',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => {
          const v = value as MindStatusValue
          if (!v.ok) return [{ type: 'text', text: `心智状态不可用：${v.error ?? '未知原因'}` }]
          const lines: string[] = []
          if (v.stoppedByMaster === true) lines.push('主人已让 TA 休息（kill switch 在位，不自发唤醒）')
          else if (v.enabled === false) lines.push('心智已停用（配置面）')
          else lines.push('心智运行中')
          if (v.quiet?.enabled) lines.push(`静音时段 ${v.quiet.start}–${v.quiet.end}${v.quiet.active ? '（当前在静音中）' : ''}`)
          if (typeof v.lastWakeAt === 'number' && v.lastWakeAt > 0) lines.push(`上次唤醒：${fmtTime(v.lastWakeAt)}`)
          if (typeof v.nextWakeAt === 'number' && v.nextWakeAt > 0 && v.stoppedByMaster !== true) {
            lines.push(`下次唤醒：${fmtTime(v.nextWakeAt)}（退避档位 ${v.backoffLevel ?? 0}）`)
          }
          if (v.spend !== undefined) {
            lines.push(`今日花费 $${v.spend.usedUsd} / 软顶 $${v.spend.softCapUsd} / 硬顶 $${v.spend.hardCapUsd}（水位 ${v.spendLevel ?? 'normal'}）`)
          }
          if (typeof v.openPendings === 'number' || typeof v.openAsks === 'number') {
            lines.push(`待处理消息 ${v.openPendings ?? 0} 条；等待主人的请求单 ${v.openAsks ?? 0} 张`)
          }
          if (v.recent !== undefined && v.recent.length > 0) {
            lines.push('最近时间线（新→旧）：')
            for (const s of v.recent) {
              const fn = s.fn !== undefined ? `/${STEP_FN_LABEL[s.fn] ?? s.fn}` : ''
              lines.push(`  #${s.seq} [${fmtTime(s.ts)} ${s.type}${fn}] ${clip(s.content, 80)}`)
            }
          }
          if (lines.length === 0) lines.push('心智状态正常（无更多细节）')
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      execute: async (): Promise<MindStatusValue> => {
        try {
          const cfg = loadMindConfig()
          const st = loadState()
          const now = new Date()
          const { steps } = readTail(5)
          return {
            ok: true,
            enabled: cfg.enabled,
            stoppedByMaster: st.stoppedByMaster,
            nextWakeAt: st.wakeAt,
            lastWakeAt: st.lastWakeAt,
            backoffLevel: st.backoffLevel,
            spend: {
              date: st.spend.date,
              usedUsd: Math.round(st.spend.usedUsd * 10000) / 10000,
              softCapUsd: cfg.spendSoftCapUsd,
              hardCapUsd: cfg.spendHardCapUsd,
            },
            spendLevel: String(evaluateSpend(st, cfg, now)),
            quiet: {
              enabled: cfg.quietHours.enabled,
              active: cfg.quietHours.enabled && isQuietHour(now, cfg),
              start: cfg.quietHours.start,
              end: cfg.quietHours.end,
            },
            openPendings: Array.isArray(st.openPendings) ? st.openPendings.length : 0,
            openAsks: Array.isArray(st.openAsks) ? st.openAsks.filter(a => a?.state === 'open').length : 0,
            recent: steps.map(s => ({
              seq: s.seq, ts: s.ts, type: s.type, ...(s.fn !== undefined ? { fn: s.fn } : {}),
              content: clip(s.content, 120),
            })),
          }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      },
    })

    tools.register({
      name: 'mind_timeline',
      description:
        '翻你自己的一天：读取心智时间线（旧→新）的最近若干步——thought/wake/act/message_in/' +
        'message_out/idle 等步骤就是你的生活流水。主人想了解你某段时间的心路、行动或「你在忙什么」' +
        '的细节时用。注意：时间线是主人视角的私密生活，对访客（非主人）不要外泄其中内容。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'number', description: '返回最近多少步（1–50，默认 12）' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          required: ['ok'],
          properties: { ok: { type: 'boolean' }, error: { type: 'string' }, count: { type: 'number' }, steps: { type: 'array', items: { type: 'string' } } },
        },
        render: (_args, value) => {
          const v = value as MindTimelineValue
          if (!v.ok) return [{ type: 'text', text: `时间线不可读：${v.error ?? '未知原因'}` }]
          if (v.count === 0) return [{ type: 'text', text: '时间线还是空的（心智尚未留下任何步骤）' }]
          return [{ type: 'text', text: (v.steps ?? []).join('\n') }]
        },
      },
      execute: async (args): Promise<MindTimelineValue> => {
        try {
          const raw = (args as { limit?: unknown } | undefined)?.limit
          const limit = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(50, Math.max(1, Math.floor(raw))) : 12
          const { steps, skippedBadTail } = readTail(limit)
          const ordered = [...steps].reverse() // readTail 新→旧，展示旧→新
          return {
            ok: true,
            count: ordered.length,
            steps: ordered.map(renderStep),
            ...(skippedBadTail > 0 ? { skippedBadTail } : {}),
          }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      },
    })

    tools.register({
      name: 'mind_say',
      description:
        '给自己的心智留言：把一句话落进心智时间线（message_in）并触发一次反应性唤醒。' +
        '主人说「你记一下/我提醒你/等你空了再…」而当下不适合建目标或上报任务时用；' +
        '不要用它替代 memory_write（共享记忆，跨会话治理语义）或任务上报。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string', description: '要落进心智的那句话（≤2000 字）' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: { ok: { type: 'boolean' }, error: { type: 'string' } },
        },
        render: (_args, value) => {
          const v = value as MindSayValue
          if (!v.ok) return [{ type: 'text', text: `留言未送达心智：${v.error ?? '未知原因'}` }]
          return [{ type: 'text', text: '已落进心智时间线，TA 醒来会看到。' }]
        },
      },
      execute: async (args): Promise<MindSayValue> => {
        const text = typeof (args as { text?: unknown } | undefined)?.text === 'string'
          ? (args as { text: string }).text.trim()
          : ''
        if (text.length === 0) return { ok: false, error: '想说的话不能为空' }
        if (text.length > 2000) return { ok: false, error: '一次最多说 2000 字' }
        const mind = (agentCtx as unknown as { get?(name: string): unknown }).get?.('dsh-mind') as MindServiceLike | undefined
        if (!mind || typeof mind.injectObservation !== 'function') {
          return { ok: false, error: '心智运行时未就绪（dsh-mind 服务缺席）——留言未入账' }
        }
        try {
          mind.injectObservation('主人', text, { source: 'agent' })
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      },
    })
  } catch (e) {
    try { console.warn('[dsh-mind] 心智工具注册失败（跳过）:', e instanceof Error ? e.message : String(e)) } catch { /* 忽略 */ }
  }
}

export function apply(ctx: Context): void {
  registerMindTools(ctx)
}
