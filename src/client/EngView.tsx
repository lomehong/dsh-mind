/**
 * 工程视图：原五区块运维面板（成本行/状态/kill switch/时间线最近步骤）。
 * 人视图的「工程」切换层——主人做 SRE 时用，日常藏在默认视图之外。
 */
import { fmtUsd } from './format.tsx'
import { setMindStopped, usePoll, type StatusPayload } from './api.ts'

const fmtTime = (ts: number): string => (ts > 0 ? new Date(ts).toLocaleTimeString() : '—')

export function EngView({ status, refresh }: { status: StatusPayload | undefined; refresh(): void }): JSX.Element {
  if (status === undefined) {
    return <div style={{ padding: 12, color: 'var(--dsw-alias-label-secondary, #888)' }}>读取中…</div>
  }
  const capped = status.spend.usedUsd >= status.spend.hardCapUsd
  const soft = !capped && status.spend.usedUsd >= status.spend.softCapUsd
  const stopped = status.stoppedByMaster || !status.enabled
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          padding: '2px 10px', borderRadius: 10,
          background: stopped ? 'var(--dsw-alias-label-secondary, #999)' : status.running ? 'var(--dsw-alias-state-success-primary, #2A9D8F)' : 'var(--dsw-alias-brand-primary, #4a6fa5)',
          color: '#fff',
        }}>
          {stopped ? '已暂停' : status.running ? '思考中' : '待机'}
        </span>
        <span>退避档位 L{status.backoffLevel}</span>
        <span>上次唤醒 {fmtTime(status.lastWakeAt)}</span>
        <span style={{ color: capped ? 'var(--dsw-alias-state-error-primary, #c0392b)' : soft ? 'var(--dsw-alias-state-warn-primary, #b8860b)' : undefined }}>
          今日 {fmtUsd(status.spend.usedUsd)} / 硬顶 {fmtUsd(status.spend.hardCapUsd)}{capped ? '（已触顶：自发暂停）' : soft ? '（软顶：快模型）' : ''}
        </span>
        <span>待处理 {status.pending ?? 0}</span>
        {status.pendingApprovals !== undefined && status.pendingApprovals > 0 && <span>待批 {status.pendingApprovals}</span>}
        <button
          type="button"
          onClick={() => { void setMindStopped(!stopped).then(refresh) }}
          style={{ marginLeft: 'auto', padding: '4px 14px', cursor: 'pointer' }}
        >
          {stopped ? '▶ 恢复心智' : '⏸ 暂停心智'}
        </button>
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>时间线（最近）</div>
        {status.tail.length === 0
          ? <div style={{ color: 'var(--dsw-alias-label-secondary, #888)' }}>暂无步骤——分身尚未醒来</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {status.tail.slice().reverse().map(step => (
                <div key={step.seq} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--dsw-alias-label-secondary, #888)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {new Date(step.ts).toLocaleTimeString()}
                  </span>
                  <span style={{ fontFamily: 'monospace' }}>[{step.type}{step.fn !== undefined ? `:${step.fn}` : ''}]</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.content}</span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
