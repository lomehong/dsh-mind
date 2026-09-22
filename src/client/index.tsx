/**
 * dsh-mind 客户端插件。
 *
 * 三个挂点（设计 §3.3 UI 重造）：
 * - plugins.bundle.config（key=包名）：summary=迷你人物卡；page=心智主页
 * - main（key='mind'，特性检测）：侧边栏「心智」一级页面的主体
 * - sidebar.panellist（id='mind'，特性检测）：在场感图标（呼吸点）
 *
 * 宿主客户端模块契约：命名导出 apply + inject 声明（对齐 dsh-task-board；
 * default activate 形态会导致 DI 缺失与看板不渲染——套件教训）。
 */
import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { presenceLine } from '../narrate.ts'
import { usePoll, type StatusPayload } from './api.ts'
import { CompanionLayer } from './Companion.tsx'
import { MindPage } from './MindPage.tsx'

export const inject = ['slots']

const C = {
  sub: 'var(--dsw-alias-label-secondary, #888)',
  border: 'var(--dsw-alias-border-l1, rgba(128,128,128,.25))',
  ok: 'var(--dsw-alias-state-success-primary, #2A9D8F)',
  brand: 'var(--dsw-alias-brand-primary, #4a6fa5)',
}

/** 迷你在场点（人物卡/侧边栏共用语义）。 */
function PresenceDot({ status, size = 8 }: { status: StatusPayload | undefined; size?: number }): JSX.Element {
  const stopped = status !== undefined && (status.stoppedByMaster || !status.enabled)
  const asleep = status?.quiet?.active === true
  const color = stopped ? C.sub : asleep ? C.brand : status?.running === true ? C.ok : C.brand
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, opacity: stopped ? 0.45 : 1, flexShrink: 0,
      boxShadow: status?.running === true ? `0 0 0 3px color-mix(in srgb, ${C.ok} 25%, transparent)` : undefined,
    }} />
  )
}

/** 插件管理页 summary：一行人物卡。 */
function PersonCard(): JSX.Element {
  const status = usePoll(async () => {
    const resp = await fetch('/dsh-mind/status')
    return (await resp.json()) as StatusPayload
  }, 30000)
  const st = status.data
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.sub }}>
      <PresenceDot status={st} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {st !== undefined ? presenceLine(st) : '分身：住在这台 dsh 里的心智'}
      </span>
      <span style={{ opacity: 0.7 }}>· 侧边栏「心智」看 TA</span>
    </span>
  )
}

/** 侧边栏在场图标：人形剪影 + 状态点，30s 轻轮询。 */
function SidebarIcon({ size, active }: { size: number; active: boolean }): JSX.Element {
  const [status, setStatus] = useState<StatusPayload>()
  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void fetch('/dsh-mind/status')
        .then(r => r.json() as Promise<StatusPayload>)
        .then(b => { if (!cancelled) setStatus(b) })
        .catch(() => { /* 图标降级为静态 */ })
    }
    void load()
    const t = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  const stopped = status !== undefined && (status.stoppedByMaster || !status.enabled)
  const asleep = status?.quiet?.active === true
  const color = active
    ? 'var(--dsw-alias-label-primary, inherit)'
    : stopped
      ? 'var(--dsw-alias-label-secondary, #888)'
      : 'var(--dsw-alias-label-secondary, #aaa)'
  const dotColor = stopped
    ? 'var(--dsw-alias-label-secondary, #888)'
    : asleep
      ? 'var(--dsw-alias-brand-primary, #4a6fa5)'
      : 'var(--dsw-alias-state-success-primary, #2A9D8F)'
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8.2" r="3.6" stroke={color} strokeWidth="2" />
        <path d="M4.8 20c1.3-3.4 4-5 7.2-5s5.9 1.6 7.2 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span style={{
        position: 'absolute', right: -1, bottom: -1, width: 7, height: 7, borderRadius: '50%',
        background: dotColor, border: '1.5px solid var(--dsw-specific-sidebar-fill, transparent)',
      }} />
    </span>
  )
}

export function apply(ctx: ClientContext): void {
  // 「插件」管理页配置区：summary=人物卡；page=心智主页
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: '@dsh-extra/dsh-mind',
  }, (props: { view: 'summary' | 'page' }) => {
    if (props.view !== 'page') return <PersonCard />
    return <MindPage />
  }))

  // conversation.view：当前宿主的一级入口（「心智」Tab，任务看板同款位置）
  try {
    ctx.slots.inject('conversation.view', () =>
      ctx.slots.register(
        { name: 'conversation.view', id: 'mind', order: 21, label: () => '心智' },
        MindPage,
      ),
    )
  } catch (e) { console.warn('[dsh-mind] conversation.view 注册失败（显式降级）:', e instanceof Error ? e.message : String(e)) }

  // shell.overlay：常驻存在体（窗口右下角——TA 住在整个 dsh 里，任何页面可见）
  try {
    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        { name: 'shell.overlay', id: 'dsh-mind-companion', order: 90, label: () => '心智' },
        CompanionLayer,
      ),
    )
  } catch (e) { console.warn('[dsh-mind] shell.overlay 注册失败（显式降级）:', e instanceof Error ? e.message : String(e)) }

  // alpha.2 全局面板（特性检测双写，先例 dsh-task-board）：宿主具备 main /
  // sidebar.panellist 槽位时，心智主页挂为侧边栏一级页面。
  // （2026-09-22 实测：当前桌面壳未启用该组槽位——task-board 的看板图标同样缺席；
  //  升级宿主后本注册自动生效。）
  const slots = ctx.slots as ClientContext['slots'] & { spec?: (name: string) => unknown }
  if (typeof slots.spec !== 'function') return
  try {
    const registerNew = slots.register as unknown as (slot: Record<string, unknown>, component: unknown) => void
    if (slots.spec('main') !== undefined) {
      ctx.slots.inject('main', () => registerNew({ name: 'main', key: 'mind' }, MindPage))
    }
    if (slots.spec('sidebar.panellist') !== undefined) {
      ctx.slots.inject('sidebar.panellist', () => registerNew(
        { name: 'sidebar.panellist', id: 'mind', order: 20, label: () => '心智' },
        (props: { size: number; active: boolean }) => <SidebarIcon size={props.size} active={props.active} />,
      ))
    }
  } catch (e) { console.warn('[dsh-mind] main/panellist 注册失败（显式降级）:', e instanceof Error ? e.message : String(e)) }
}
