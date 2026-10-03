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
    // P1.5 修正（遥测实证第二形态）：只认「可信事件」——浏览器规范保证用户
    // 真实输入 isTrusted=true，程序化滚动/渲染引发的合成事件为 false。
    // 不加此过滤：agent 自己的输出流引发页面自动滚动 → 刷新自己的在场信号
    // → 提问升级的门永远打不开（递归盲区第二形态，2026-10-03 生产复现）。
    const markDirty = (e?: { isTrusted?: boolean }): void => {
      if (e !== undefined && e.isTrusted !== true) return
      dirty = true
    }
    const onTick = (): void => {
      if (!dirty) return
      dirty = false
      report()
    }
    // 挂载即上报一次（重启后控制台打开的瞬间就有在场信号）
    lastSentAt = Date.now()
    report()
    const timer = setInterval(onTick, 3000)
    document.addEventListener('mousemove', (e) => markDirty(e), { passive: true })
    document.addEventListener('keydown', (e) => markDirty(e), true)
    document.addEventListener('click', (e) => markDirty(e), true)
    document.addEventListener('scroll', (e) => markDirty(e), { passive: true, capture: true })
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
