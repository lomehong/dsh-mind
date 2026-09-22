/**
 * dsh-mind 客户端 API 层：写门禁键缓存 + 轮询 hooks。
 * 读路由 sameOrigin；写路由携 x-mind-key（GET /dsh-mind/token 一次性取用）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface StatusPayload {
  ok: boolean
  version: number
  enabled: boolean
  stoppedByMaster: boolean
  running: boolean
  backoffLevel: number
  wakeAt: number
  lastWakeAt: number
  spend: { date: string; usedUsd: number; softCapUsd: number; hardCapUsd: number }
  spendLevel?: 'normal' | 'soft' | 'hard'
  pending?: number
  pendingApprovals?: number
  quiet?: { enabled: boolean; active: boolean; start: string; end: string; tz: string }
  tail: Array<{ seq: number; ts: string; type: string; source: string; content: string; fn?: string }>
}

export interface FeedStep {
  seq: number
  ts: string
  type: string
  source: string
  content: string
  trigger?: string
  fn?: string
  final?: string
  usage?: { llmCalls: number; tokensIn: number; tokensOut: number; costUsd: number }
  refs?: Record<string, string>
}

let keyPromise: Promise<string> | undefined

/** 写门禁键（进程启动随机，缓存于内存；失效下次写操作会再取一次）。 */
export function writeKey(refetch = false): Promise<string> {
  if (refetch || keyPromise === undefined) {
    keyPromise = fetch('/dsh-mind/token')
      .then(r => r.json() as Promise<{ ok: boolean; key?: string }>)
      .then(b => {
        if (b.ok === true && typeof b.key === 'string') return b.key
        throw new Error('获取校验键失败')
      })
      .catch(e => {
        keyPromise = undefined
        throw e
      })
  }
  return keyPromise
}

async function postJson(path: string, body: unknown, retry = true): Promise<{ ok: boolean; error?: string }> {
  try {
    const key = await writeKey()
    const resp = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mind-key': key },
      body: JSON.stringify(body),
    })
    const data = (await resp.json()) as { ok: boolean; error?: string }
    if (resp.status === 401 && retry) {
      writeKey(true) // 进程重启键已换：刷新后重试一次
      return postJson(path, body, false)
    }
    return data
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function sayToMind(text: string): Promise<{ ok: boolean; error?: string }> {
  return postJson('/dsh-mind/say', { text })
}

export function setMindStopped(stopped: boolean): Promise<{ ok: boolean; error?: string }> {
  return postJson('/dsh-mind/kill', { stopped })
}

export async function fetchStatus(): Promise<StatusPayload> {
  const resp = await fetch('/dsh-mind/status')
  return (await resp.json()) as StatusPayload
}

export async function fetchFeed(n = 200): Promise<FeedStep[]> {
  const resp = await fetch(`/dsh-mind/timeline?n=${n}`)
  const body = (await resp.json()) as { ok: boolean; steps: FeedStep[] }
  return body.steps ?? []
}

/** 轮询 hook：pollMs 轮询一次，refresh() 立即刷新。 */
export function usePoll<T>(fn: () => Promise<T>, pollMs: number): { data?: T; error?: string; refresh(): void } {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      fnRef.current()
        .then(d => {
          if (!cancelled) {
            setData(d)
            setError(undefined)
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        })
    }
    void load()
    const timer = setInterval(load, pollMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pollMs, tick])
  return { data, error, refresh: useCallback(() => setTick(t => t + 1), []) }
}
