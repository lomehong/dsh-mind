/**
 * 工程视图：面向主人做 SRE 时的运行时面板（人视图之外的显式切换层）。
 * 设计语言：指标卡（标签/数值/注脚三层）+ 状态色语义 + 类型徽标时间线，
 * 全部走主题 token（含回退色），与人视图同一套圆角/间距节奏。
 */
import { useEffect, useState } from 'react'
import { fmtUsd } from './format.tsx'
import { PromptsEditor } from './PromptsEditor.tsx'
import { GoalsCard } from './GoalsCard.tsx'
import { MissionsCard } from './MissionsCard.tsx'
import { fetchFeed, setMindStopped, type FeedStep, type StatusPayload } from './api.ts'

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

const TRIGGER_LABEL: Record<string, string> = { spontaneous: '自发', reactive: '响应', event: '事件', watchdog: '看门狗' }

/** ISO → 「2026/9/28 09:37:28」完整时间；解析失败原样显示。 */
function fmtFullTime(ts: string): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString('zh-CN', { hour12: false })
}

/** 相对时间：「刚刚 / N 分钟前 / N 小时前 / N 天前」；不可解析返回空串。 */
function fmtRelative(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const min = Math.floor(ms / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  return `${Math.floor(hr / 24)} 天前`
}

/** 模态内的方形小按钮（步进导航 / 关闭）。 */
function NavBtn({ disabled, onClick, title, children }: { disabled?: boolean; onClick?(): void; title: string; children: React.ReactNode }): JSX.Element {
  return (
    <button
      type="button" disabled={disabled === true} onClick={onClick} title={title}
      style={{
        cursor: disabled === true ? 'default' : 'pointer', border: `1px solid ${BORDER}`, borderRadius: 7,
        background: 'transparent', color: 'var(--dsw-alias-label-primary, inherit)',
        fontSize: 14, lineHeight: 1, padding: '3px 9px', opacity: disabled === true ? 0.35 : 1,
      }}
    >{children}</button>
  )
}

/**
 * 时间线步骤详情模态（圆角浮层）：Esc / 点遮罩 / × 关闭，←→ 在相邻步骤间切换。
 * 正文先显示 status tail 里的预览（服务端截断 160 字），打开后按 seq
 * 从 /dsh-mind/timeline 拉全量记录替换，并补齐 wake 步骤的
 * 触发源 / 退避档位 / 用量 / FINAL 交接棒 / refs。拉取失败停留在预览。
 */
function StepDetailModal({ step, onPrev, onNext, onClose }: {
  step: StatusPayload['tail'][number]
  /** 切到更早 / 更晚的相邻步骤（宿主无相邻时缺省，按钮置灰） */
  onPrev?: () => void
  onNext?: () => void
  onClose(): void
}): JSX.Element {
  const [full, setFull] = useState<FeedStep>()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    setFull(undefined)
    let cancelled = false
    void fetchFeed(200)
      .then(steps => { if (!cancelled) setFull(steps.find(s => s.seq === step.seq)) })
      .catch(() => { /* 全量拉取失败：停留在预览内容 */ })
    return () => { cancelled = true }
  }, [step.seq])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev !== undefined) onPrev()
      if (e.key === 'ArrowRight' && onNext !== undefined) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [onClose, onPrev, onNext])
  const content = full !== undefined && full.content !== '' ? full.content : step.content
  const copy = (): void => {
    void navigator.clipboard?.writeText(content)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) })
      .catch(() => { /* 剪贴板不可用：静默 */ })
  }
  const usage = full?.usage
  const trigger = full?.trigger !== undefined ? (TRIGGER_LABEL[full.trigger] ?? full.trigger) : undefined
  const isErr = step.type === 'error'
  const rel = fmtRelative(step.ts)
  const metaPills: JSX.Element[] = []
  if (step.source !== '') metaPills.push(<Chip key="src" text={`来源 · ${step.source}`} color={SUB} />)
  if (trigger !== undefined) metaPills.push(<Chip key="trg" text={`触发 · ${trigger}`} color={BRAND} />)
  if (full?.backoffLevel !== undefined) metaPills.push(<Chip key="bkg" text={`退避 L${full.backoffLevel}`} color={WARN} />)
  if (full?.resolves !== undefined) metaPills.push(<Chip key="rsv" text={`解决 · #${full.resolves}`} color={OK} />)
  if (usage !== undefined) metaPills.push(<Chip key="usg" text={`↑${usage.tokensIn} ↓${usage.tokensOut} tok · ${fmtUsd(usage.costUsd)}`} color={OK} />)
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, padding: 24,
        background: 'color-mix(in srgb, var(--dsw-alias-bg-base, #000) 55%, transparent)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'mindOverlayIn .16s ease-out',
      }}
    >
      <style>{'@keyframes mindOverlayIn{from{opacity:0}to{opacity:1}}@keyframes mindPanelIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}'}</style>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          background: 'var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #222))',
          border: `1px solid var(--dsw-alias-border-l2, ${BORDER})`, borderRadius: 16,
          width: 'min(720px, 100%)', maxHeight: '76vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,.4)',
          animation: 'mindPanelIn .2s ease-out',
        }}
      >
        {/* 头部第一行：类型徽标 + seq + 步进导航 + 关闭 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 0', flex: '0 0 auto' }}>
          {typeChip(step.type, step.fn)}
          <span style={{ color: SUB, fontSize: 11.5, fontFamily: 'ui-monospace, monospace' }}>#{step.seq}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <NavBtn disabled={onPrev === undefined} onClick={onPrev} title="更早一步（←）">‹</NavBtn>
            <NavBtn disabled={onNext === undefined} onClick={onNext} title="更晚一步（→）">›</NavBtn>
            <NavBtn onClick={onClose} title="关闭（Esc）">×</NavBtn>
          </div>
        </div>
        {/* 头部第二行：完整时间 + 相对时间 */}
        <div style={{ padding: '3px 16px 0', fontSize: 11.5, color: SUB, flex: '0 0 auto' }}>
          {fmtFullTime(step.ts)}{rel !== '' ? ` · ${rel}` : ''}
        </div>
        {/* 滚动正文区 */}
        <div style={{ padding: '12px 16px 14px', overflow: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {metaPills.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{metaPills}</div>}
          <div style={{
            border: `1px solid ${BORDER}`, borderLeft: `3px solid ${isErr ? ERR : BORDER}`, borderRadius: 10,
            background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))', padding: '10px 12px',
            fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            color: 'var(--dsw-alias-label-primary, inherit)',
          }}>
            {content}
          </div>
          {full === undefined && <div style={{ fontSize: 11, color: SUB }}>正在获取全文…</div>}
          {full?.final !== undefined && full.final !== '' && (
            <div style={{
              border: `1px solid ${BORDER}`, borderLeft: `3px solid ${BRAND}`, borderRadius: 10,
              background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))', padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 4, letterSpacing: '.04em' }}>FINAL 交接棒</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{full.final}</div>
            </div>
          )}
          {full?.refs !== undefined && Object.keys(full.refs).length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 4, letterSpacing: '.04em' }}>引用</div>
              {Object.entries(full.refs).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.8 }}>
                  <span style={{ color: BRAND, fontFamily: 'ui-monospace, monospace', flex: '0 0 auto' }}>{k}</span>
                  <span style={{ color: SUB, wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 底栏：快捷键提示 + 复制全文 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: `1px solid ${BORDER}`, flex: '0 0 auto' }}>
          <span style={{ fontSize: 11, color: SUB }}>Esc 关闭 · ← → 切换步骤</span>
          <button
            type="button" onClick={copy}
            style={{
              marginLeft: 'auto', cursor: 'pointer', borderRadius: 8, fontSize: 12,
              padding: '4px 12px', background: 'transparent',
              border: `1px solid color-mix(in srgb, ${copied ? OK : BRAND} 45%, transparent)`,
              color: copied ? OK : BRAND,
            }}
          >{copied ? '✓ 已复制' : '复制全文'}</button>
        </div>
      </div>
    </div>
  )
}

export function EngView({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element {
  // 选中的时间线步骤（详情模态）；hooks 须在早退返回之前调用
  const [selected, setSelected] = useState<StatusPayload['tail'][number] | null>(null)
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
  // 模态步进导航：tail 为旧→新，「更早」是索引-1，「更晚」是索引+1
  const selIdx = selected !== null ? status.tail.findIndex(s => s.seq === selected.seq) : -1
  const older = selIdx > 0 ? status.tail[selIdx - 1] : undefined
  const newer = selIdx !== -1 && selIdx < status.tail.length - 1 ? status.tail[selIdx + 1] : undefined

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
        <Stat label="今日花费" value={fmtUsd(spend.usedUsd)} sub={`/ 硬顶 ${fmtUsd(spend.hardCapUsd)}${capped ? ' · 触顶停自发' : soft ? ' · 过软顶：自驱降频' : ''}`} accent={spendAccent} />
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
          {(status.openAsks ?? 0) > 0 && <span style={{ color: WARN }}>等你给 {status.openAsks}{status.openAskPreview !== undefined ? `：${status.openAskPreview}` : ''}</span>}
          <span>软顶 {fmtUsd(spend.softCapUsd)} · 硬顶 {fmtUsd(spend.hardCapUsd)}</span>
        </div>
      </Card>

      {/* 活跃目标（P4 goals 精化） */}
      <GoalsCard />

      {/* 主人长期事项（议程面：分身安静时推进的事） */}
      <Card style={{ padding: '10px 14px 14px' }}>
        <MissionsCard />
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
                  onClick={() => setSelected(step)}
                  title="点击查看完整信息"
                  style={{
                    display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 6px', borderRadius: 7,
                    borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${BORDER}`,
                    cursor: 'pointer',
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

      {/* 步骤详情模态 */}
      {selected !== null && (
        <StepDetailModal
          step={selected}
          onPrev={older !== undefined ? () => setSelected(older) : undefined}
          onNext={newer !== undefined ? () => setSelected(newer) : undefined}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
