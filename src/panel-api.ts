/**
 * 插件页速览 HTTP 路由（设计 §3.3 五区块）。
 * LESSONS #11：插件自有 HTTP 路由不在上游认证围栏内——全部路由 sameOrigin 门禁
 * （带 Origin 且跨源 → 403；先例：dsh-memory v0.2.6 整改）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MindConfig } from './config.ts'
import type { SchedulerState } from './scheduler.ts'
import { readTail, type TimelineStep } from './timeline.ts'

export interface PanelDeps {
  getConfig(): MindConfig
  getState(): SchedulerState
  setStoppedByMaster(stopped: boolean): void
  isRunning(): boolean
}

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

export function registerPanelApi(
  web: { register(route: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }): void },
  deps: PanelDeps,
): void {
  web.register({
    kind: 'exact',
    path: '/dsh-mind/status',
    handler: (req, res) => {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross-origin denied' })
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method not allowed' })
      const cfg = deps.getConfig()
      const st = deps.getState()
      const { steps } = readTail(10)
      json(res, 200, {
        ok: true,
        version: 2,
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
        pending: 0, // P2 渠道接入后由 pending-request 协议填充
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
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: 'cross-origin denied' })
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
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
