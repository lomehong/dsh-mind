/**
 * 分身的手机（P2）：右键存在体打开的随身面板——
 * 请求单（逐条答复，answerMindAsk）/ 看板速览（/dsh-task-board/state）/ 生活速翻（时间线尾部）。
 * 数据全部来自既有服务面，零新状态；关闭即消失。
 */
import { useState, useEffect, useCallback } from 'react'
import { answerMindAsk, fetchAsks, fetchFeed, type MindAsk } from './api.ts'
import { coalesceRests, narrateStep } from '../narrate.ts'
import { fmtClock } from './format.tsx'

type Tab = 'asks' | 'board' | 'life'

const SUB = 'var(--dsw-alias-label-secondary, #999)'
const WARN = 'var(--dsw-alias-state-warn-primary, #b8860b)'

interface BoardTask { id?: string; title?: string; column?: string }
interface BoardState { ok?: boolean; state?: { tasks?: Array<BoardTask & { archived?: boolean }> } }

const s = {
  phone: {
    width: 264, maxHeight: 460, display: 'flex', flexDirection: 'column',
    padding: '12px 12px 8px', borderRadius: 22,
    background: 'var(--dsw-alias-bg-overlay, rgba(24,26,30,.97))',
    border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))',
    boxShadow: '0 10px 34px rgba(0,0,0,.4)', color: 'var(--dsw-alias-label-primary, #eee)',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 13, fontWeight: 600 },
  close: { border: 'none', background: 'transparent', color: SUB, fontSize: 14, cursor: 'pointer', padding: '0 2px' },
  tabs: { display: 'flex', gap: 4, marginBottom: 8 },
  tab: (on: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 11.5, cursor: 'pointer', borderRadius: 8,
    border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.22))',
    background: on ? 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.14))' : 'transparent',
    color: on ? 'var(--dsw-alias-label-primary, #eee)' : SUB,
  }),
  body: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 },
  row: { padding: '7px 8px', borderRadius: 10, border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.18))', fontSize: 12 },
  what: { fontWeight: 500, lineHeight: 1.45 },
  meta: { fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #888)', marginTop: 2 },
  input: {
    width: '100%', boxSizing: 'border-box', resize: 'none', padding: '6px 8px', marginTop: 6,
    borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))',
    background: 'var(--dsw-alias-bg-layer-1, rgba(0,0,0,.25))', color: 'var(--dsw-alias-label-primary, #eee)', fontSize: 12,
  },
  btn: { padding: '4px 10px', border: 'none', borderRadius: 8, background: 'var(--dsw-alias-state-business-primary, #4a6fa5)', color: '#fff', fontSize: 11.5, cursor: 'pointer' },
  btnGhost: { padding: '4px 10px', border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))', borderRadius: 8, background: 'transparent', color: SUB, fontSize: 11.5, cursor: 'pointer' },
  col: { fontSize: 11, color: SUB, margin: '6px 0 2px', fontWeight: 600 },
  task: { fontSize: 11.5, padding: '3px 0', borderBottom: '1px dashed var(--dsw-alias-border-l1, rgba(128,128,128,.14))', lineHeight: 1.5 },
  empty: { fontSize: 12, color: SUB, padding: '10px 0' },
}


/** 请求单条目：what/why/howto 展开 + 内联答复框（答复=结清+注入心智时间线并反应性唤醒）。 */
function AskRow({ ask, onDone }: { ask: MindAsk; onDone(msg: string): void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const send = async (): Promise<void> => {
    const answer = text.trim()
    if (answer === '' || sending) return
    setSending(true)
    const r = await answerMindAsk(ask.id, answer)
    setSending(false)
    if (r.ok === true) {
      setOpen(false)
      setText('')
      onDone(`已答复「${ask.what.slice(0, 24)}${ask.what.length > 24 ? '…' : ''}」——TA 醒来即按分支执行`)
    } else {
      onDone(`答复失败：${r.error ?? '未知原因'}`)
    }
  }
  return (
    <div style={{ ...s.row, flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontWeight: 500 }}>{ask.what}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #888)', whiteSpace: 'nowrap' }}>{ask.ageHours > 0 ? `悬置 ${ask.ageHours}h` : '刚提出'}</span>
      </div>
      {(ask.why !== undefined || ask.howto !== undefined) && (
        <div style={{ fontSize: 10.5, color: 'var(--dsw-alias-label-tertiary, #888)', marginTop: 3, lineHeight: 1.5 }}>
          {ask.why !== undefined && <div>为了：{ask.why}</div>}
          {ask.howto !== undefined && <div>给了之后 TA 会：{ask.howto}</div>}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 6 }}>
          <textarea
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setText(e.target.value) }}
            placeholder="把 TA 要的东西给 TA——答复会进入 TA 的时间线并立即唤醒执行…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '6px 8px',
              borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))',
              background: 'var(--dsw-alias-bg-layer-1, rgba(0,0,0,.25))', color: 'var(--dsw-alias-label-primary, #eee)', fontSize: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button type="button" style={{ ...s.btn, opacity: sending || text.trim() === '' ? 0.6 : 1 }} disabled={sending || text.trim() === ''} onClick={() => { void send() }}>
              {sending ? '投递中…' : '发送答复'}
            </button>
            <button type="button" style={s.btnGhost} onClick={() => { setOpen(false) }}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
/** 分身的手机（P2）：请求单 / 看板速览 / 生活速翻 三页。 */
export function Phone({ onClose, onGoTodos }: { onClose(): void; onGoTodos(): void }): JSX.Element {
  const [tab, setTab] = useState<Tab>('asks')
  const [asks, setAsks] = useState<MindAsk[]>()
  const [board, setBoard] = useState<Array<{ title: string; column: string }>>()
  const [boardErr, setBoardErr] = useState(false)
  const [feed, setFeed] = useState<ReturnType<typeof coalesceRests>>()
  const [msg, setMsg] = useState('')

  const loadAsks = useCallback(async (): Promise<void> => {
    try { setAsks(await fetchAsks()) } catch { setAsks([]) }
  }, [])
  const loadBoard = useCallback(async (): Promise<void> => {
    try {
      const r = await fetch('/dsh-task-board/state')
      const b = (await r.json()) as { state?: { tasks?: Array<{ title?: string; column?: string; archived?: boolean }> } }
      const tasks = (b.state?.tasks ?? []).filter(t => t.archived !== true)
        .map(t => ({ title: t.title ?? '(未命名)', column: t.column ?? '?' }))
      setBoard(tasks)
    } catch { setBoard([]) }
  }, [])
  const loadLife = useCallback(async (): Promise<void> => {
    try {
      const feed = await fetchFeed(40)
      setFeed(coalesceRests(feed.slice(0, 14).map(narrateStep)))
    } catch { setFeed([]) }
  }, [])

  useEffect(() => {
    void loadAsks()
    void loadBoard()
    void loadLife()
  }, [loadAsks, loadBoard, loadLife])

  const done = (m: string): void => { setMsg(m); void loadAsks() }

  return (
    <div style={{ ...s.phone, marginLeft: 'auto', marginRight: 14 }} role="dialog" aria-label="分身的手机">
      <div style={s.head}>
        <span style={s.title}>📱 分身的手机</span>
        <button type="button" aria-label="收起手机" style={s.close} onClick={onClose}>×</button>
      </div>
      <div style={s.tabs}>
        {(['asks', 'board', 'life'] as const).map(t => (
          <button key={t} type="button" style={s.tab(t === tab)} onClick={() => { setTab(t) }}>
            {t === 'asks' ? '请求单' : t === 'board' ? '看板' : '生活'}
          </button>
        ))}
      </div>
      <div style={s.body}>
        {tab === 'asks' && (
          (asks ?? []).length === 0
            ? <div style={s.empty}>请求单是空的——TA 没有卡住的事。</div>
            : (asks ?? []).map(a => <AskItem key={a.id} ask={a} onDone={m => { setMsg(m); void loadAsks() }} />)
        )}
        {tab === 'board' && (
          (board ?? []).length === 0
            ? <div style={s.empty}>看板暂无进行中的任务。</div>
            : (board ?? []).map((t, i) => (
              <div key={`${t.title}-${i}`} style={s.task}>
                <span style={{ color: 'var(--dsw-alias-state-business-primary, #4a6fa5)' }}>▦</span> {t.title}
              </div>
            ))
        )}
        {tab === 'life' && (feed ?? []).map(n => (
          <div key={n.seq} style={{ display: 'flex', gap: 8, fontSize: 11.5, alignItems: 'baseline', padding: '3px 0' }}>
            <span style={{ color: SUB, whiteSpace: 'nowrap', fontSize: 10.5 }}>{fmtClock(n.ts)}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.kind === 'you' ? `你说：${n.body ?? ''}` : n.title}
            </span>
          </div>
        ))}
      </div>
      {tab === 'asks' && (asks ?? []).length > 0 && (
        <button type="button" style={{ ...s.btnGhost, alignSelf: 'flex-start' }} onClick={onGoTodos}>
          去数字分身 · 今日待办逐条处理 →
        </button>
      )}
      {msg !== '' && <div style={{ fontSize: 11, color: 'var(--dsw-alias-state-success-primary, #2A9D8F)', marginTop: 6 }}>{msg}</div>}
    </div>
  )
}

// AskItem 引用占位（Phone 主体直接渲染 asks 行；此导出供未来复用）
export { AskRow as _AskRow }
