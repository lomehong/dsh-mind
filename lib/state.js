/** 调度状态持久化：run/state.json（tmp+rename 原子写，0600）。 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mindHome } from "./config.js";
export const STATE_DEFAULT = {
    backoffLevel: 0,
    emptiesAtLevel: 0,
    wakeAt: 0,
    lastWakeAt: 0,
    stoppedByMaster: false,
    lastSeq: 0,
    pendingApprovals: 0,
    spend: { date: '1970-01-01', usedUsd: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0 },
    reactive: { windowStart: 0, count: 0 },
};
export function statePath() {
    return join(mindHome(), 'run', 'state.json');
}
export function loadState() {
    try {
        const raw = JSON.parse(readFileSync(statePath(), 'utf8'));
        const base = { ...STATE_DEFAULT, ...raw };
        base.spend = { ...STATE_DEFAULT.spend, ...(raw.spend ?? {}) };
        base.reactive = { ...STATE_DEFAULT.reactive, ...(raw.reactive ?? {}) };
        return base;
    }
    catch {
        return {
            ...STATE_DEFAULT,
            spend: { ...STATE_DEFAULT.spend },
            reactive: { ...STATE_DEFAULT.reactive },
        };
    }
}
export function saveState(state) {
    const file = statePath();
    mkdirSync(join(file, '..'), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 1)}\n`, { encoding: 'utf8' });
    renameSync(tmp, file);
}
