/** 小格式化工具（客户端共用）。 */
export const fmtUsd = (v: number): string => `$${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)}`

export const fmtClock = (ts: string | number): string =>
  new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

export const fmtCountdown = (ms: number): string => {
  if (ms <= 0) return '就这一两分钟'
  const mins = Math.round(ms / 60000)
  if (mins >= 1) return `约 ${mins} 分钟后`
  return `${Math.max(1, Math.round(ms / 1000))} 秒后`
}
