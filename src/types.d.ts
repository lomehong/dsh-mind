/**
 * 类型声明桩 — 供 dsh-mind 插件独立编译使用
 * 运行时这些类型由 DSH 宿主提供，编译时无需真实类型。
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    get<T = unknown>(key: string): T | undefined
    inject(deps: string[], callback: (ctx: Context) => void): void
    logger?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void }
  }
}
