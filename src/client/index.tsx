/**
 * dsh-mind 客户端插件：「插件」管理页配置区速览（plugins.bundle.config，
 * key=包名）——成本行 / 状态 / kill switch / 时间线最近步骤（设计 §3.3 五区块）。
 */
import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'

export const inject = ['slots']

interface StatusPayload {
  ok: boolean
  enabled: boolean
  stoppedByMaster: boolean
  running: boolean
  backoffLevel: number
  lastWakeAt: number
  spend: { date: string; usedUsd: number; softCapUsd: number; hardCapUsd: number }
  pending: number
  tail: Array<{ seq: number; ts: string; type: string; content: string; fn?: string }>
}

function useStatus(pollMs: number): { data?: StatusPayload; error?: string; refresh(): void } {
  const [data, setData] = useState<StatusPayload>()
  const [error, setError] = useState<string>()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const resp = await fetch('/dsh-mind/status')
        const body = (await resp.json()) as StatusPayload
        if (!cancelled) {
          if (body.ok) {
            setData(body)
            setError(undefined)
          } else setError('读取失败')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void load()
    const timer = setInterval(() => { void load() }, pollMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pollMs, tick])
  return { data, error, refresh: () => setTick(t => t + 1) }
}

async function setStopped(stopped: boolean): Promise<void> {
  await fetch('/dsh-mind/kill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stopped }),
  })
}

const fmtTime = (ts: number): string => (ts > 0 ? new Date(ts).toLocaleTimeString() : '—')
const fmtUsd = (v: number): string => `$${v.toFixed(2)}`

function Page(): JSX.Element {
  const { data, error, refresh } = useStatus(5000)
  if (data === undefined) {
    return <div style={{ padding: 12, color: '#888' }}>{error !== undefined ? `读取失败：${error}` : '读取中…'}</div>
  }
  const capped = data.spend.usedUsd >= data.spend.hardCapUsd
  const soft = !capped && data.spend.usedUsd >= data.spend.softCapUsd
  const stopped = data.stoppedByMaster || !data.enabled
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          padding: '2px 10px', borderRadius: 10,
          background: stopped ? '#999' : data.running ? '#2A9D8F' : '#4a6fa5',
          color: '#fff',
        }}>
          {stopped ? '已暂停' : data.running ? '思考中' : '待机'}
        </span>
        <span>退避档位 L{data.backoffLevel}</span>
        <span>上次唤醒 {fmtTime(data.lastWakeAt)}</span>
        <span style={{ color: capped ? '#c0392b' : soft ? '#b8860b' : undefined }}>
          今日 {fmtUsd(data.spend.usedUsd)} / 硬顶 {fmtUsd(data.spend.hardCapUsd)}{capped ? '（已触顶：自发暂停）' : soft ? '（软顶：快模型）' : ''}
        </span>
        <span>待处理 {data.pending}</span>
        <button
          type="button"
          onClick={() => { void setStopped(!stopped).then(refresh) }}
          style={{ marginLeft: 'auto', padding: '4px 14px', cursor: 'pointer' }}
        >
          {stopped ? '▶ 恢复心智' : '⏸ 暂停心智'}
        </button>
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>时间线（最近）</div>
        {data.tail.length === 0
          ? <div style={{ color: '#888' }}>暂无步骤——分身尚未醒来</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.tail.slice().reverse().map(step => (
                <div key={step.seq} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: '#888', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {new Date(step.ts).toLocaleTimeString()}
                  </span>
                  <span style={{ fontFamily: 'monospace' }}>[{step.type}{step.fn !== undefined ? `:${step.fn}` : ''}]</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.content}</span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: '@dsh-extra/dsh-mind',
  }, (props: { view: 'summary' | 'page' }) => {
    if (props.view !== 'page') {
      return (
        <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)' }}>
          分身心智：持续思考与自主行动的运行时（时间线 / 节奏 / 成本护栏）。
        </span>
      )
    }
    return <Page />
  }))
}
