/**
 * 办公室覆盖层（P3 入口修正）：桌面壳拦 window.open 弹窗，改为应用内
 * 全屏 iframe 直嵌 /dsh-mind/office（同源，无围栏问题）。Esc/关闭钮退出。
 */
import { useEffect } from 'react'

export function OfficeOverlay({ onClose }: { onClose(): void }): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147482000, background: '#10141a', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.1)', flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>🏢 分身的一天 · 办公室</div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '4px 14px', cursor: 'pointer', borderRadius: 8, fontSize: 12.5,
            border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))',
            background: 'transparent', color: 'var(--dsw-alias-label-secondary, #bbb)',
          }}
        >
          ← 回到分身（Esc）
        </button>
      </div>
      <iframe
        src="/dsh-mind/office"
        title="分身的一天 · 办公室"
        style={{ flex: 1, border: 'none', width: '100%' }}
      />
    </div>
  )
}
