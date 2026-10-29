/**
 * 存在体（The Being）：TA 的形态本体。
 * 一颗呼吸着、泛着微光的球体，光晕中隐现人形剪影——运行时状态全部翻译为
 * 身体语言：呼吸节奏、光的色温与明暗、内部涌动、涟漪。
 * 实现纪律：形状/颜色全部内联（不依赖注入类，防宿主级联覆盖）；
 * 注入的 <style> 只含 @keyframes；颜色用预计算 rgba（不用 color-mix，
 * 兼容旧 Chromium）。beingMood/beingGlyph/beingRhythm/beingDim 纯函数在 narrate.ts（测试覆盖）。
 *
 * v0.10.39 剧场化（P0/P1）：活动铭牌（glyph+label）、呼吸节律倍率（rhythm）、
 * 光晕明度（dim）与漂浮反馈（hearts/coffee/poke）。
 */
import { beingMood, beingGlyph, beingRhythm, beingDim, type BeingStatusInput, type BeingTheaterInput } from '../narrate.ts'

interface MoodStyle { rgb: string; breath: string; swirl: number; dim: number }

/** 情态 → 身体参数：呼吸周期 / 光色（rgb 三元组）/ 涌动强度 / 明度。 */
const MOODS: Record<BeingMood, MoodStyle> = {
  awake: { rgb: '79,179,169', breath: '6.5s', swirl: 0.12, dim: 1 },
  thinking: { rgb: '83,200,232', breath: '2.6s', swirl: 0.8, dim: 1 },
  attentive: { rgb: '232,185,83', breath: '3.4s', swirl: 0.35, dim: 1 },
  asleep: { rgb: '91,111,181', breath: '11s', swirl: 0, dim: 0.55 },
  stopped: { rgb: '138,143,152', breath: '13s', swirl: 0, dim: 0.45 },
}

let kfInjected = false
function injectKeyframes(): void {
  if (kfInjected) return
  kfInjected = true
  const el = document.createElement('style')
  el.textContent = `
@keyframes dsh-mind-breathe { from { transform: scale(.93); } to { transform: scale(1.07); } }
@keyframes dsh-mind-spin { to { transform: rotate(360deg); } }
@keyframes dsh-mind-ripple { from { transform: scale(1); opacity: .5; } to { transform: scale(2.2); opacity: 0; } }
@keyframes dsh-mind-chest { from { transform: scaleY(1); } to { transform: scaleY(1.06); } }
@keyframes dsh-mind-floatup { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, -30px); opacity: 0; } }`
  document.head.appendChild(el)
}

export interface BeingFx {
  kind: 'hearts' | 'coffee' | 'poke'
  seq: number
}

export interface BeingProps {
  /** 直径（px）。 */
  size: number
  status?: BeingStatusInput
  /** 剧场输入（P0/P1）：铭牌/节律/明度推导——直传宿主 status 即可（结构同形）。 */
  theater?: BeingTheaterInput
  /** 漂浮反馈（摸头=hearts / 喂咖啡=coffee / 戏闹=poke），seq 变化即飘一次。 */
  fx?: BeingFx
  /** 光晕中隐现人形剪影（默认开）。 */
  silhouette?: boolean
  /** 收到你的话时的涟漪（默认按 pending 自动）。 */
  ripple?: boolean
  style?: React.CSSProperties
}

/** 漂浮 emoji（key=seq：变化即重挂载重放动画）。 */
function FloatFx({ kind, seq, size }: { kind: 'hearts' | 'coffee' | 'poke'; seq: number; size: number }): JSX.Element {
  const emoji = kind === 'hearts' ? '💞' : kind === 'coffee' ? '☕' : '😵'
  return (
    <div
      key={seq}
      style={{
        position: 'absolute', top: -size * 0.18, left: '50%',
        fontSize: Math.max(14, size * 0.22), pointerEvents: 'none',
        animation: 'dsh-mind-floatup 1.6s ease-out forwards',
      }}
    >
      {emoji}
    </div>
  )
}

/** 存在体本体。 */
export function Being({ size, status, theater, fx, silhouette = true, ripple, style }: BeingProps): JSX.Element {
  injectKeyframes()
  const input = theater ?? status
  const mood = beingMood(status)
  const m = MOODS[mood]
  const showRipple = ripple ?? mood === 'attentive'
  const g = beingGlyph(input)
  const rhythm = beingRhythm(input)
  const dimScale = beingDim(input)
  const breathSec = Math.round(parseFloat(m.breath) * rhythm * 10) / 10
  const breath = `dsh-mind-breathe ${breathSec}s ease-in-out infinite alternate`
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', animation: breath, ...style }}>
      {/* 光晕 */}
      <div style={{
        position: 'absolute', left: -size * 0.3, top: -size * 0.3, width: size * 1.6, height: size * 1.6,
        borderRadius: '50%', pointerEvents: 'none', opacity: m.dim * dimScale, animation: breath,
        background: `radial-gradient(circle, rgba(${m.rgb},.42) 0%, rgba(${m.rgb},0) 68%)`,
        filter: `blur(${Math.max(5, Math.round(size * 0.09))}px)`,
      }} />
      {/* 本体 */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', opacity: m.dim * dimScale,
        background: `radial-gradient(circle at 35% 30%, rgba(${m.rgb},1) 0%, rgb(${m.rgb}) 52%, rgba(${m.rgb},.55) 100%)`,
        boxShadow: `0 0 ${Math.round(size * 0.34)}px rgba(${m.rgb},.5), inset 0 0 ${Math.round(size * 0.22)}px rgba(255,255,255,.18)`,
      }}>
        {silhouette && (
          <svg
            style={{ position: 'absolute', left: '17%', top: '15%', width: '66%', height: '73%', opacity: 0.52 }}
            viewBox="0 0 100 100" aria-hidden
          >
            <g fill="rgba(8,12,18,.7)">
              <circle cx="50" cy="29" r="11.5" />
              <g style={{ animation: `dsh-mind-chest ${m.breath} ease-in-out infinite alternate`, transformOrigin: '50% 100%' }}>
                <path d="M50 44 C37 44 28.5 55 26.5 68 C40 75 60 75 73.5 68 C71.5 55 63 44 50 44 Z" />
              </g>
              <path d="M23 73 C38 65.5 62 65.5 77 73 C67.5 82 32.5 82 23 73 Z" />
            </g>
          </svg>
        )}
        {m.swirl > 0 && (
          <div style={{
            position: 'absolute', left: '10%', top: '10%', width: '80%', height: '80%', borderRadius: '50%',
            opacity: m.swirl, background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,.4) 18%, transparent 42%)',
            animation: 'dsh-mind-spin 3s linear infinite',
          }} />
        )}
      </div>
      {/* 活动铭牌（P0 剧场）：此刻在做什么 */}
      {g.label !== '' && (
        <div
          role="status"
          style={{
            position: 'absolute', left: '50%', bottom: -size * 0.14, transform: 'translateX(-50%)',
            whiteSpace: 'nowrap', fontSize: Math.max(11, size * 0.1), lineHeight: 1.5,
            padding: '1px 8px', borderRadius: 999,
            background: 'var(--dsw-alias-bg-overlay, rgba(24,26,30,.92))',
            border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))',
            color: 'var(--dsw-alias-label-secondary, #bbb)',
          }}
        >
          {g.glyph} {g.label}
        </div>
      )}
      {showRipple && (
        <div style={{
          position: 'absolute', left: '-6%', top: '-6%', width: '112%', height: '112%', borderRadius: '50%',
          pointerEvents: 'none', border: `2px solid rgb(${m.rgb})`, animation: 'dsh-mind-ripple 1.9s ease-out infinite',
        }} />
      )}
      {fx !== undefined && fx.seq > 0 && <FloatFx kind={fx.kind} seq={fx.seq} size={size} />}
    </div>
  )
}
