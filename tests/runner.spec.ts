/**
 * WakeRunner 测试（v0.10.2）：
 * - ensureSession 的 create 短退避重试：失败 2 次第 3 次成功 / 3 次全败抛出
 * - isTransientServiceError：gateway 暂态错误识别
 * 时钟依赖注入（createRetryMs=0），确定性可测（G8）。
 */
import { describe, expect, it } from 'vitest'
import { GatewayClient, type GatewayInvokeSpec, type TypertGateway } from '../src/gateway.ts'
import { isTransientServiceError, WakeRunner } from '../src/runner.ts'

/** 脚本化假网关：按脚本逐次应答 create，其余方法记录调用。 */
function scriptedGateway(createResults: Array<'ok' | Error>): { gw: GatewayClient; creates: { n: number } } {
  const creates = { n: 0 }
  const gw: TypertGateway = {
    async invoke(spec: GatewayInvokeSpec) {
      if (spec.namespace === 'session' && spec.method === 'create') {
        const step = createResults[Math.min(creates.n, createResults.length - 1)]
        creates.n += 1
        if (step instanceof Error) throw step
        return { sessionId: 'session-test' }
      }
      return {} // rename 等：尽力而为
    },
  }
  return { gw: new GatewayClient(gw), creates }
}

function runnerFor(gw: GatewayClient): WakeRunner {
  return new WakeRunner(gw, {
    presetId: 'digital-twin',
    title: '🧠 mind',
    timeoutMs: 1000,
    resetThresholdTokens: 60_000,
    createRetryMs: 0,
  })
}

describe('ensureSession 的 create 短退避重试', () => {
  it('失败 2 次第 3 次成功 → 返回会话且 create 共调用 3 次', async () => {
    const unavailable = new Error('typert gateway: session/create: active Service "sessionController" is unavailable')
    const { gw, creates } = scriptedGateway([unavailable, unavailable, 'ok'])
    const result = await runnerFor(gw).ensureSession(undefined, 0)
    expect(result.sessionId).toBe('session-test')
    expect(result.reset).toBe(true)
    expect(creates.n).toBe(3)
  })

  it('3 次全败 → 抛最后错误（且属暂态服务错误）', async () => {
    const unavailable = new Error('typert gateway: session/create: active Service "sessionController" is unavailable')
    const { gw, creates } = scriptedGateway([unavailable])
    await expect(runnerFor(gw).ensureSession(undefined, 0)).rejects.toThrow('is unavailable')
    expect(creates.n).toBe(3)
  })
})

describe('isTransientServiceError', () => {
  it('gateway/service-unavailable 与 is unavailable 识别为暂态；其他错误不是', () => {
    expect(isTransientServiceError(new Error('gateway/service-unavailable: session/create: active Service "sessionController" is unavailable'))).toBe(true)
    expect(isTransientServiceError(new Error('typert gateway: session/create: active Service "sessionController" is unavailable'))).toBe(true)
    expect(isTransientServiceError(new Error('mind wake run timed out after 600000ms'))).toBe(false)
    expect(isTransientServiceError(new Error('connect ECONNREFUSED 127.0.0.1:3088'))).toBe(false)
  })
})
