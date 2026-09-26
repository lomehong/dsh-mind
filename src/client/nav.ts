/**
 * 跨插件导航契约（dsh-mind → 数字分身「今日待办」）。
 *
 * 宪章 §3.1：套件包之间零构建期/运行时依赖——本文件与 dsh-twin 侧各持一份
 * 相同的字符串常量拷贝（类型级参考，值不共享）。契约两件：
 * 1. 顶部一级 Tab 的标签文本（宿主 conversation 包渲染为 button[role="tab"]，
 *    宿主未对 shell.overlay 暴露编程式切换 API——以真实 DOM click 兜底）；
 * 2. window CustomEvent 焦点事件：Tab 切到数字分身后派发，twin-hub 收到后
 *    落到「今日待办」子页并高亮心智请求单。
 */
export const TWIN_TAB_LABEL = '数字分身'
export const ASKS_FOCUS_EVENT = 'dsh-twin:focus-todo'

/** 切到数字分身 Tab 并聚焦今日待办（请求单）。Tab 找不到也照常派发事件——
 *  已在数字分身页时由 twin-hub 的监听直接生效。 */
export function openTwinTodos(): void {
  try {
    const strip = document.querySelector('[data-conversation-tabs]')
    const buttons = strip !== null
      ? Array.from(strip.querySelectorAll('button[role="tab"]'))
      : Array.from(document.querySelectorAll('button[role="tab"]'))
    const target = buttons.find(b => (b.textContent ?? '').trim() === TWIN_TAB_LABEL)
    if (target !== undefined) target.click()
  } catch { /* DOM 不在预期形态：跳过切 Tab，事件仍派发 */ }
  try {
    window.dispatchEvent(new CustomEvent(ASKS_FOCUS_EVENT))
  } catch { /* 非 DOM 环境静默 */ }
}
