/**
 * P1.5 控制台活动传感器（正式件，替代临时探针；验证结论见 probe 实验：
 * shell.overlay 跨 Tab 常驻 + document 级事件跨 Tab 可达，conv-view 挂点切走即死）。
 *
 * 行为：监听整页输入（move/key/click/scroll），≥25s 节流上报一次「控制台最近
 * 被使用」的时间戳到 /dsh-mind/console-activity。只传时间戳，不含任何输入内容。
 * 宿主侧以 2 分钟窗口融合进 presenceState().atComputer（审批升级路由的门控）。
 */
import { useEffect } from 'react'
import { writeKey } from './api.ts'

const REPORT_THROTTLE_MS = 25_000

export function ActivitySensor(): null {
  useEffect(() => {
    let lastSentAt = 0
    let dirty = false
    let pending = false
    const report = (): void => {
      if (pending) return
      const now = Date.now()
      if (now - lastSentAt < REPORT_THROTTLE_MS) return
      pending = true
      lastSentAt = now
      void (async () => {
        try {
          const key = await writeKey()
          await fetch('/dsh-mind/console-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-mind-key': key },
            body: JSON.stringify({ at: now }),
          })
        } catch { /* 传感器静默：绝不影响页面 */ }
        pending = false
      })()
    }
    const markDirty = (): void => { dirty = true }
    const onTick = (): void => {
      if (!dirty) return
      dirty = false
      report()
    }
    // 挂载即上报一次（重启后控制台打开的瞬间就有在场信号）
    lastSentAt = Date.now()
    report()
    const timer = setInterval(onTick, 3000)
    document.addEventListener('mousemove', markDirty, { passive: true })
    document.addEventListener('keydown', markDirty, true)
    document.addEventListener('click', markDirty, true)
    document.addEventListener('scroll', markDirty, { passive: true, capture: true })
    return () => {
      clearInterval(timer)
      document.removeEventListener('mousemove', markDirty)
      document.removeEventListener('keydown', markDirty, true)
      document.removeEventListener('click', markDirty, true)
      document.removeEventListener('scroll', markDirty, { capture: true } as EventListenerOptions)
    }
  }, [])
  return null
}
