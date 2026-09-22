/**
 * dsh-mind 配置（fail-safe：解析失败回落内置默认——保守运行，而非停机；
 * 显式停止走 state.stoppedByMaster，与配置互不覆盖。设计 §12.2）
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
export const CONFIG_DEFAULTS = {
    enabled: true,
    backoffBaseMs: 5000,
    backoffFactor: 2,
    backoffCapMs: 300000,
    hold: 3,
    quietHours: { tz: 'Asia/Shanghai', start: '01:00', end: '08:00', enabled: true },
    spendSoftCapUsd: 1,
    spendHardCapUsd: 5,
    priceUsdPerMTokIn: 0.27,
    priceUsdPerMTokOut: 1.1,
    reactiveMergeWindowMs: 60000,
    reactiveHourlyMax: 20,
    minSpontaneousIntervalMs: 300000,
    idleShortCircuit: true,
    wakeTimeoutMs: 600000,
    timelineRetentionDays: 180,
    presetId: 'digital-twin',
    sessionResetTokens: 60000,
};
const toBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const toNum = (v, fallback, min, max) => {
    if (typeof v !== 'number' || !Number.isFinite(v))
        return fallback;
    return Math.min(max, Math.max(min, v));
};
/** 配置合并（纯函数，测试用）：非法键回落默认并夹紧边界。 */
export function mergeMindConfig(raw) {
    const m = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));
    if (raw === null || typeof raw !== 'object')
        return m;
    const r = raw;
    m.enabled = toBool(r.enabled, m.enabled);
    m.backoffBaseMs = toNum(r.backoffBaseMs, m.backoffBaseMs, 1000, 3600000);
    m.backoffFactor = toNum(r.backoffFactor, m.backoffFactor, 1, 10);
    m.backoffCapMs = toNum(r.backoffCapMs, m.backoffCapMs, 10000, 86400000);
    m.hold = toNum(r.hold, m.hold, 1, 20);
    if (r.quietHours !== null && typeof r.quietHours === 'object') {
        const q = r.quietHours;
        const validHm = (s) => typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s);
        m.quietHours = {
            tz: typeof q.tz === 'string' && q.tz !== '' ? q.tz : m.quietHours.tz,
            start: validHm(q.start) ? q.start : m.quietHours.start,
            end: validHm(q.end) ? q.end : m.quietHours.end,
            enabled: toBool(q.enabled, m.quietHours.enabled),
        };
    }
    m.spendSoftCapUsd = toNum(r.spendSoftCapUsd, m.spendSoftCapUsd, 0.01, 1000);
    m.spendHardCapUsd = toNum(r.spendHardCapUsd, m.spendHardCapUsd, 0.01, 1000);
    if (m.spendHardCapUsd < m.spendSoftCapUsd)
        m.spendHardCapUsd = m.spendSoftCapUsd;
    m.priceUsdPerMTokIn = toNum(r.priceUsdPerMTokIn, m.priceUsdPerMTokIn, 0, 1000);
    m.priceUsdPerMTokOut = toNum(r.priceUsdPerMTokOut, m.priceUsdPerMTokOut, 0, 1000);
    m.reactiveMergeWindowMs = toNum(r.reactiveMergeWindowMs, m.reactiveMergeWindowMs, 0, 3600000);
    m.reactiveHourlyMax = toNum(r.reactiveHourlyMax, m.reactiveHourlyMax, 1, 1000);
    m.minSpontaneousIntervalMs = toNum(r.minSpontaneousIntervalMs, m.minSpontaneousIntervalMs, 30000, 3600000);
    m.idleShortCircuit = toBool(r.idleShortCircuit, m.idleShortCircuit);
    m.wakeTimeoutMs = toNum(r.wakeTimeoutMs, m.wakeTimeoutMs, 30000, 7200000);
    m.timelineRetentionDays = toNum(r.timelineRetentionDays, m.timelineRetentionDays, 7, 3650);
    if (typeof r.presetId === 'string' && r.presetId !== '')
        m.presetId = r.presetId;
    m.sessionResetTokens = toNum(r.sessionResetTokens, m.sessionResetTokens, 10000, 1000000);
    return m;
}
export function mindHome() {
    const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
    return join(base, 'dsh-mind');
}
export function mindConfigPath() {
    return join(mindHome(), 'config.json');
}
let configCache;
/** 读取配置（30s TTL 缓存；缺文件/解析失败 → 全默认，绝不抛）。 */
export function loadMindConfig(now = Date.now()) {
    if (configCache !== undefined && now - configCache.at < 30000)
        return configCache.value;
    let value;
    try {
        value = mergeMindConfig(JSON.parse(readFileSync(mindConfigPath(), 'utf8')));
    }
    catch {
        value = { ...CONFIG_DEFAULTS };
    }
    configCache = { at: now, value };
    return value;
}
/** 供测试重置缓存。 */
export function resetConfigCache() {
    configCache = undefined;
}
