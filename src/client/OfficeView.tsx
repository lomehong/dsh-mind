/**
 * 办公室视图（P3 v2）：心智页内嵌第三视图（与工程视图同级，不覆盖整窗）。
 * 2D 扁平房间插画——放弃 CSS 伪 3D（rotateX/rotateZ 会把子元素压扁、标签横转）。
 * 数据：fetchTimelineMeta（时间线尾部）+ fetchStatus（实时态）；渲染层零状态。
 */
import { useEffect, useRef, useState } from 'react'
import { fetchStatus, fetchTimelineMeta, usePoll, type StatusPayload, type TimelineMetaStep } from './api.ts'
import { fmtUsd } from './format.tsx'

interface DayStep { ts: string; kind: string; fn: string; title: string }

const SUB = 'var(--dsw-alias-label-secondary, #999)'

/** 步骤 → 房间点位（2D 布局，百分比坐标）。 */
const SPOTS: Record<string, { x: number; y: number }> = {
  desk: { x: 46, y: 62 },
  book: { x: 78, y: 34 },
  goal: { x: 66, y: 22 },
  coffee: { x: 16, y: 66 },
  rest: { x: 30, y: 80 },
  door: { x: 6, y: 70 },
  window: { x: 24, y: 30 },
}

function spotFor(kind: string, fn: string): string {
  if (kind === 'message_in') return 'door'
  if (kind === 'rest' || kind === 'idle') return 'coffee'
  const f = (fn ?? '').toLowerCase()
  if (f === 'learn') return 'book'
  if (f === 'goals') return 'goal'
  if (f === 'ask') return 'goal'
  if (f === 'share' || f === 'message_out') return 'window'
  return 'desk'
}

function titleOf(kind: string, fn: string): string {
  if (kind === 'message_in') return '收到你的话'
  if (kind === 'idle') return '歇了一会儿'
  if (kind === 'error') return '唤醒失败（自愈/待查）'
  const f = (fn ?? '').toLowerCase()
  if (f === 'learn') return '查了些资料'
  if (f === 'act') return '干了一件活'
  if (f === 'think') return '想了件事'
  if (f === 'share') return '投递了产出'
  if (f === 'goals') return '理了目标'
  if (f === 'ask') return '有事等你给'
  if (f === 'recall') return '翻了下记忆'
  return fn !== '' ? `唤醒（${fn}）` : '醒来'
}

function hhmm(ts: string): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 天色：按小时渐变（平面背景，无 3D）。 */
function sky(h: number): string {
  if (h >= 6 && h < 8) return 'linear-gradient(180deg,#33415c 0%,#232a33 55%)'
  if (h >= 8 && h < 17) return 'linear-gradient(180deg,#3d5270 0%,#1d232c 60%)'
  if (h >= 17 && h < 20) return 'linear-gradient(180deg,#4a3a52 0%,#1d2129 55%)'
  return 'linear-gradient(180deg,#182030 0%,#12161d 60%)'
}

export function OfficeView({ onBack }: { onBack(): void }): JSX.Element {
  const [steps, setSteps] = useState<DayStep[]>([])
  const [idx, setIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1400)
  const [live, setLive] = useState(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const status = usePoll(fetchStatus, 30000)
  const st = status.data

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const meta: TimelineMetaStep[] = await fetchTimelineMeta()
        const horizon = Date.now() - 1000 * 60 * 60 * 36
        const rows = meta
          .filter(m => { const t = Date.parse(m.ts); return Number.isFinite(t) && t >= horizon })
          .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
          .map(m => ({ ts: m.ts, kind: m.type, fn: m.fn ?? '', title: titleOf(m.type, m.fn ?? '') }))
        if (alive) setSteps(rows)
      } catch { /* 静默：空态兜底 */ }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!playing) {
      if (timer.current !== null) { clearInterval(timer.current); timer.current = null }
      return
    }
    timer.current = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % Math.max(1, steps.length)
        if (next === 0) setPlaying(false)
        return next
      })
    }, speed)
    return () => { if (timer.current !== null) { clearInterval(timer.current); timer.current = null } }
  }, [playing, speed, steps.length])

  const cur = idx >= 0 ? steps[idx] : undefined
  const liveSpot = st?.quiet?.active === true ? 'rest' : st?.running === true ? 'desk' : 'coffee'
  const shown = live ? liveSpot : cur !== undefined ? spotFor(cur.kind, cur.fn) : 'desk'
  const pos = SPOTS[shown] ?? SPOTS.desk
  const hour = live ? new Date().getHours() : cur !== undefined ? new Date(cur.ts).getHours() : new Date().getHours()

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '10px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>🏢 分身的一天 · 办公室</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: SUB }}>
          {st?.spend !== undefined && <span>今日心思 {fmtUsd(st.spend.usedUsd)} / {fmtUsd(st.spend.hardCapUsd)}</span>}
          <button
            type="button" onClick={onBack}
            style={{
              padding: '4px 14px', cursor: 'pointer', borderRadius: 8, fontSize: 12.5,
              border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))',
              background: 'transparent', color: 'var(--dsw-alias-label-secondary, #bbb)',
            }}
          >
            ← 回到分身
          </button>
        </div>
      </div>

      {/* 房间画布（2D 扁平，不覆盖整窗——容器自适应页面宽度） */}
      <div
        style={{
          position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden',
          background: sky(hour), border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.22))',
        }}
      >
        {/* 窗（左上）：天空与光照 */}
        <div style={{ position: 'absolute', left: '10%', top: '12%', width: '20%', height: '30%', borderRadius: 8, background: 'linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))', border: '2px solid rgba(255,255,255,.2)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{hour >= 6 && hour < 18 ? '☀️' : '🌙'}</div>
        </div>
        {/* 白板（右上） */}
        <div style={{ position: 'absolute', left: '58%', top: '12%', width: '18%', height: '22%', borderRadius: 6, background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.18)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🎯</div>
          <div style={{ position: 'absolute', bottom: -22, width: '100%', textAlign: 'center', fontSize: 11, color: SUB }}>白板 · goals/ask</div>
        </div>
        {/* 书架（右侧） */}
        <div style={{ position: 'absolute', right: '6%', top: '34%', width: '13%', height: '30%', borderRadius: 6, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📚</div>
          <div style={{ position: 'absolute', bottom: -22, width: '100%', textAlign: 'center', fontSize: 11, color: SUB }}>书架 · learn</div>
        </div>
        {/* 工位（中央） */}
        <div style={{ position: 'absolute', left: '40%', top: '50%', width: '22%', height: '26%', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 30 }}>
            <span>🖥️</span><span>🪑</span>
          </div>
          <div style={{ position: 'absolute', bottom: -22, width: '100%', textAlign: 'center', fontSize: 11, color: SUB }}>工位 · act/think/wake</div>
        </div>
        {/* 咖啡角（左下） */}
        <div style={{ position: 'absolute', left: '9%', top: '58%', width: '14%', height: '22%', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>☕</div>
          <div style={{ position: 'absolute', bottom: -22, width: '100%', textAlign: 'center', fontSize: 11, color: SUB }}>咖啡角 · idle</div>
        </div>
        {/* 休息角（中下） */}
        <div style={{ position: 'absolute', left: '26%', top: '76%', width: '15%', height: '16%', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🛏️</div>
          <div style={{ position: 'absolute', bottom: -20, width: '100%', textAlign: 'center', fontSize: 11, color: SUB }}>休息角 · 静音</div>
        </div>
        {/* 门（最左） */}
        <div style={{ position: 'absolute', left: '2%', top: '56%', width: '7%', height: '30%', borderRadius: '6px 6px 0 0', background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.16)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚪</div>
          <div style={{ position: 'absolute', bottom: -20, width: '100%', textAlign: 'center', fontSize: 11, color: SUB }}>门口</div>
        </div>

        {/* 地面基线（房间地平线） */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '88%', height: 1, background: 'rgba(255,255,255,.1)' }} />

        {/* 分身（发光球体，2D 平面内移动） */}
        <div style={{
          position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, rgba(79,179,169,1), rgb(79,179,169) 52%, rgba(79,179,169,.55) 100%)',
          boxShadow: '0 0 24px rgba(79,179,169,.55)',
          transition: 'left 1s cubic-bezier(.4,0,.2,1), top 1s cubic-bezier(.4,0,.2,1)',
          zIndex: 5,
        }}>
          <div style={{ position: 'absolute', left: 13, top: 9, width: 17, height: 23, background: 'rgba(8,12,18,.72)', borderRadius: '50% 50% 42% 42%' }} />
        </div>

        {/* 气泡（回放时跟随） */}
        {!live && cur !== undefined && (
          <div style={{
            position: 'absolute', left: `${pos.x}%`, top: `calc(${pos.y}% - 76px)`, transform: 'translateX(-50%)',
            maxWidth: 300, padding: '8px 12px', borderRadius: 12, zIndex: 6,
            background: 'var(--dsw-alias-bg-overlay, rgba(20,24,30,.95))',
            border: '1px solid rgba(255,255,255,.18)', fontSize: 12.5,
          }}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 2 }}>{hhmm(cur.ts)} · {cur.title}</div>
            <div style={{ lineHeight: 1.5 }}>{cur.body ?? ''}</div>
          </div>
        )}
        {/* 实时态徽标 */}
        {live && (
          <div style={{ position: 'absolute', left: `${pos.x}%`, top: `calc(${pos.y}% - 56px)`, transform: 'translateX(-50%)', padding: '2px 10px', borderRadius: 999, background: 'rgba(20,24,30,.9)', border: '1px solid rgba(255,255,255,.16)', fontSize: 11.5, color: SUB, whiteSpace: 'nowrap' }}>
            {st?.quiet?.active === true ? '🌙 静音时段 · 睡着' : st?.running === true ? '💭 正在想/干' : '🌤 醒着待命'}
          </div>
        )}
        {steps.length === 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: '46%', textAlign: 'center', fontSize: 13, color: SUB }}>
            36 小时内没有时间线步骤——分身还没醒过。
          </div>
        )}
      </div>

      {/* 控制条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
        <button
          type="button"
          onClick={() => { setLive(false); setPlaying(p => { if (idx < 0 && steps.length > 0) setIdx(0); return !p }) }}
          style={{
            padding: '5px 14px', cursor: 'pointer', borderRadius: 8,
            border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))',
            background: 'transparent', color: 'var(--dsw-alias-label-primary, #eee)',
          }}
        >
          {playing ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <select
          value={String(speed)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSpeed(Number(e.target.value)) }}
          style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))', background: 'transparent', color: 'var(--dsw-alias-label-primary, #eee)', fontSize: 12 }}
        >
          <option value="2600">1×</option>
          <option value="1400">2×</option>
          <option value="700">4×</option>
        </select>
        <input
          type="range" min={0} max={Math.max(0, steps.length - 1)} value={Math.max(0, idx)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setLive(false); setPlaying(false); setIdx(Number(e.target.value)) }}
          style={{ flex: 1, minWidth: 200, accentColor: '#4fc2b1' }}
        />
        <button
          type="button"
          onClick={() => { setPlaying(false); setLive(true); setIdx(-1) }}
          style={{
            padding: '5px 14px', cursor: 'pointer', borderRadius: 8,
            border: `1px solid ${live ? 'rgba(79,179,169,.6)' : 'var(--dsw-alias-border-l1, rgba(128,128,128,.3))'}`,
            background: 'transparent', color: live ? 'rgb(79,179,169)' : 'var(--dsw-alias-label-secondary, #bbb)',
          }}
        >
          ● 实时
        </button>
        <span style={{ color: SUB, fontSize: 12 }}>{live ? '实时' : cur !== undefined ? `第 ${idx + 1} / ${steps.length} 步` : ''}</span>
      </div>
      <div style={{ fontSize: 12.5, color: SUB, padding: '8px 12px', borderLeft: '3px solid rgb(79,179,169)', background: 'rgba(255,255,255,.04)', borderRadius: 8, minHeight: 20 }}>
        {live
          ? (st?.quiet?.active === true ? '静音时段——TA 在休息角睡着，醒来会接着排。' : st?.running === true ? 'TA 正在工位上想/干活。' : 'TA 醒着，在咖啡角待命。')
          : cur !== undefined ? `${hhmm(cur.ts)} · ${cur.title}` : '按「播放」回放分身的一天；或切「实时」跟随此刻状态。'}
      </div>
    </div>
  )
}
