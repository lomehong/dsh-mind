/**
 * 提示词编辑器（心智 Tab 工程视图的调教面）：
 * 四个心智专属文本块（函数菜单/自治守则/输出格式/消息写作规范）的
 * 查看、编辑、恢复默认、保存生效（下次唤醒即用）+ 组装预览。
 *
 * 人格与守卫不在此编辑：人格走 dsh-twin 人格卡，守卫优先取 dsh-twin 服务面
 * ——两处来源在 GET 响应的 composed 骨架预览里只读可见。
 */
import { useEffect, useState } from 'react'
import { fetchPrompts, savePrompts, type PromptsPayload } from './api.ts'

const SUB = 'var(--dsw-alias-label-secondary, #888)'
const BORDER = 'var(--dsw-alias-border-l1, rgba(128,128,128,.22))'
const WARN = 'var(--dsw-alias-state-warn-primary, #b8860b)'
const OK = 'var(--dsw-alias-state-success-primary, #2A9D8F)'

const BLOCK_ORDER: Array<'menu' | 'rules' | 'outputFormat' | 'style'> = ['menu', 'rules', 'outputFormat', 'style']

const textareaStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 150, padding: '8px 10px',
  fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
  border: `1px solid ${BORDER}`, borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))',
  color: 'var(--dsw-alias-label-primary, inherit)', resize: 'vertical',
}

/** 提示词编辑器（挂工程视图尾部）。 */
export function PromptsEditor(): JSX.Element {
  const [data, setData] = useState<PromptsPayload>()
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = (): void => {
    fetchPrompts()
      .then(d => {
        setData(d)
        const next: Record<string, string> = {}
        for (const b of d.blocks) next[b.key] = b.current
        setDraft(next)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(load, [])

  const byKey = (key: string): PromptBlockInfo | undefined => data?.blocks.find(b => b.key === key)
  const dirtyKeys = BLOCK_ORDER.filter(k => {
    const info = byKey(k)
    return info !== undefined && draft[k] !== undefined && draft[k] !== info.current
  })

  const save = (): void => {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    const payload: Record<string, string | null> = {}
    for (const k of dirtyKeys) payload[k] = draft[k] === byKey(k)?.default ? null : draft[k]
    savePrompts(payload)
      .then(d => {
        setSaving(false)
        if (d.ok) {
          setNotice('已保存——下一次唤醒即生效')
          load()
        } else setNotice(`保存失败：${d.error ?? '未知'}`)
      })
      .catch((e: unknown) => {
        setSaving(false)
        setNotice(e instanceof Error ? e.message : String(e))
      })
  }

  if (error !== undefined) {
    return <div style={{ color: WARN, fontSize: 12.5, padding: '8px 0' }}>提示词读取失败：{error}</div>
  }
  if (data === undefined) return <div style={{ color: SUB, fontSize: 12.5, padding: '8px 0' }}>读取提示词…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>
        这些文本块决定 TA 每次醒来「怎么想、怎么做事、怎么说话」。修改后保存，下一次唤醒即用新词；
        留空或恢复默认 = 用内置词。人格与守卫来自「数字分身」设置，不在此处。
      </div>
      {BLOCK_ORDER.map(key => {
        const info = byKey(key)
        if (info === undefined) return null
        const value = draft[key] ?? info.current
        const isDefault = value === info.default
        return (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{info.label}</span>
              {info.overridden && <span style={{ fontSize: 10.5, color: WARN }}>已自定义</span>}
              {!isDefault && <span style={{ fontSize: 10.5, color: WARN }}>未保存</span>}
              <span style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setDraft(prev => ({ ...prev, [key]: info.default }))}
                  style={{ fontSize: 11, cursor: 'pointer', border: 'none', background: 'transparent', color: SUB, textDecoration: 'underline' }}
                >恢复默认</button>
              </span>
            </div>
            <textarea
              value={value}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
              rows={key === 'menu' ? 14 : 8}
              style={textareaStyle}
            />
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          disabled={saving || dirtyKeys.length === 0}
          onClick={save}
          style={{
            padding: '6px 18px', cursor: dirtyKeys.length === 0 ? 'default' : 'pointer', borderRadius: 8, fontSize: 12.5,
            opacity: dirtyKeys.length === 0 ? 0.5 : 1,
          }}
        >
          {saving ? '保存中…' : `保存${dirtyKeys.length > 0 ? `（${dirtyKeys.length} 处修改）` : ''}`}
        </button>
        {notice !== '' && <span style={{ fontSize: 12, color: notice.startsWith('已保存') ? OK : WARN }}>{notice}</span>}
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: SUB }}>组装预览（TA 每次唤醒实际读到的骨架，不含时间线等动态数据）</summary>
        <pre style={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11.5, lineHeight: 1.55,
          padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`,
          background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))',
          color: 'var(--dsw-alias-label-secondary, #aaa)', maxHeight: 320, overflow: 'auto',
        }}>{data.composed}</pre>
      </details>
    </div>
  )
}
