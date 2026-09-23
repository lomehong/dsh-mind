/**
 * dsh-mind HTTP 面（心智主页 + 插件页速览共用）。
 *
 * 门禁纪律（LESSONS #11：插件自有 HTTP 路由不在上游认证围栏内）：
 * - 全部路由 sameOrigin 门禁（带 Origin 且跨源 → 403；先例：dsh-memory v0.2.6 整改）；
 * - 写操作（/say、/kill）额外要求启动时随机生成的校验键（x-mind-key 自定义头，
 *   跨站表单/脚本无法携带——先例：dsh-memory 的同类写门禁）。
 *
 * 路由：
 * - GET  /dsh-mind/token   下发写门禁键（sameOrigin；供内置客户端一次性取用）
 * - GET  /dsh-mind/status  在场感状态（v3：+静音时段/下次唤醒/待批数/反应队列）
 * - GET  /dsh-mind/timeline 时间线尾部（生活流数据源；n 上限 200）
 * - POST /dsh-mind/kill    休息开关（stopped: boolean）
 * - POST /dsh-mind/say     主人留言（text → message_in 落时间线 + 反应性唤醒）
 */
import { randomBytes } from 'node:crypto';
import { evaluateSpend, isQuietHour } from "./scheduler.js";
import { readTail } from "./timeline.js";
import { buildWakePrompt, DEFAULT_PROMPT_BLOCKS } from "./wake-prompt.js";
import { loadPromptOverrides, PROMPT_BLOCK_KEYS, PROMPT_BLOCK_LABELS, resolveWakePromptBlocks, savePromptOverrides } from "./prompts.js";
/** 写门禁键：每次进程启动随机生成，不落盘（重启即换；先例 dsh-memory）。 */
const gateKey = randomBytes(16).toString('hex');
function sameOrigin(req) {
    const origin = req.headers.origin;
    if (origin === undefined)
        return true; // 同源/宿主内调用不带 Origin
    const host = req.headers.host;
    if (typeof host !== 'string')
        return false;
    try {
        return new URL(String(origin)).host === host;
    }
    catch {
        return false;
    }
}
function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
function readBody(req) {
    return new Promise(resolve => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > 16 * 1024) {
                req.destroy();
                resolve('');
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => resolve(chunks.map(c => c.toString('utf8')).join('')));
        req.on('error', () => resolve(''));
    });
}
/** 写操作门禁：sameOrigin + 随机键双闸。 */
function writeGate(req, res) {
    if (!sameOrigin(req)) {
        json(res, 403, { ok: false, error: 'cross-origin denied' });
        return false;
    }
    if (req.headers['x-mind-key'] !== gateKey) {
        json(res, 401, { ok: false, error: '缺少或无效的校验键（x-mind-key）' });
        return false;
    }
    return true;
}
export function registerPanelApi(web, deps) {
    web.register({
        kind: 'exact',
        path: '/dsh-mind/token',
        handler: (req, res) => {
            if (!sameOrigin(req))
                return json(res, 403, { ok: false, error: 'cross-origin denied' });
            if (req.method !== 'GET')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            json(res, 200, { ok: true, key: gateKey });
        },
    });
    web.register({
        kind: 'exact',
        path: '/dsh-mind/status',
        handler: (req, res) => {
            if (!sameOrigin(req))
                return json(res, 403, { ok: false, error: 'cross-origin denied' });
            if (req.method !== 'GET')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            const cfg = deps.getConfig();
            const st = deps.getState();
            const { steps } = readTail(10);
            const quiet = cfg.quietHours;
            json(res, 200, {
                ok: true,
                version: 3,
                enabled: cfg.enabled,
                stoppedByMaster: st.stoppedByMaster,
                running: deps.isRunning(),
                backoffLevel: st.backoffLevel,
                wakeAt: st.wakeAt,
                lastWakeAt: st.lastWakeAt,
                spend: {
                    date: st.spend.date,
                    usedUsd: Math.round(st.spend.usedUsd * 10000) / 10000,
                    softCapUsd: cfg.spendSoftCapUsd,
                    hardCapUsd: cfg.spendHardCapUsd,
                },
                spendLevel: evaluateSpend(st, cfg, new Date()),
                pending: deps.reactiveQueued(), // 正在排队等 TA 处理的观察数
                pendingApprovals: deps.pendingApprovals(),
                quiet: {
                    enabled: quiet.enabled,
                    active: quiet.enabled && isQuietHour(new Date(), cfg),
                    start: quiet.start,
                    end: quiet.end,
                    tz: quiet.tz,
                },
                tail: steps.map(s => ({
                    seq: s.seq, ts: s.ts, type: s.type, source: s.source,
                    content: s.content.length > 160 ? `${s.content.slice(0, 157)}…` : s.content,
                    fn: s.fn,
                })),
            });
        },
    });
    web.register({
        kind: 'exact',
        path: '/dsh-mind/kill',
        handler: (req, res) => {
            if (req.method !== 'POST')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            if (!writeGate(req, res))
                return;
            void (async () => {
                try {
                    const body = JSON.parse(await readBody(req));
                    if (typeof body.stopped !== 'boolean')
                        return json(res, 400, { ok: false, error: 'stopped 必须为 boolean' });
                    deps.setStoppedByMaster(body.stopped);
                    json(res, 200, { ok: true, stopped: body.stopped });
                }
                catch (e) {
                    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
                }
            })();
        },
    });
    web.register({
        kind: 'exact',
        path: '/dsh-mind/say',
        handler: (req, res) => {
            if (req.method !== 'POST')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            if (!writeGate(req, res))
                return;
            void (async () => {
                try {
                    const body = JSON.parse(await readBody(req));
                    const text = typeof body.text === 'string' ? body.text.trim() : '';
                    if (text.length === 0)
                        return json(res, 400, { ok: false, error: '想说的话不能为空' });
                    if (text.length > 2000)
                        return json(res, 400, { ok: false, error: '一次最多说 2000 字' });
                    deps.say(text);
                    json(res, 200, { ok: true });
                }
                catch (e) {
                    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
                }
            })();
        },
    });
    web.register({
        kind: 'exact',
        path: '/dsh-mind/timeline',
        handler: (req, res) => {
            if (!sameOrigin(req))
                return json(res, 403, { ok: false, error: 'cross-origin denied' });
            if (req.method !== 'GET')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            const n = Math.min(200, Math.max(1, Number(url.searchParams.get('n') ?? 50) || 50));
            const steps = readTail(n).steps;
            json(res, 200, { ok: true, steps });
        },
    });
    // 提示词调教面：GET=默认+覆盖+骨架预览；PUT=写覆盖层（null/缺省键=恢复默认）
    web.register({
        kind: 'exact',
        path: '/dsh-mind/prompts',
        handler: (req, res) => {
            if (!sameOrigin(req))
                return json(res, 403, { ok: false, error: 'cross-origin denied' });
            const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            if (req.method === 'GET') {
                const overrides = loadPromptOverrides();
                const current = resolveWakePromptBlocks(overrides);
                // 骨架预览：静态四块的组装形态（不含时间线等动态数据——那是每次唤醒的运行时上下文）
                const composed = buildWakePrompt({
                    identityName: '分身', tail: [], now: new Date(),
                }, current);
                const blocks = PROMPT_BLOCK_KEYS.map(key => ({
                    key,
                    label: PROMPT_BLOCK_LABELS[key],
                    default: DEFAULT_PROMPT_BLOCKS[key],
                    current: current[key],
                    overridden: overrides[key] !== undefined,
                }));
                return json(res, 200, { ok: true, blocks, composed });
            }
            if (req.method !== 'PUT')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            if (!writeGate(req, res))
                return;
            void (async () => {
                try {
                    const body = JSON.parse(await readBody(req));
                    const incoming = body.blocks ?? body;
                    const overrides = loadPromptOverrides();
                    for (const key of PROMPT_BLOCK_KEYS) {
                        const v = incoming[key];
                        if (v === null || v === undefined || (typeof v === 'string' && v.trim() === ''))
                            delete overrides[key];
                        else if (typeof v === 'string')
                            overrides[key] = v.slice(0, 20000);
                        else
                            return json(res, 400, { ok: false, error: `${key} 必须为字符串或 null` });
                    }
                    savePromptOverrides(overrides);
                    json(res, 200, { ok: true, overrides });
                }
                catch (e) {
                    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
                }
            })();
        },
    });
}
