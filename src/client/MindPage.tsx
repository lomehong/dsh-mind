/**
 * 心智主页：TA 的房间。存在体为绝对主体——大、居中、有生命。
 * v0.5 去重（主人拍板）：说话/生活流/照看已由右下角常驻存在体承载，此处不再
 * 重复；想调教 TA——切「工程视图」，提示词卡就在那里。
 */
import { useState } from 'react'
import { presenceLine, greeting } from '../narrate.ts'
import { fetchStatus, usePoll } from './api.ts'
import { Being } from './Being.tsx'
import { EngView } from './EngView.tsx'

const VIEW_KEY = 'dsh-mind.view'

/** 心智主页（存在体为主；右上角切工程视图）。 */
export function MindPage(): JSX.Element {
  const [view, setView] = useState<'person' | 'eng'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'eng' ? 'eng' : 'person' } catch { return 'person' }
  })
  const status = usePoll(fetchStatus, 5000)
  if (view === 'eng') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <ViewToggle view={view} onToggle={() => { setView('person'); try { localStorage.setItem(VIEW_KEY, 'person') } catch { /* 隐私模式忽略 */ } }} />
        </div>
        <EngView status={status.data} />
      </div>
    )
  }
  const st = status.data
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} onToggle={() => { setView('eng'); try { localStorage.setItem(VIEW_KEY, 'eng') } catch { /* 隐私模式忽略 */ } }} />
      </div>
      {/* 存在体：TA 的本体 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0 6px' }}>
        <Being size={216} status={st} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>分身</div>
          <div style={{ fontSize: 14, color: 'var(--dsw-alias-label-secondary, #bbb)', marginTop: 4 }}>
            {st !== undefined ? presenceLine(st) : '…'}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--dsw-alias-label-secondary, #888)', textAlign: 'center' }}>
          {greeting(new Date())}。TA 就住在这台 dsh 里——右下角也一直有 TA，说句话 TA 就会回应。
          <br />
          想调教 TA 的行为方式？切到「工程视图」改 TA 的提示词。
        </div>
      </div>
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
