/**
 * 主人长期事项编辑卡（议程面）：主人想让 TA 长期关心/推进的事，直接写在这里。
 * 数据是 missions.md（每次唤醒注入上下文）——这不是提示词调教（怎么想），
 * 而是议程输入（关心什么）。保存后下一次唤醒即生效。
 */
import { useEffect, useState } from 'react'
import { fetchMissions, saveMissions } from './api.ts'

const SUB = 'var(--dsw-alias-label-secondary, #888)'
const BORDER = 'var(--dsw-alias-border-l1, rgba(128,128,128,.22))'
const OK = 'var(--dsw-alias-state-success-primary, #2A9D8F)'
const WARN = 'var(--dsw-alias-state-warn-primary, #b8860b)'

export function MissionsCard(): JSX.Element {
  const [loaded, setLoaded] = useState<string>()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    fetchMissions()
      .then(t => { setLoaded(t); setDraft(t) })
      .catch(() => setLoaded(''))
  }, [])
  const dirty = loaded !== undefined && draft !== loaded
  const save = (): void => {
    setSaving(true)
    saveMissions(draft)
      .then(d => {
        setSaving(false)
        if (d.ok) { setLoaded(draft); setNotice('已保存——下一次唤醒即进入 TA 的议程') }
        else setNotice(`保存失败：${d.error ?? '未知'}`)
      })
      .catch((e: unknown) => { setSaving(false); setNotice(e instanceof Error ? e.message : String(e)) })
  }
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>主人关心的长期事项</div>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 6, lineHeight: 1.6 }}>
        你希望 TA 长期关注、持续跟进的事写在这里（一行一件）。安静的时候 TA 会围绕它们复盘、预研、做准备——这是 TA 的议程来源。
      </div>
      {loaded === undefined
        ? <div style={{ color: SUB, fontSize: 12.5, padding: '4px 0' }}>读取中…</div>
        : (
          <>
            <textarea
              value={draft}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
              rows={5}
              placeholder={'例如：\n跟进 G4 复核登记包的落地与主人批准情况\n关注 dsh 套件的健康度，发现异常主动报告\n每周五整理本周记忆，帮我回顾一周'}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontFamily: 'inherit',
                fontSize: 12.5, lineHeight: 1.6, border: `1px solid ${BORDER}`, borderRadius: 8,
                background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))',
                color: 'var(--dsw-alias-label-primary, inherit)', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <button
                type="button" disabled={!dirty || saving} onClick={save}
                style={{ padding: '5px 16px', fontSize: 12.5, borderRadius: 8, cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5 }}
              >{saving ? '保存中…' : '保存'}</button>
              {notice !== '' && <span style={{ fontSize: 12, color: notice.startsWith('已保存') ? OK : WARN }}>{notice}</span>}
            </div>
          </>
        )}
    </div>
  )
}
