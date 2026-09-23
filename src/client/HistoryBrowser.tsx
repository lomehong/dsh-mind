/**
 * 「TA 的一生」全史浏览器（P4 只读投影）：按 beforeSeq 游标向前翻页，
 * 叙事层渲染，只读——说话与照看在右下角常驻存在体。
 */
import { useState } from 'react'
import { fetchFeed, type FeedStep } from './api.ts'
import { coalesceRests, narrateStep, type NarratedStep } from '../narrate.ts'
import { fmtClock } from './format.tsx'

const SUB = 'var(--dsw-alias-label-secondary, #888)'
const PAGE = 100

function Row({ step }: { step: NarratedStep }): JSX.Element {
  if (step.kind === 'rest' && step.fold !== undefined && step.fold.count > 1) {
    return (
      <details style={{ padding: '3px 2px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.12))' }}>
        <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline', color: SUB, fontSize: 12 }}>
          <span style={{ fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>
            {fmtClock(step.fold.fromTs)}~{fmtClock(step.fold.toTs)}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.title}</span>
        </summary>
        <div style={{ padding: '2px 0 4px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {step.fold.items.map(item => (
            <div key={item.seq} style={{ display: 'flex', gap: 8, fontSize: 11, color: SUB }}>
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>{fmtClock(item.ts)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
            </div>
          ))}
        </div>
      </details>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 2px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.12))' }}>
      <span style={{ color: SUB, fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>{fmtClock(step.ts)}</span>
      <span style={{
        fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        color: step.kind === 'you' ? 'var(--dsw-alias-label-primary, #eee)' : SUB,
        fontWeight: step.kind === 'you' ? 500 : 400,
      }}>
        {step.kind === 'rest' ? `— ${step.title} —` : step.title}
      </span>
    </div>
  )
}

/** 全史浏览器：初始 100 步，「载入更早」按游标续拉。 */
export function HistoryBrowser(): JSX.Element {
  const [steps, setSteps] = useState<FeedStep[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)

  const load = async (before?: number): Promise<void> => {
    setLoading(true)
    try {
      const batch = await fetchFeed(PAGE, before)
      setSteps(prev => [...prev, ...batch])
      if (batch.length < PAGE) setDone(true)
      setStarted(true)
    } catch { /* 静默：保持已载内容 */ } finally {
      setLoading(false)
    }
  }

  if (!started) {
    return (
      <button
        type="button"
        onClick={() => { void load() }}
        style={{
          padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', borderRadius: 8,
          border: '1px solid var(--dsw-alias-border-l1, #444)', background: 'transparent',
          color: 'var(--dsw-alias-label-secondary, #aaa)',
        }}
      >翻开 TA 的一生（只读全史）</button>
    )
  }

  const lastSeq = steps.length > 0 ? steps[steps.length - 1]!.seq : undefined
  const rows = coalesceRests(steps.map(narrateStep))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      {rows.map(n => <Row key={n.seq} step={n} />)}
      {!done && lastSeq !== undefined && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { void load(lastSeq) }}
          style={{ marginTop: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8, alignSelf: 'center', border: '1px solid var(--dsw-alias-border-l1, #444)', background: 'transparent', color: SUB }}
        >{loading ? '载入中…' : '载入更早'}</button>
      )}
      {done && <div style={{ textAlign: 'center', fontSize: 11, color: SUB, padding: '6px 0' }}>已经翻到 TA 诞生的那一刻了。</div>}
    </div>
  )
}
