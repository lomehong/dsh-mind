/**
 * P1.5 在场探针（临时诊断件，验证完成后由正式融合逻辑替换）：
 * 双挂点对照实验——shell.overlay（预期跨 Tab 常驻） vs conversation.view
 * 心智 Tab（预期切走即死）。document 级事件监听 + 3s 聚合心跳，
 * 经 panel-api 写门禁落盘宿主侧，供离线分析挂载生命周期。
 */
import { useEffect, useRef } from 'react'
import { writeKey } from './api.ts'

export interface ProbeEventPayload {
  mountId: string
  type: 'mounted' | 'events' | 'visibility' | 'pagehide' | 'unmounted'
  at: number
  ev?: { move: number; key: number; click: number; scroll: number }
  vis?: string
  focus?: boolean
}

export function sendProbe(payload: ProbeEventPayload): void {
  const body = JSON.stringify(payload)
  void (async () => {
    try {
      const key = await writeKey()
      await fetch('/dsh-mind/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mind-key': key },
        body,
        keepalive: true,
      })
    } catch { /* 探针静默：诊断件绝不影响页面 */ }
  })()
}

/** 挂在任意槽点内的隐形探针：只挂 document 级监听，不渲染任何可见物。 */
export function Probe({ mountId }: { mountId: string }): null {
  const agg = useRef({ move: 0, key: 0, click: 0, scroll: 0, dirty: false })
  useEffect(() => {
    sendProbe({ mountId, type: 'mounted', at: Date.now() })
    const onMove = (): void => { agg.current.move++; agg.current.dirty = true }
    const onKey = (): void => { agg.current.key++; agg.current.dirty = true }
    const onClick = (): void => { agg.current.click++; agg.current.dirty = true }
    const onScroll = (): void => { agg.current.scroll++; agg.current.dirty = true }
    const onVis = (): void => {
      sendProbe({ mountId, type: 'visibility', vis: document.visibilityState, focus: document.hasFocus(), at: Date.now() })
    }
    const onHide = (): void => { sendProbe({ mountId, type: 'pagehide', at: Date.now() }) }
    const timer = setInterval(() => {
      const a = agg.current
      if (!a.dirty) return
      a.dirty = false
      const ev = { move: a.move, key: a.key, click: a.click, scroll: a.scroll }
      a.move = 0; a.key = 0; a.click = 0; a.scroll = 0
      sendProbe({ mountId, type: 'events', ev, vis: document.visibilityState, focus: document.hasFocus(), at: Date.now() })
    }, 3000)
    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      sendProbe({ mountId, type: 'unmounted', at: Date.now() })
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      clearInterval(timer)
    }
  }, [mountId])
  return null
}
