/**
 * 存在体（The Being）：TA 的形态本体。
 * 一颗呼吸着、泛着微光的球体，光晕中可隐现人形剪影——机器状态全部翻译为
 * 身体语言：呼吸节奏、光的色温与明暗、内部涌动、涟漪（收到你的话时）。
 * 纯 CSS/SVG，无重资产；状态推导 beingMood 为纯函数（测试覆盖）。
 */
import { useMemo } from 'react'
import { beingMood, type BeingMood } from '../narrate.ts'

export type { BeingMood } from '../narrate.ts'

interface MoodStyle { color: string; breath: string; swirl: number; dim: number }

const MOODS: Record<BeingMood, MoodStyle> = {
  awake: { color: '#4fb3a9', breath: '6.5s', swirl: 0.1, dim: 1 },
  thinking: { color: '#53c8e8', breath: '2.6s', swirl: 0.75, dim: 1 },
  attentive: { color: '#e8b953', breath: '3.4s', swirl: 0.35, dim: 1 },
  asleep: { color: '#5b6fb5', breath: '11s', swirl: 0, dim: 0.62 },
  stopped: { color: '#8a8f98', breath: '13s', swirl: 0, dim: 0.5 },
}

let styleInjected = false
function injectStyle(): void {
  if (styleInjected) return
  styleInjected = true
  const el = document.createElement('style')
  el.textContent = `
@keyframes dsh-mind-breathe { from { transform: scale(.93); } to { transform: scale(1.07); } }
@keyframes dsh-mind-spin { to { transform: rotate(360deg); } }
@keyframes dsh-mind-ripple { from { transform: scale(1); opacity: .5; } to { transform: scale(2.2); opacity: 0; } }
@keyframes dsh-mind-chest { from { transform: scaleY(1); } to { transform: scaleY(1.06); } }
.dsh-mind-being { position: relative; border-radius: 50%; animation: dsh-mind-breathe var(--breath) ease-in-out infinite alternate; }
.dsh-mind-being-halo { position: absolute; inset: -32%; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, color-mix(in srgb, var(--being-color) 40%, transparent) 0%, transparent 68%);
  filter: blur(7px); opacity: var(--dim); animation: inherit; }
.dsh-mind-being-body { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; opacity: var(--dim);
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--being-color) 70%, white 30%) 0%, var(--being-color) 52%, color-mix(in srgb, var(--being-color) 55%, black 45%) 100%);
  box-shadow: 0 0 26px color-mix(in srgb, var(--being-color) 50%, transparent), inset 0 0 20px color-mix(in srgb, white 22%, transparent); }
.dsh-mind-being-swirl { position: absolute; inset: 10%; border-radius: 50%; opacity: var(--swirl);
  background: conic-gradient(from 0deg, transparent 0%, color-mix(in srgb, white 40%, transparent) 18%, transparent 42%);
  animation: dsh-mind-spin 3s linear infinite; }
.dsh-mind-being-ripple { position: absolute; inset: -6%; border-radius: 50%; pointer-events: none;
  border: 2px solid var(--being-color); animation: dsh-mind-ripple 1.9s ease-out infinite; }
.dsh-mind-being-figure { position: absolute; left: 18%; right: 18%; top: 16%; bottom: 12%; opacity: .5; }
.dsh-mind-being-figure .chest { animation: dsh-mind-chest var(--breath) ease-in-out infinite alternate; transform-origin: 50% 100%; }`
  document.head.appendChild(el)
}

export interface BeingProps {
  /** 直径（px）。 */
  size: number
  status?: BeingStatusInput
  /** 光晕中隐现人形剪影（默认开）。 */
  silhouette?: boolean
  /** 收到你的话时的涟漪（默认按 pending 自动）。 */
  ripple?: boolean
  style?: React.CSSProperties
}

/** 存在体本体。 */
export function Being({ size, status, silhouette = true, ripple, style }: BeingProps): JSX.Element {
  injectStyle()
  const mood = beingMood(status)
  const m = MOODS[mood]
  const showRipple = ripple ?? mood === 'attentive'
  const vars = useMemo(() => ({
    '--being-color': m.color,
    '--breath': m.breath,
    '--swirl': String(m.swirl),
    '--dim': String(m.dim),
  }) as React.CSSProperties, [mood])
  return (
    <div className="dsh-mind-being" style={{ width: size, height: size, ...vars, ...style }}>
      <div className="dsh-mind-being-halo" />
      <div className="dsh-mind-being-body">
        {silhouette && (
          <svg className="dsh-mind-being-figure" viewBox="0 0 100 100" aria-hidden>
            <g fill="rgba(10,14,20,.72)">
              <circle cx="50" cy="30" r="11" />
              <g className="chest">
                <path d="M50 44 C37 44 28.5 55 26.5 68 C40 75 60 75 73.5 68 C71.5 55 63 44 50 44 Z" />
              </g>
              <path d="M24 72 C38 65 62 65 76 72 C67 81 33 81 24 72 Z" />
            </g>
          </svg>
        )}
        <div className="dsh-mind-being-swirl" />
      </div>
      {showRipple && <div className="dsh-mind-being-ripple" />}
    </div>
  )
}
