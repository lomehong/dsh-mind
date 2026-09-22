/** 留言输入区（主页与右下角常驻面板共用）。 */
import { useState } from 'react'
import { sayToMind, setMindStopped, type StatusPayload } from './api.ts'

export function Composer({ status, refresh, compact }: { status: StatusPayload | undefined; refresh(): void; compact?: boolean }): JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<string>()
  const stopped = status !== undefined && (status.stoppedByMaster || !status.enabled)
  const send = (): void => {
    const t = text.trim()
    if (t === '' || sending) return
    setSending(true)
    setNote(undefined)
    void sayToMind(t).then(r => {
      setSending(false)
      if (r.ok) {
        setText('')
        refresh()
      } else {
        setNote(r.error ?? '没说出去，再试一次')
      }
    })
  }
  if (stopped) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '8px 10px' : '10px 14px',
        border: '1px solid var(--dsw-alias-border-l1, #333)', borderRadius: 12,
        color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 13,
      }}>
        <span style={{ flex: 1 }}>TA 正在休息。</span>
        <button type="button" onClick={() => { void setMindStopped(false).then(refresh) }}
          style={{ padding: '5px 14px', cursor: 'pointer', borderRadius: 8 }}>
          叫醒 TA
        </button>
      </div>
    )
  }
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8, padding: compact ? '6px 6px 6px 12px' : '8px 8px 8px 14px',
        border: '1px solid var(--dsw-alias-border-l1, #333)', borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
      }}>
        <textarea
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder="对 TA 说点什么…（TA 听到就会回应）"
          style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontSize: 13, lineHeight: '20px', maxHeight: 96 }}
        />
        <button type="button" disabled={text.trim() === '' || sending} onClick={send}
          style={{ padding: '6px 16px', cursor: 'pointer', borderRadius: 8, border: 'none', color: '#fff', background: 'var(--dsw-alias-brand-primary, #4a6fa5)', opacity: text.trim() === '' || sending ? 0.5 : 1 }}>
          {sending ? '…' : '告诉 TA'}
        </button>
      </div>
      {note !== undefined && <div style={{ color: 'var(--dsw-alias-state-error-primary, #c0392b)', fontSize: 12, marginTop: 4 }}>{note}</div>}
    </div>
  )
}
