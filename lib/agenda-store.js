/**
 * P2 跟进议程持久化：dsh-mind/agenda.json（tmp+rename 原子写，同 state.ts 先例）。
 * 纯函数在 agenda.ts；此处只做 IO 与容错（坏文件回落空状态，宁缺毋错）。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mindHome } from "./config.js";
import { AGENDA_SCHEMA_VERSION, emptyAgendaState } from "./agenda.js";
export function agendaPath() {
    return join(mindHome(), 'agenda.json');
}
export function loadAgendaState() {
    try {
        const raw = JSON.parse(readFileSync(agendaPath(), 'utf8'));
        if (raw.schemaVersion !== AGENDA_SCHEMA_VERSION || !Array.isArray(raw.items))
            return emptyAgendaState();
        const base = emptyAgendaState();
        const items = raw.items.filter(i => i !== null && typeof i === 'object'
            && typeof i.id === 'string' && typeof i.what === 'string'
            && Array.isArray(i.evidence) && typeof i.expectedResult === 'string'
            && (i.status === 'proposed' || i.status === 'confirmed' || i.status === 'tracking' || i.status === 'done' || i.status === 'rejected'));
        const intent = raw.intent && typeof raw.intent === 'object'
            ? { ...base.intent, ...raw.intent, revisions: Number(raw.intent.revisions) || 0 }
            : base.intent;
        return { schemaVersion: AGENDA_SCHEMA_VERSION, items, intent };
    }
    catch {
        return emptyAgendaState();
    }
}
export function saveAgendaState(state) {
    mkdirSync(mindHome(), { recursive: true });
    const tmp = `${agendaPath()}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tmp, agendaPath());
}
