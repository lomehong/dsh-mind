/**
 * 工程视图：面向主人做 SRE 时的运行时面板（人视图之外的显式切换层）。
 * 设计语言：指标卡（标签/数值/注脚三层）+ 状态色语义 + 类型徽标时间线，
 * 全部走主题 token（含回退色），与人视图同一套圆角/间距节奏。
 */
import { fmtUsd } from './format.tsx'
import { PromptsEditor } from './PromptsEditor.tsx'
import { setMindStopped, type StatusPayload } from './api.ts'

const SUB = 'var(--dsw-alias-label-secondary, #888)'
const BORDER = 'var(--dsw-alias-border-l1, rgba(128,128,128,.22))'
const OK = 'var(--dsw-alias-state-success-primary, #2A9D8F)'
const WARN = 'var(--dsw-alias-state-warn-primary, #b8860b)'
const ERR = 'var(--dsw-alias-state-error-primary, #c0392b)'
const BRAND = 'var(--dsw-alias-brand-primary, #4a6fa5)'

const fmtTime = (ts: number): string => (ts > 0 ? new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }): JSX.Element {
  return (
    <div style={{
      background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))',
      border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }): JSX.Element {
  return (
    <Card style={{ flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: SUB, letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: accent ?? 'var(--dsw-alias-label-primary, inherit)' }}>
        {value}
      </div>
      {sub !== undefined && <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>{sub}</div>}
    </Card>
  )
}

function Chip({ text, color }: { text: string; color: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 7, fontSize: 10.5, whiteSpace: 'nowrap',
      color, background: `color-mix(in srgb, ${color} 13%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
    }}>
      {text}
    </span>
  )
}

/** wake 步骤的函数徽标色。 */
function fnColor(fn?: string): string {
  switch (fn) {
    case 'act': return OK
    case 'share': return OK
    case 'learn': case 'recall': return BRAND
    case 'goals': return WARN
    case 'idle': return SUB
    default: return BRAND // think
  }
}

function typeChip(type: string, fn?: string): JSX.Element {
  if (type === 'wake') return <Chip text={`wake · ${fn ?? 'think'}`} color={fnColor(fn)} />
  if (type === 'message_in' || type === 'message_out') return <Chip text={type} color={OK} />
  if (type === 'error') return <Chip text="error" color={ERR} />
  if (type === 'thought') return <Chip text="thought" color={BRAND} />
  return <Chip text={type} color={SUB} />
}

export function EngView({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element {
  if (status === undefined) {
    return <div style={{ padding: 12, color: SUB, fontSize: 13 }}>读取中…</div>
  }
  const { spend } = status
  const capped = spend.usedUsd >= spend.hardCapUsd
  const soft = !capped && spend.usedUsd >= spend.softCapUsd
  const stopped = status.stoppedByMaster || !status.enabled
  const asleep = status.quiet?.active === true
  const stateText = stopped ? '已暂停' : asleep ? '静音时段' : status.running ? '思考中' : '待机'
  const stateColor = stopped ? SUB : asleep ? BRAND : status.running ? OK : BRAND
  const spendAccent = capped ? ERR : soft ? WARN : undefined
  const pct = Math.min(100, Math.round((spend.usedUsd / Math.max(spend.hardCapUsd, 0.01)) * 100))
  const nextWakeMin = status.wakeAt > Date.now() ? Math.max(1, Math.round((status.wakeAt - Date.now()) / 60000)) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
      {/* 指标卡组 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px', minWidth: 140 }}>
          <Card>
            <div style={{ fontSize: 11, color: SUB, letterSpacing: '.04em', marginBottom: 4 }}>状态</div>
            <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: stateColor,
                boxShadow: status.running ? `0 0 0 3px color-mix(in srgb, ${OK} 22%, transparent)` : undefined,
              }} />
              {stateText}
            </div>
            {status.quiet?.enabled && <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>作息 {status.quiet.start}–{status.quiet.end}</div>}
          </Card>
        </div>
        <Stat label="退避档位" value={`L${status.backoffLevel}`} sub={`自醒间隔 ≤ ${Math.round(Math.min(300000, 5000 * Math.pow(2, Math.max(0, status.backoffLevel - 1))) / 1000)}s`} />
        <Stat label="上次唤醒" value={fmtTime(status.lastWakeAt)} />
        <Stat label="下次自醒" value={stopped ? '已停' : asleep ? '静音中' : nextWakeMin > 0 ? `~${nextWakeMin} 分钟` : '随时'} />
        <Stat label="今日花费" value={fmtUsd(spend.usedUsd)} sub={`/ 硬顶 ${fmtUsd(spend.hardCapUsd)}${capped ? ' · 触顶停自发' : soft ? ' · 过软顶降快模型' : ''}`} accent={spendAccent} />
      </div>

      {/* 预算条 + 操作 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: spendAccent ?? OK, transition: 'width .4s' }} />
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: SUB, whiteSpace: 'nowrap' }}>{pct}%</span>
          <button
            type="button"
            onClick={() => { void setMindStopped(!stopped).then(refresh) }}
            style={{
              padding: '5px 16px', cursor: 'pointer', borderRadius: 9, fontSize: 12.5,
              border: `1px solid color-mix(in srgb, ${stopped ? OK : WARN} 45%, transparent)`,
              color: stopped ? OK : WARN, background: 'transparent',
            }}
          >
            {stopped ? '▶ 恢复心智' : '⏸ 暂停心智'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: SUB }}>
          <span>待处理观察 {status.pending ?? 0}</span>
          {(status.pendingApprovals ?? 0) > 0 && <span style={{ color: WARN }}>待主人批准 {status.pendingApprovals}</span>}
          <span>软顶 {fmtUsd(spend.softCapUsd)} · 硬顶 {fmtUsd(spend.hardCapUsd)}</span>
        </div>
      </Card>

      {/* 提示词调教面 */}
      <Card style={{ padding: '10px 14px 14px' }}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>提示词</span>
          <span style={{ fontSize: 11 }}>TA 每次唤醒读的行为文本——改完保存，下一拍即生效</span>
        </div>
        <PromptsEditor />
      </Card>

      {/* 时间线 */}
      <Card style={{ padding: '10px 14px 6px' }}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>时间线 · 最近</span>
          <span style={{ fontSize: 11 }}>{status.tail.length} 步</span>
        </div>
        {status.tail.length === 0
          ? <div style={{ color: SUB, padding: '8px 0 10px' }}>暂无步骤——分身尚未醒来</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {status.tail.slice().reverse().map((step, i, arr) => (
                <div
                  key={step.seq}
                  title={step.content}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 6px', borderRadius: 7,
                    borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${BORDER}`,
                  }}
                  onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08))' }}
                  onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ color: SUB, fontFamily: 'ui-monospace, monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    {new Date(step.ts).toLocaleTimeString('zh-CN', { hour12: false })}
                  </span>
                  {typeChip(step.type, step.fn)}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, flex: 1 }}>
                    {step.content}
                  </span>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  )
}
