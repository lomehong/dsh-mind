/**
 * 活跃目标卡（P4 goals 精化）：呈现 TA 当前的 [目标] 标记记忆条目（只读）。
 * 目标的写入由 TA 在唤醒里经记忆工具完成（[目标]/[目标·完成]/[目标·放弃] 约定）。
 */
import { useEffect, useState } from 'react'
import { fetchGoals, type GoalItem } from './api.ts'

const SUB = 'var(--dsw-alias-label-secondary, #888)'
const BORDER = 'var(--dsw-alias-border-l1, rgba(128,128,128,.22))'
const OK = 'var(--dsw-alias-state-success-primary, #2A9D8F)'

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

export function GoalsCard(): JSX.Element {
  const [goals, setGoals] = useState<GoalItem[]>()
  useEffect(() => {
    let cancelled = false
    fetchGoals()
      .then(g => { if (!cancelled) setGoals(g) })
      .catch(() => { if (!cancelled) setGoals([]) })
    return () => { cancelled = true }
  }, [])
  return (
    <Card style={{ padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>活跃目标</span>
        <span style={{ fontSize: 11 }}>TA 自己立的（[目标] 标记记忆）</span>
      </div>
      {goals === undefined
        ? <div style={{ color: SUB, fontSize: 12.5, padding: '4px 0' }}>读取中…</div>
        : goals.length === 0
          ? <div style={{ color: SUB, fontSize: 12.5, padding: '4px 0' }}>暂无——TA 还没立过目标（goals 函数会以 [目标] 标记记录）。</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {goals.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12.5 }}>
                  <span style={{ color: OK }}>◆</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.title}>{g.title}</span>
                  <span style={{ color: SUB, fontSize: 11, whiteSpace: 'nowrap' }}>{g.ts.slice(5, 10)}</span>
                </div>
              ))}
            </div>
          )}
    </Card>
  )
}
