/**
 * dsh-mind HTTP 面（心智主页 + 插件页速览共用）。
 *
 * 门禁纪律（LESSONS #11：插件自有 HTTP 路由不在上游认证围栏内）：
 * - 全部路由 sameOrigin 门禁（带 Origin 且跨源 → 403；先例：dsh-memory v0.2.6 整改）；
 * - 写操作（/say、/kill）额外要求启动时随机生成的校验键（x-mind-key 自定义头，
 *   跨站表单/脚本无法携带——先例：dsh-memory 的同类写门禁）。
 *
 * 路由：
 * - GET  /dsh-mind/token   下发写门禁键（sameOrigin；供内置客户端一次性取用）
 * - GET  /dsh-mind/status  在场感状态（v3：+静音时段/下次唤醒/待批数/反应队列）
 * - GET  /dsh-mind/timeline 时间线尾部（生活流数据源；n 上限 200）
 * - POST /dsh-mind/kill    休息开关（stopped: boolean）
 * - POST /dsh-mind/say     主人留言（text → message_in 落时间线 + 反应性唤醒）
 */
import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MindConfig } from './config.ts'
import { evaluateSpend, isQuietHour } from './scheduler.ts'
import type { SchedulerState } from './scheduler.ts'
import { readTail, type TimelineStep } from './timeline.ts'

export interface PanelDeps {
  getConfig(): MindConfig
  getState(): SchedulerState
  setStoppedByMaster(stopped: boolean): void
  isRunning(): boolean
  /** 反应队列当前长度（对 TA 说话后的「正在处理」呈现）。 */
  reactiveQueued(): number
  /** 自治面待主人批准数（「TA 在等你点头」）。 */
  pendingApprovals(): number
  /** 主人留言：message_in 落时间线 + 反应性唤醒。 */
  say(text: string): void
}

/** 写门禁键：每次进程启动随机生成，不落盘（重启即换；先例 dsh-memory）。 */
const gateKey = randomBytes(16).toString('hex')

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (origin === undefined) return true // 同源/宿主内调用不带 Origin
  const host = req.headers.host
  if (typeof host !== 'string') return false
  try {
    return new URL(String(origin)).host === host
  } catch {
    return false
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 16 * 1024) {
        req.destroy()
        resolve('')
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(chunks.map(c => c.toString('utf8')).join('')))
    req.on('error', () => resolve(''))
  })
}

/** 写操作门禁：sameOrigin + 随机键双闸。 */
function writeGate(req: IncomingMessage, res: ServerResponse): boolean {
  if (!sameOrigin(req)) {
    json(res, 403, { ok: false, error: 'cross-origin denied' })
    return false
  }
  if (req.headers['x-mind-key'] !== gateKey) {
    json(res, 401, { ok: false, error: '缺少或无效的校验键（x-mind-key）' })
    return false
  }
  return true
}

export function registerPanelApi(
  web: { register(route: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }): void },
  deps: PanelDeps,
): void {
  web.register({
    kind: 'exact',
    path: '/dsh-mind/token',
    handler: (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross-origin denied' })
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
      json(res, 200, { ok: true, key: gateKey })
    },
  })

  web.register({
    kind: 'exact',
    path: '/dsh-mind/status',
    handler: (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross-origin denied' })
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
      const cfg = deps.getConfig()
      const st = deps.getState()
      const { steps } = readTail(10)
      const quiet = cfg.quietHours
      json(res, 200, {
        ok: true,
        version: 3,
        enabled: cfg.enabled,
        stoppedByMaster: st.stoppedByMaster,
        running: deps.isRunning(),
        backoffLevel: st.backoffLevel,
        wakeAt: st.wakeAt,
        lastWakeAt: st.lastWakeAt,
        spend: {
          date: st.spend.date,
          usedUsd: Math.round(st.spend.usedUsd * 10000) / 10000,
          softCapUsd: cfg.spendSoftCapUsd,
          hardCapUsd: cfg.spendHardCapUsd,
        },
        spendLevel: evaluateSpend(st, cfg, new Date()),
        pending: deps.reactiveQueued(), // 正在排队等 TA 处理的观察数
        pendingApprovals: deps.pendingApprovals(),
        quiet: {
          enabled: quiet.enabled,
          active: quiet.enabled && isQuietHour(new Date(), cfg),
          start: quiet.start,
          end: quiet.end,
          tz: quiet.tz,
        },
        tail: steps.map(s => ({
          seq: s.seq, ts: s.ts, type: s.type, source: s.source,
          content: s.content.length > 160 ? `${s.content.slice(0, 157)}…` : s.content,
          fn: s.fn,
        })),
      })
    },
  })

  web.register({
    kind: 'exact',
    path: '/dsh-mind/kill',
    handler: (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
      if (!writeGate(req, res)) return
      void (async () => {
        try {
          const body = JSON.parse(await readBody(req)) as { stopped?: unknown }
          if (typeof body.stopped !== 'boolean') return json(res, 400, { ok: false, error: 'stopped 必须为 boolean' })
          deps.setStoppedByMaster(body.stopped)
          json(res, 200, { ok: true, stopped: body.stopped })
        } catch (e) {
          json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      })()
    },
  })

  web.register({
    kind: 'exact',
    path: '/dsh-mind/say',
    handler: (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
      if (!writeGate(req, res)) return
      void (async () => {
        try {
          const body = JSON.parse(await readBody(req)) as { text?: unknown }
          const text = typeof body.text === 'string' ? body.text.trim() : ''
          if (text.length === 0) return json(res, 400, { ok: false, error: '想说的话不能为空' })
          if (text.length > 2000) return json(res, 400, { ok: false, error: '一次最多说 2000 字' })
          deps.say(text)
          json(res, 200, { ok: true })
        } catch (e) {
          json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      })()
    },
  })

  web.register({
    kind: 'exact',
    path: '/dsh-mind/timeline',
    handler: (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross-origin denied' })
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const n = Math.min(200, Math.max(1, Number(url.searchParams.get('n') ?? 50) || 50))
      const steps: TimelineStep[] = readTail(n).steps
      json(res, 200, { ok: true, steps })
    },
  })
}
