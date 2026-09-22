export function dayKey(now) {
    return now.toISOString().slice(0, 10);
}
/** 档位 n 的自发唤醒间隔：delay(0)=0；delay(n≥1)=min(base×factor^(n-1), cap)。 */
export function nextDelayMs(cfg, level) {
    if (level <= 0)
        return 0;
    return Math.min(cfg.backoffBaseMs * Math.pow(cfg.backoffFactor, level - 1), cfg.backoffCapMs);
}
/**
 * 唤醒结束后推进退避状态（headlong 分级阶梯）：
 * engaged（有可见产出或反应性）→ 归零连转；empty → HOLD 拍停留后降档；
 * thought 与 empty 同阶（THOUGHT_CAP=CAP，v0.2 决策）。
 */
export function advanceAfterWake(state, outcome, cfg) {
    if (outcome === 'engaged')
        return { ...state, backoffLevel: 0, emptiesAtLevel: 0 };
    const empties = state.emptiesAtLevel + 1;
    if (empties < cfg.hold)
        return { ...state, emptiesAtLevel: empties };
    return { ...state, backoffLevel: state.backoffLevel + 1, emptiesAtLevel: 0 };
}
/** 两级 cap 评估：≥硬顶=hard（停自发留反应性）；≥软顶=soft（降级快模型）。 */
export function evaluateSpend(state, cfg, now) {
    const used = state.spend.date === dayKey(now) ? state.spend.usedUsd : 0;
    if (used >= cfg.spendHardCapUsd)
        return 'hard';
    if (used >= cfg.spendSoftCapUsd)
        return 'soft';
    return 'normal';
}
/** 静音时段判定：按配置时区取本地小时（hh:mm 闭开区间，支持跨午夜）。 */
export function isQuietHour(now, cfg) {
    const q = cfg.quietHours;
    if (!q.enabled)
        return false;
    let hour = now.getUTCHours();
    let minute = now.getUTCMinutes();
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: q.tz, hour12: false, hour: '2-digit', minute: '2-digit',
        }).formatToParts(now);
        const h = parts.find(p => p.type === 'hour')?.value;
        const m = parts.find(p => p.type === 'minute')?.value;
        if (h !== undefined)
            hour = Number(h) % 24;
        if (m !== undefined)
            minute = Number(m);
    }
    catch {
        /* 时区名非法：退回 UTC */
    }
    const nowMin = hour * 60 + minute;
    const parseHm = (s) => {
        const [h, m] = s.split(':');
        return (Number(h) || 0) * 60 + (Number(m) || 0);
    };
    const startMin = parseHm(q.start);
    const endMin = parseHm(q.end);
    if (startMin === endMin)
        return false;
    if (startMin < endMin)
        return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin; // 跨午夜
}
/**
 * 触发收集（设计 §4.1/§5/§11）：优先级 event > reactive > watchdog > spontaneous；
 * 显式停止压倒一切；spontaneous 受静音时段与 spend hard 闸；reactive 不受退避但受
 * §5.3 护栏（窗口/小时上限由入口维护，此处只见"是否已获准入队"）。
 */
export function collectDueMindTriggers(now, state, cfg, inputs) {
    if (state.stoppedByMaster || !cfg.enabled) {
        return { fire: false, trigger: 'none', reason: 'paused' };
    }
    if (inputs.eventQueued)
        return { fire: true, trigger: 'event', reason: 'event queued' };
    if (inputs.reactiveQueued)
        return { fire: true, trigger: 'reactive', reason: 'message queued' };
    const spend = evaluateSpend(state, cfg, new Date(now));
    // watchdog：lastWakeAt 起静默超 2×硬超时 → 合成唤醒（不复活暂停态——paused 已在上面返回）
    if (state.lastWakeAt > 0 && now - state.lastWakeAt > cfg.wakeTimeoutMs * 2) {
        return { fire: true, trigger: 'watchdog', reason: 'watchdog silence' };
    }
    if (isQuietHour(new Date(now), cfg)) {
        return { fire: false, trigger: 'none', reason: 'quiet hours' };
    }
    if (spend === 'hard') {
        return { fire: false, trigger: 'none', reason: 'spend hard cap' };
    }
    if (state.wakeAt > 0 && now >= state.wakeAt) {
        return { fire: true, trigger: 'spontaneous', reason: spend === 'soft' ? 'due (soft: fast model)' : 'due' };
    }
    return { fire: false, trigger: 'none', reason: 'not due' };
}
/** 唤醒完成后的下次自发唤醒时刻（rm-then-dispatch：由入口原子写回 state.wakeAt）。 */
export function scheduleNextSpontaneous(state, cfg, now, outcome) {
    const next = advanceAfterWake(state, outcome, cfg);
    return now + nextDelayMs(cfg, next.backoffLevel);
}
/** 唤醒 run 成本核算（token × 单价；纯函数）。 */
export function costUsd(cfg, tokensIn, tokensOut) {
    return (tokensIn / 1e6) * cfg.priceUsdPerMTokIn + (tokensOut / 1e6) * cfg.priceUsdPerMTokOut;
}
