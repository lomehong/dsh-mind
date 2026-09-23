/**
 * 「TA 的一生」语义缩放时间轴（P4 只读投影 v2，主人拍板的时间轴形态）：
 * - 滚轮缩放（以鼠标为锚）、拖拽平移、点击节点下钻/看详情
 * - 粒度随视口跨度语义化：年 → 月 → 周 → 日 → 时
 * - 有效活动为节点（act/share/learn/recall/goals 唤醒、你说的话、任务、中断）；
 *   空醒心跳不作为节点，仅作底部背景密度
 * - 粗层节点显示聚合计数，点击下钻；细层单节点点击拉取该时间段叙事明细
 * - 友好交互：范围/粒度徽标、复位按钮、hover 高亮、加载与空态、边界钳制
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchRange, fetchTimelineMeta, type TimelineMetaStep } from './api.ts'
import { coalesceRests, narrateStep, type NarratedStep } from '../narrate.ts'
import { bucketStart, levelForSpan, nextBucketStart, ticksForRange, DENSE_BUCKET, type ScaleLevel } from '../lifetimeline-scale.ts'

const SUB = 'var(--dsw-alias-label-secondary, #888)'
const BORDER = 'var(--dsw-alias-border-l1, rgba(128,128,128,.22))'
const OK = 'var(--dsw-alias-state-success-primary, #2A9D8F)'
const ERR = 'var(--dsw-alias-state-error-primary, #c0392b)'
const BRAND = 'var(--dsw-alias-brand-primary, #4a6fa5)'
const WARN = 'var(--dsw-alias-state-warn-primary, #b8860b)'

const MIN_SPAN = 2 * 3_600_000 // 最细：2 小时视口
const HEIGHT = 190
const AXIS_Y = 132

const LEVEL_LABEL: Record<ScaleLevel, string> = { year: '年', month: '月', week: '周', day: '日', hour: '时' }

function nodeColor(type: string, fn?: string): string {
  if (type === 'error') return ERR
  if (type === 'message_in') return 'var(--dsw-alias-label-primary, #eee)'
  if (type === 'task') return WARN
  switch (fn) {
    case 'act': return OK
    case 'share': return OK
    case 'learn': case 'recall': return BRAND
    case 'goals': return WARN
    default: return BRAND
  }
}

/** 有效节点（idle 心跳不算活动；idle 仅计入背景密度）。 */
function isEffective(type: string): boolean {
  return type !== 'idle'
}

interface Bucket {
  start: number
  end: number
  total: number
  idle: number
  items: TimelineMetaStep[]
  color: string
}

export function LifeTimeline(): JSX.Element {
  const [meta, setMeta] = useState<TimelineMetaStep[]>()
  const [error, setError] = useState<string>()
  const [view, setView] = useState<{ start: number; end: number }>()
  const [width, setWidth] = useState(900)
  const [detail, setDetail] = useState<{ loading: boolean; rows?: NarratedStep[] }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; start: number; end: number } | undefined>(undefined)

  // 首次装载：全量元数据
  useEffect(() => {
    fetchTimelineMeta()
      .then(d => {
        setMeta(d)
        if (d.length > 0) {
          const first = Date.parse(d[d.length - 1]!.ts)
          const last = Date.parse(d[0]!.ts)
          const pad = Math.max(2 * 3_600_000, (last - first) * 0.03)
          setView({ start: first - pad, end: Math.min(last + pad, Date.now() + 3_600_000) })
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  // 容器宽度（简单响应：挂载与窗口缩放时测量）
  const measureRef = (el: HTMLDivElement | null): void => {
    containerRef.current = el
    if (el !== null && el.clientWidth > 0) setWidth(prev => (Math.abs(prev - el.clientWidth) > 2 ? el.clientWidth : prev))
  }
  useEffect(() => {
    const onResize = (): void => {
      const el = containerRef.current
      if (el !== null && el.clientWidth > 0) setWidth(prev => (Math.abs(prev - el.clientWidth) > 2 ? el.clientWidth : prev))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (error !== undefined) {
    return <div style={{ color: ERR, fontSize: 12.5, padding: '8px 0' }}>时间轴读取失败：{error}</div>
  }
  if (meta === undefined) {
    return <div style={{ color: SUB, fontSize: 12.5, padding: '8px 0' }}>翻开 TA 的一生…</div>
  }
  if (meta.length === 0) {
    return <div style={{ color: SUB, fontSize: 12.5, padding: '8px 0' }}>TA 还没醒过。</div>
  }

  const firstTs = Date.parse(meta[meta.length - 1]!.ts)
  const dataEnd = Date.parse(meta[0]!.ts)
  const fit = (): void => {
    const pad = Math.max(2 * 3_600_000, (dataEnd - firstTs) * 0.03)
    setView({ start: firstTs - pad, end: Math.min(dataEnd + pad, Date.now() + 3_600_000) })
    setDetail(undefined)
  }
  const v = view ?? { start: firstTs, end: Math.min(dataEnd, Date.now()) }
  const span = Math.max(1, v.end - v.start)
  const level = levelForSpan(span)
  const msToX = (t: number): number => ((t - v.start) / span) * width
  const xToMs = (x: number): number => v.start + (x / width) * span

  // 桶聚合（按当前粒度；含 idle 背景密度）
  const buckets = new Map<number, Bucket>()
  for (const s of meta) {
    const t = Date.parse(s.ts)
    if (t < v.start || t > v.end) continue
    const start = bucketStart(level, t)
    let b = buckets.get(start)
    if (b === undefined) {
      b = { start, end: nextBucketStart(level, start), total: 0, idle: 0, items: [], color: SUB }
      buckets.set(start, b)
    }
    if (s.type === 'idle') { b.idle += 1; continue }
    b.total += 1
    b.items.push(s)
    b.color = nodeColor(s.type, s.fn)
  }
  const bucketList = [...buckets.values()].sort((a, b) => a.start - b.start)
  const maxIdle = Math.max(1, ...bucketList.map(b => b.idle))
  const ticks = ticksForRange(level, v.start, v.end)

  const onWheel = (e: React.WheelEvent): void => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const anchor = xToMs(e.clientX - rect.left)
    const factor = e.deltaY > 0 ? 1.25 : 0.8
    let next = span * factor
    const dataSpan = Math.max(MIN_SPAN, dataEnd - firstTs)
    next = Math.max(MIN_SPAN, Math.min(dataSpan * 1.15, next))
    const ratio = (anchor - v.start) / span
    const start = anchor - next * ratio
    setView({ start, end: start + next })
    setDetail(undefined)
  }
  const onDragStart = (e: React.MouseEvent): void => {
    dragRef.current = { x: e.clientX, start: v.start, end: v.end }
    const move = (ev: MouseEvent): void => {
      const d = dragRef.current
      if (d === undefined) return
      const dx = ev.clientX - d.x
      const shift = -(dx / width) * (d.end - d.start)
      setView({ start: d.start + shift, end: d.end + shift })
    }
    const up = (): void => {
      dragRef.current = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  const onNodeClick = (b: Bucket): void => {
    if (b.total > DENSE_BUCKET || level !== 'hour') {
      // 下钻：视口推进到该桶
      const pad = Math.max(3_600_000, (b.end - b.start) * 0.05)
      setView({ start: b.start - pad, end: b.end + pad })
      setDetail(undefined)
      return
    }
    // 细层：拉取该桶叙事明细
    setDetail({ loading: true })
    fetchRange(b.start, b.end)
      .then(steps => setDetail({ loading: false, rows: coalesceRests(steps.map(narrateStep)) }))
      .catch(() => setDetail({ loading: false, rows: [] }))
  }

  const fmtSpan = (): string => {
    const days = span / 86_400_000
    if (days > 365) return `${Math.round(days / 365)} 年`
    if (days > 1) return `${Math.round(days)} 天`
    if (days * 24 > 1) return `${Math.round(days * 24)} 小时`
    return `${Math.round(days * 24 * 60)} 分钟`
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10.5, padding: '1px 8px', borderRadius: 7, color: BRAND,
          background: `color-mix(in srgb, ${BRAND} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${BRAND} 38%, transparent)`,
        }}>粒度 · {LEVEL_LABEL[level]}</span>
        <span style={{ fontSize: 11, color: SUB }}>视口 {fmtSpan()} · 滚轮缩放 / 拖拽平移 / 点击节点下钻</span>
        <button
          type="button" onClick={fit}
          style={{ marginLeft: 'auto', fontSize: 11, cursor: 'pointer', border: 'none', background: 'transparent', color: SUB, textDecoration: 'underline' }}
        >复位看一生</button>
      </div>
      <div
        ref={measureRef}
        onWheel={onWheel}
        onMouseDown={onDragStart}
        style={{ width: '100%', cursor: dragRef.current !== undefined ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
      >
        <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
          {/* 轴线 */}
          <line x1={0} y1={AXIS_Y} x2={width} y2={AXIS_Y} stroke={BORDER} strokeWidth={1} />
          {/* 刻度 */}
          {ticks.map(t => {
            const x = msToX(t.t)
            return (
              <g key={`t${t.t}`}>
                <line x1={x} y1={AXIS_Y - 6} x2={x} y2={AXIS_Y + 6} stroke={BORDER} strokeWidth={1} />
                <text x={x + 4} y={AXIS_Y + 20} fontSize={10.5} fill={SUB} fontFamily='ui-monospace, monospace'>{t.label}</text>
              </g>
            )
          })}
          {/* idle 背景密度（底部灰带） */}
          {bucketList.filter(b => b.idle > 0).map(b => {
            const x = msToX(b.start)
            const w = Math.max(2, msToX(b.end) - x - 1)
            const h = Math.max(2, (b.idle / maxIdle) * 26)
            return <rect key={`i${b.start}`} x={x} y={AXIS_Y - h} width={w} height={h} rx={1.5} fill='rgba(128,128,128,.16)' />
          })}
          {/* 有效活动节点 */}
          {bucketList.filter(b => b.total > 0).map(b => {
            const cx = Math.min(width - 6, Math.max(6, msToX(b.start) + (msToX(b.end) - msToX(b.start)) / 2))
            const r = b.total === 1 ? 4 : Math.min(11, 4.5 + Math.sqrt(b.total) * 1.3)
            const y = AXIS_Y - 30
            const dense = b.total > DENSE_BUCKET || level !== 'hour'
            return (
              <g key={`n${b.start}`} style={{ cursor: 'pointer' }}
                onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as SVGGElement).querySelector('circle')?.setAttribute('stroke-width', '2.5') }}
                onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as SVGGElement).querySelector('circle')?.setAttribute('stroke-width', '1.5') }}
                onClick={() => onNodeClick(b)}
              >
                <title>{`${new Date(b.start).toLocaleString('zh-CN')} · ${b.total} 件活动${b.idle > 0 ? `（另有 ${b.idle} 次心跳）` : ''}${dense ? ' · 点击下钻' : ' · 点击看详情'}`}</title>
                <circle cx={cx} cy={y} r={r} fill={`color-mix(in srgb, ${b.color} 78%, transparent)`} stroke='var(--dsw-alias-bg-layer-1, #222)' strokeWidth={1.5} />
                {b.total > 1 && (
                  <text x={cx} y={y + 3.5} textAnchor='middle' fontSize={9} fill='#fff' fontWeight={600}>{b.total > 99 ? '99+' : b.total}</text>
                )}
                <text x={cx} y={y - r - 5} textAnchor='middle' fontSize={9.5} fill={SUB}>{b.color === ERR ? '!' : ''}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* 节点详情（细层） */}
      {detail !== undefined && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 10, maxHeight: 260, overflowY: 'auto',
          border: `1px solid ${BORDER}`, background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))',
        }}>
          {detail.loading && <div style={{ color: SUB, fontSize: 12.5 }}>载入该时段…</div>}
          {!detail.loading && (detail.rows === undefined || detail.rows.length === 0) && <div style={{ color: SUB, fontSize: 12.5 }}>该时段没有记录。</div>}
          {detail.rows?.map(n => (
            <div key={n.seq} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'baseline', padding: '3px 0' }}>
              <span style={{ color: SUB, fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>{fmtClock(n.ts)}</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.title}{n.body !== undefined && n.body !== '' ? `：${n.body.slice(0, 80)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
