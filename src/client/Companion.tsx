/**
 * 常驻存在体（shell.overlay 全帧浮层）：TA 住在 dsh 窗口的右下角。
 * 任何页面 TA 都在那里呼吸；点击就地展开面板——看见 TA、对 TA 说话、
 * 翻翻 TA 最近的生活、照看 TA。容器不拦截操作（pointer-events 穿透）。
 */
import { useState } from 'react'
import { narrateStep, presenceLine } from '../narrate.ts'
import { fetchFeed, fetchStatus, setMindStopped, usePoll, type StatusPayload } from './api.ts'
import { Being } from './Being.tsx'
import { Composer } from './Composer.tsx'
import { fmtClock, fmtUsd } from './format.tsx'

const POLL_STATUS_MS = 25000
const POLL_FEED_MS = 20000
const SUB = 'var(--dsw-alias-label-secondary, #888)'

/** 展开面板的折叠分节（display:flex 去掉 details 默认三角，自定义箭头）。 */
function Section({ summary, children }: { summary: string; children: React.ReactNode }): JSX.Element {
  return (
    <details style={{ borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.18))' }}>
      <summary
        style={{
          cursor: 'pointer', fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #aaa)',
          userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 2px',
        }}
        onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.color = 'var(--dsw-alias-label-primary, #eee)' }}
        onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.color = 'var(--dsw-alias-label-secondary, #aaa)' }}
      >
        <span style={{ fontSize: 9, opacity: 0.8 }}>▶</span>
        {summary}
      </summary>
      <div style={{ paddingBottom: 8 }}>{children}</div>
    </details>
  )
}

/** 右下角存在体 + 就地展开面板（注册到 shell.overlay 的组件）。 */
export function CompanionLayer(): JSX.Element {
  const [open, setOpen] = useState(false)
  const status = usePoll(fetchStatus, POLL_STATUS_MS)
  const st = status.data
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2147483000, pointerEvents: 'none' }}>
      {open && (
        <div style={{
          pointerEvents: 'auto', position: 'relative', width: 344, marginBottom: 10,
          padding: '14px 14px 10px', borderRadius: 16,
          background: 'var(--dsw-alias-bg-overlay, rgba(24,26,30,.97))',
          border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))',
          boxShadow: '0 12px 40px rgba(0,0,0,.45)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* 关闭按钮：面板右上角 */}
          <button
            type="button" aria-label="收起" title="收起"
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%',
              border: 'none', background: 'transparent', color: SUB, fontSize: 15,
              lineHeight: '24px', textAlign: 'center', cursor: 'pointer', padding: 0,
            }}
            onMouseEnter={(e: React.MouseEvent) => {
              e.currentTarget.style.background = 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.16))'
              e.currentTarget.style.color = 'var(--dsw-alias-label-primary, #eee)'
            }}
            onMouseLeave={(e: React.MouseEvent) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = SUB
            }}
          >
            ×
          </button>

          {/* 头部：存在体 + 在场句 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 22 }}>
            <Being size={62} status={st} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>分身</div>
              <div style={{ fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #bbb)', lineHeight: '18px', marginTop: 2 }}>
                {st !== undefined ? presenceLine(st) : '…'}
              </div>
            </div>
          </div>

          <Composer status={st} compact refresh={() => { status.refresh() }} />

          <Section summary="TA 最近的生活"><RecentLife /></Section>
          <Section summary="照看 TA"><CareMini status={st} refresh={() => { status.refresh() }} /></Section>
        </div>
      )}

      {/* 常驻存在体（点击开合） */}
      <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <div
          role="button"
          title={st !== undefined ? presenceLine(st) : '分身'}
          onClick={() => setOpen(o => !o)}
          style={{ cursor: 'pointer', padding: 6, borderRadius: '9999px', transition: 'transform .18s ease' }}
          onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
          onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >
          <Being size={56} status={st} />
        </div>
      </div>
    </div>
  )
}

/** 最近生活（仅展开时拉取，最多 14 步）。 */
function RecentLife(): JSX.Element {
  const feed = usePoll(async () => (await fetchFeed(30)).slice(0, 14), POLL_FEED_MS)
  if (feed.data === undefined) {
    return <div style={{ fontSize: 12, color: SUB, padding: '6px 0' }}>…</div>
  }
  if (feed.data.length === 0) {
    return <div style={{ fontSize: 12, color: SUB, padding: '6px 0' }}>TA 还没醒过。</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 0 4px', maxHeight: 260, overflowY: 'auto' }}>
      {[...feed.data].reverse().map(s => {
        const n = narrateStep(s)
        const text = n.kind === 'you'
          ? `你说：${n.body ?? ''}`
          : n.kind === 'rest'
            ? n.title
            : `${n.title}${n.body !== undefined && n.body !== '' ? `：${n.body.slice(0, 60)}` : ''}`
        return (
          <div key={n.seq} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
            <span style={{ color: SUB, whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{fmtClock(n.ts)}</span>
            <span style={{
              minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: n.kind === 'rest' ? SUB : n.kind === 'you' ? 'var(--dsw-alias-label-primary, #eee)' : undefined,
              fontWeight: n.kind === 'you' ? 500 : 400,
            }}>
              {text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CareMini({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element | null {
  if (status === undefined) return null
  const { spend } = status
  const pct = Math.min(100, Math.round((spend.usedUsd / Math.max(spend.hardCapUsd, 0.01)) * 100))
  const overSoft = spend.usedUsd >= spend.softCapUsd
  const overHard = spend.usedUsd >= spend.hardCapUsd
  const stopped = status.stoppedByMaster || !status.enabled
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12, padding: '8px 0 2px', color: 'var(--dsw-alias-label-secondary, #bbb)' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>今天的心思 {fmtUsd(spend.usedUsd)}</span>
          <span>/ {fmtUsd(spend.hardCapUsd)}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 2,
            background: overHard ? 'var(--dsw-alias-state-error-primary, #c0392b)' : overSoft ? 'var(--dsw-alias-state-warn-primary, #b8860b)' : 'var(--dsw-alias-state-success-primary, #2A9D8F)',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(status.pendingApprovals ?? 0) > 0 && (
          <span style={{ color: 'var(--dsw-alias-state-warn-primary, #b8860b)' }}>{status.pendingApprovals} 件等你点头</span>
        )}
        <span>软顶 {fmtUsd(spend.softCapUsd)}</span>
      </div>
      <div>
        <button
          type="button"
          onClick={() => { void setMindStopped(!stopped).then(refresh) }}
          style={{
            padding: '4px 12px', cursor: 'pointer', borderRadius: 8, fontSize: 12,
            border: `1px solid color-mix(in srgb, ${stopped ? 'var(--dsw-alias-state-success-primary, #2A9D8F)' : 'var(--dsw-alias-state-warn-primary, #b8860b)'} 45%, transparent)`,
            color: stopped ? 'var(--dsw-alias-state-success-primary, #2A9D8F)' : 'var(--dsw-alias-state-warn-primary, #b8860b)',
            background: 'transparent',
          }}
        >
          {stopped ? '▶ 恢复心智' : '⏸ 暂停心智'}
        </button>
      </div>
    </div>
  )
}
