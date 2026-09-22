/**
 * 常驻存在体（shell.overlay 全帧浮层）：TA 住在 dsh 窗口的右下角。
 * 任何页面 TA 都在那里呼吸；点击就地展开面板——看见 TA、对 TA 说话、
 * 翻翻 TA 最近的生活、照看 TA。容器不拦截操作（pointer-events 穿透）。
 */
import { useState } from 'react'
import { narrateStep, presenceLine } from '../narrate.ts'
import { fetchFeed, fetchStatus, setMindStopped, usePoll, type FeedStep, type StatusPayload } from './api.ts'
import { Being } from './Being.tsx'
import { Composer } from './Composer.tsx'
import { fmtClock, fmtUsd } from './format.tsx'

const POLL_STATUS_MS = 25000
const POLL_FEED_MS = 20000

/** 右下角存在体 + 就地展开面板（注册到 shell.overlay 的组件）。 */
export function CompanionLayer(): JSX.Element {
  const [open, setOpen] = useState(false)
  const status = usePoll(fetchStatus, POLL_STATUS_MS)
  const st = status.data
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2147483000, pointerEvents: 'none' }}>
      {open && (
        <div style={{
          pointerEvents: 'auto', width: 336, marginBottom: 10, padding: 14, borderRadius: 16,
          background: 'var(--dsw-alias-bg-overlay, rgba(24,26,30,.97))',
          border: '1px solid var(--dsw-alias-border-l1, #333)',
          boxShadow: '0 12px 40px rgba(0,0,0,.4)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Being size={72} status={st} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>分身</div>
              <div style={{ fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #bbb)' }}>
                {st !== undefined ? presenceLine(st) : '…'}
              </div>
            </div>
            <button type="button" title="收起" onClick={() => setOpen(false)}
              style={{ border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-secondary, #888)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <Composer status={st} compact refresh={() => { status.refresh() }} />
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #aaa)' }}>TA 最近的生活</summary>
            <RecentLife />
          </details>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #aaa)' }}>照看 TA</summary>
            <CareMini status={st} refresh={() => { status.refresh() }} />
          </details>
        </div>
      )}
      <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <div
          title={st !== undefined ? presenceLine(st) : '分身'}
          onClick={() => setOpen(o => !o)}
          style={{ cursor: 'pointer', padding: 6, borderRadius: '50%', transition: 'transform .2s' }}
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
  if (feed.data === undefined) return <div style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)', padding: '6px 0' }}>…</div>
  if (feed.data.length === 0) return <div style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)', padding: '6px 0' }}>TA 还没醒过。</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', maxHeight: 260, overflowY: 'auto' }}>
      {[...feed.data].reverse().map(s => {
        const n = narrateStep(s as never)
        return (
          <div key={n.seq} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--dsw-alias-label-secondary, #888)', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtClock(n.ts)}</span>
            <span style={{ color: n.kind === 'rest' ? 'var(--dsw-alias-label-secondary, #888)' : undefined }}>
              {n.kind === 'you' ? `你说：${n.body ?? ''}` : n.kind === 'rest' ? n.title : `${n.title}${n.body !== undefined && n.body !== '' ? `：${n.body.slice(0, 60)}` : ''}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CareMini({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element | null {
  if (status === undefined) return null
  const stopped = status.stoppedByMaster || !status.enabled
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, padding: '8px 0', color: 'var(--dsw-alias-label-secondary, #bbb)' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>今天的心思 {fmtUsd(status.spend.usedUsd)} / {fmtUsd(status.spend.hardCapUsd)}</span>
        {status.pendingApprovals !== undefined && status.pendingApprovals > 0 && (
          <span style={{ color: 'var(--dsw-alias-state-warn-primary, #b8860b)' }}>{status.pendingApprovals} 件等你点头</span>
        )}
      </div>
      <div>
        <button type="button" onClick={() => { void setMindStopped(!stopped).then(refresh) }}
          style={{ padding: '4px 12px', cursor: 'pointer', borderRadius: 8 }}>
          {stopped ? '叫醒 TA' : '让 TA 休息'}
        </button>
      </div>
    </div>
  )
}

export type { FeedStep }
