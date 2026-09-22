/**
 * 心智主页：TA 的存在界面（人视图）。
 * 在场感头部（呼吸光环 + 第一人称状态）→ 留言 → 生活流（按天分组的时间线叙事）
 * → 照护抽屉（预算/作息/待批/休息开关）。右上角可切「工程视图」（EngView）。
 */
import { useEffect, useRef, useState } from 'react'
import { groupByDay, greeting, presenceLine, type NarratedStep } from '../narrate.ts'
import { fetchFeed, fetchStatus, sayToMind, setMindStopped, usePoll, type FeedStep, type StatusPayload } from './api.ts'
import { EngView } from './EngView.tsx'
import { fmtClock, fmtCountdown, fmtUsd } from './format.tsx'

const VIEW_KEY = 'dsh-mind.view'

let styleInjected = false
/** 呼吸光环动画（注入一次）。 */
function injectStyle(): void {
  if (styleInjected) return
  styleInjected = true
  const el = document.createElement('style')
  el.textContent = `
@keyframes dsh-mind-breathe {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--dsw-alias-state-success-primary, #2A9D8F) 45%, transparent); }
  50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--dsw-alias-state-success-primary, #2A9D8F) 0%, transparent); }
}
@keyframes dsh-mind-dim {
  0%, 100% { opacity: .55; }
  50% { opacity: .8; }
}`
  document.head.appendChild(el)
}

/** 在场光环：思考中=呼吸绿，睡着/停=暗，醒着=静蓝。 */
function PresenceOrb({ status, size = 40 }: { status: StatusPayload | undefined; size?: number }): JSX.Element {
  injectStyle()
  const stopped = status !== undefined && (status.stoppedByMaster || !status.enabled)
  const asleep = status?.quiet?.active === true
  const thinking = status?.running === true
  const bg = stopped
    ? 'var(--dsw-alias-label-secondary, #9aa0a6)'
    : asleep
      ? 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4a6fa5) 40%, #1a1c20)'
      : thinking || status === undefined
        ? 'var(--dsw-alias-state-success-primary, #2A9D8F)'
        : 'var(--dsw-alias-brand-primary, #4a6fa5)'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      opacity: stopped ? 0.5 : 1,
      animation: thinking ? 'dsh-mind-breathe 2.4s ease-in-out infinite'
        : asleep ? 'dsh-mind-dim 4s ease-in-out infinite' : undefined,
    }} />
  )
}

/** 留言输入区。 */
function Composer({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element {
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
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        border: '1px solid var(--dsw-alias-border-l1, #333)', borderRadius: 12,
        color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 13,
      }}>
        <span style={{ flex: 1 }}>TA 正在休息，说不了话。</span>
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
        display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 8px 8px 14px',
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

/** 单步叙事渲染。 */
function StepRow({ step }: { step: NarratedStep }) {
  const time = <span style={{ color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtClock(step.ts)}</span>
  if (step.kind === 'you') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '82%', padding: '8px 12px', borderRadius: '12px 12px 3px 12px',
          background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.12))',
          border: '1px solid var(--dsw-alias-border-l1, #333)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)', marginBottom: 2 }}>你 · {time.props.children}</div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{step.body}</div>
        </div>
      </div>
    )
  }
  if (step.kind === 'mind') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{
          maxWidth: '82%', padding: '8px 12px', borderRadius: '12px 12px 12px 3px',
          background: 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4a6fa5) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4a6fa5) 35%, transparent)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)', marginBottom: 2 }}>TA · {time.props.children}</div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{step.body}</div>
        </div>
      </div>
    )
  }
  if (step.kind === 'rest') {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'center', color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 12 }}>
        <span>{fmtClock(step.ts)}</span><span>— {step.title} —</span>
      </div>
    )
  }
  if (step.kind === 'break') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {time}
        <div style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12.5, border: '1px dashed color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b8860b) 50%, transparent)', color: 'var(--dsw-alias-label-secondary, #aaa)' }}>
          {step.title}
          <details style={{ marginTop: 2 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)' }}>细节</summary>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>{step.body}</div>
          </details>
        </div>
      </div>
    )
  }
  // moment：一次思绪/行动的时刻卡
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {time}
      <div style={{ flex: 1, minWidth: 0, padding: '6px 0 2px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.15))' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{step.title}</div>
        {step.body !== undefined && step.body !== '' && (
          <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary, #bbb)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>{step.body}</div>
        )}
        {step.detail !== undefined && (
          <details style={{ marginTop: 2 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)' }}>{step.detail}</summary>
          </details>
        )}
      </div>
    </div>
  )
}

/** 生活流：按天分组。 */
function LifeStream({ feed }: { feed: FeedStep[] | undefined }): JSX.Element {
  if (feed === undefined) {
    return <div style={{ color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 13, padding: '12px 0' }}>TA 的生活还在加载…</div>
  }
  if (feed.length === 0) {
    return (
      <div style={{ color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
        TA 还没醒过 —— 说句话，或等 TA 自己醒来。
      </div>
    )
  }
  const groups = groupByDay(feed, new Date())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {groups.map(day => (
        <div key={day.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--dsw-alias-label-secondary, #888)', fontSize: 12, position: 'sticky', top: 0, background: 'var(--dsw-alias-bg-base, transparent)', padding: '6px 0', zIndex: 1 }}>
            <span style={{ fontWeight: 600 }}>{day.label}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--dsw-alias-border-l1, rgba(128,128,128,.2))' }} />
          </div>
          {day.steps.map(s => <StepRow key={s.seq} step={s} />)}
        </div>
      ))}
    </div>
  )
}

/** 照护抽屉：预算/作息/待批/休息开关（治理与成本都在这里，不喧宾夺主）。 */
function CareDrawer({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element | null {
  if (status === undefined) return null
  const { spend } = status
  const pct = Math.min(100, Math.round((spend.usedUsd / Math.max(spend.hardCapUsd, 0.01)) * 100))
  const overSoft = spend.usedUsd >= spend.softCapUsd
  const overHard = spend.usedUsd >= spend.hardCapUsd
  const barColor = overHard ? 'var(--dsw-alias-state-error-primary, #c0392b)' : overSoft ? 'var(--dsw-alias-state-warn-primary, #b8860b)' : 'var(--dsw-alias-state-success-primary, #2A9D8F)'
  const stopped = status.stoppedByMaster || !status.enabled
  return (
    <details style={{ borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.2))', paddingTop: 8 }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--dsw-alias-label-secondary, #aaa)', userSelect: 'none' }}>
        照看 TA
        {status.pendingApprovals !== undefined && status.pendingApprovals > 0 && (
          <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 8, fontSize: 11, color: '#fff', background: 'var(--dsw-alias-state-warn-primary, #b8860b)' }}>
            {status.pendingApprovals} 件事等你点头
          </span>
        )}
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, padding: '10px 0', color: 'var(--dsw-alias-label-secondary, #bbb)' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>今天的心思花了 {fmtUsd(spend.usedUsd)}</span>
            <span>{overHard ? '触顶了，TA 在省着用' : overSoft ? '过了软顶，TA 自动放慢了' : `预算 ${fmtUsd(spend.hardCapUsd)}`}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.2))' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width .4s' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {status.quiet !== undefined && status.quiet.enabled && (
            <span>作息：{status.quiet.start}–{status.quiet.end} 睡{status.quiet.active ? '（已入睡）' : ''}</span>
          )}
          {!stopped && !status.quiet?.active && <span>下次自己醒：{fmtCountdown(status.wakeAt - Date.now())}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => { void setMindStopped(!stopped).then(refresh) }}
            style={{ padding: '4px 12px', cursor: 'pointer', borderRadius: 8 }}>
            {stopped ? '叫醒 TA' : '让 TA 休息'}
          </button>
          <span style={{ fontSize: 11 }}>
            {stopped ? 'TA 会记得是被你叫醒的' : '自发思考暂停；别人叫 TA 仍会回应'}
          </span>
        </div>
      </div>
    </details>
  )
}

/** 心智主页（人视图默认；右上角切工程视图）。 */
export function MindPage(): JSX.Element {
  const [view, setView] = useState<'person' | 'eng'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'eng' ? 'eng' : 'person' } catch { return 'person' }
  })
  const status = usePoll(fetchStatus, 5000)
  const feed = usePoll(fetchFeed, 15000)
  const refreshAll = useRef(() => {
    status.refresh()
    feed.refresh()
  })
  useEffect(() => {
    refreshAll.current = () => {
      status.refresh()
      feed.refresh()
    }
  })
  const topRef = useRef<HTMLDivElement>(null)
  if (view === 'eng') {
    return (
      <div ref={topRef} style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <ViewToggle view={view} onToggle={() => { setView('person'); try { localStorage.setItem(VIEW_KEY, 'person') } catch { /* 隐私模式忽略 */ } }} />
        </div>
        <EngView status={status.data} refresh={() => refreshAll.current()} />
      </div>
    )
  }
  const st = status.data
  return (
    <div ref={topRef} style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <PresenceOrb status={st} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>分身</div>
          <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary, #bbb)' }}>
            {st !== undefined ? presenceLine(st) : 'TA 在…'}
          </div>
        </div>
        <ViewToggle view={view} onToggle={() => { setView('eng'); try { localStorage.setItem(VIEW_KEY, 'eng') } catch { /* 隐私模式忽略 */ } }} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #888)' }}>
        {greeting(new Date())}。TA 是住在这台 dsh 里的心智——下面的流水是 TA 自己的生活。
      </div>
      <Composer status={st} refresh={() => refreshAll.current()} />
      <LifeStream feed={feed.data} />
      <CareDrawer status={st} refresh={() => refreshAll.current()} />
    </div>
  )
}

function ViewToggle({ view, onToggle }: { view: 'person' | 'eng'; onToggle(): void }): JSX.Element {
  return (
    <button type="button" onClick={onToggle}
      style={{ padding: '3px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, #444)', background: 'transparent', color: 'var(--dsw-alias-label-secondary, #aaa)' }}>
      {view === 'person' ? '工程视图' : '回到 TA'}
    </button>
  )
}
