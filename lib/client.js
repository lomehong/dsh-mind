window.__ModuleLoader__.load({
	id: "@dsh-extra/dsh-mind",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react13 = require("react");

// src/narrate.ts
var FN_LABELS = {
  think: "我在想",
  act: "我在办一件事",
  share: "我想告诉你",
  learn: "我记住了这件事",
  recall: "我在回想",
  goals: "我在盘算接下来的安排",
  idle: "我歇了一会儿"
};
function isIdleWake(s2) {
  if (s2.type !== "wake") return false;
  if (s2.fn === "idle") return true;
  const text = `${s2.final ?? ""}
${s2.content}`;
  return /(^|\n)\s*本拍\s*idle|FINAL\s*=\s*"?\[idle\]|^\[?\s*idle\b|Idle\s*—/i.test(text);
}
function narrateStep(s2) {
  const base = { seq: s2.seq, ts: s2.ts };
  const clip = (t, n = 400) => t.length > n ? `${t.slice(0, n - 1)}…` : t;
  switch (s2.type) {
    case "message_in": {
      const from = s2.refs?.from ?? s2.source;
      if (s2.source === "世界观察" || from === "世界") {
        return { ...base, kind: "moment", title: `世界有动静（${s2.source}）`, body: clip(s2.content) };
      }
      return { ...base, kind: "you", title: `你说（来自 ${from}）`, body: clip(s2.content) };
    }
    case "message_out":
      return { ...base, kind: "mind", title: "我对你说", body: clip(s2.content) };
    case "wake": {
      if (isIdleWake(s2)) {
        return { ...base, kind: "rest", title: FN_LABELS.idle, tone: "subtle" };
      }
      const fn = s2.fn ?? "think";
      const label = FN_LABELS[fn] ?? "我在想";
      const parts = [];
      if (s2.trigger !== void 0) parts.push(s2.trigger);
      if (s2.usage !== void 0 && (s2.usage.tokensIn > 0 || s2.usage.tokensOut > 0)) {
        parts.push(`${s2.usage.tokensIn}/${s2.usage.tokensOut} tok · $${s2.usage.costUsd.toFixed(4)}`);
      }
      const detail = parts.length > 0 ? parts.join(" · ") : void 0;
      return {
        ...base,
        kind: "moment",
        title: `${label}…`,
        body: clip(s2.final ?? s2.content),
        ...detail !== void 0 ? { detail } : {}
      };
    }
    case "thought":
      return { ...base, kind: "moment", title: "我有个念头", body: clip(s2.content) };
    case "observation":
      return { ...base, kind: "moment", title: "我注意到", body: clip(s2.content) };
    case "task":
      return { ...base, kind: "moment", title: "我接了一件活", body: clip(s2.content) };
    case "idle":
      return { ...base, kind: "rest", title: "我歇了一会儿", tone: "subtle" };
    case "error":
      return { ...base, kind: "break", title: "有个念头断了，醒来会接着排", body: clip(s2.content, 200), tone: "warn" };
    default:
      return { ...base, kind: "moment", title: "……", body: clip(s2.content) };
  }
}
function coalesceRests(steps) {
  const out = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (step.kind === "rest" && last !== void 0 && last.kind === "rest") {
      const fold = last.fold ?? { count: 1, fromTs: last.ts, toTs: last.ts, items: [last] };
      fold.count += 1;
      fold.toTs = step.ts;
      fold.items.push(step);
      out[out.length - 1] = { ...last, seq: step.seq, title: `我歇了一会儿（${fold.count} 次空醒）`, fold };
      continue;
    }
    out.push(step);
  }
  return out;
}
function presenceLine(s2, now = Date.now()) {
  if (s2.stoppedByMaster) return "我在休息——是你让我停的，需要时叫我";
  if (!s2.enabled) return "我在沉睡（总开关未开）";
  if (s2.quiet?.active === true) return `我睡着了（${s2.quiet.start}–${s2.quiet.end}），醒来会继续`;
  if (s2.running) return "我正在想事情……";
  if (s2.spend !== void 0 && s2.spend.usedUsd >= s2.spend.hardCapUsd) return "我今天想得够多了，在省着用（明天继续）";
  if ((s2.openAsks ?? 0) > 0) return `有件事卡住了，等你给${s2.openAskWhat !== void 0 ? `：${s2.openAskWhat}` : ""}`;
  if ((s2.pending ?? 0) > 0) return "我刚收到你的话，正在准备回应……";
  if (s2.wakeAt > now) {
    const mins = Math.round((s2.wakeAt - now) / 6e4);
    return mins >= 1 ? `我在安静一会儿，约 ${mins} 分钟后自己醒` : "我马上就醒";
  }
  return "我在";
}
function greeting(now) {
  const h = now.getHours();
  if (h < 5) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  if (h < 23) return "晚上好";
  return "夜深了";
}
function beingGlyph(s2) {
  if (s2 === void 0) return { glyph: "🌤", label: "" };
  if (s2.stoppedByMaster || s2.enabled === false) return { glyph: "⏸", label: "停着" };
  if (s2.quiet?.active === true) return { glyph: "🌙", label: "睡着" };
  if ((s2.pending ?? 0) > 0) return { glyph: "💬", label: "刚收到你的话" };
  if (s2.running) {
    const fn2 = s2.tail?.[0]?.fn ?? s2.tail?.[0]?.type ?? "";
    if (fn2 === "learn") return { glyph: "📖", label: "在查资料" };
    if (fn2 === "act") return { glyph: "⌨️", label: "在干活" };
    if (fn2 === "share") return { glyph: "📨", label: "在投递" };
    if (fn2 === "recall") return { glyph: "🔎", label: "在回忆" };
    if (fn2 === "think") return { glyph: "💭", label: "在想事" };
    return { glyph: "⌨️", label: "在干活" };
  }
  const fn = s2.tail?.[0]?.fn ?? s2.tail?.[0]?.type ?? "";
  if (fn === "learn") return { glyph: "📖", label: "刚读完资料" };
  if (fn === "goals") return { glyph: "🎯", label: "在理目标" };
  if (fn === "ask") return { glyph: "🙋", label: "有事等你给" };
  return { glyph: "🌤", label: "醒着" };
}
function beingRhythm(s2) {
  if (s2 === void 0) return 1;
  if (s2.spendLevel === "hard") return 1.15;
  const lvl = Math.max(0, Math.min(10, Number(s2.backoffLevel ?? 0) || 0));
  return 1 + lvl * 0.08;
}
function beingDim(s2) {
  if (s2 === void 0) return 1;
  if (s2.quiet?.active === true) return 0.55;
  const lvl = Math.max(0, Math.min(10, Number(s2.backoffLevel ?? 0) || 0));
  return 1 - Math.min(0.3, lvl * 0.03);
}
function beingMood(s2) {
  if (s2 === void 0) return "awake";
  if (s2.stoppedByMaster || !s2.enabled) return "stopped";
  if (s2.quiet?.active === true) return "asleep";
  if ((s2.pending ?? 0) > 0) return "attentive";
  if (s2.running) return "thinking";
  return "awake";
}

// src/client/api.ts
var import_react = require("react");
var keyPromise;
function writeKey(refetch = false) {
  if (refetch || keyPromise === void 0) {
    keyPromise = fetch("/dsh-mind/token").then((r) => r.json()).then((b) => {
      if (b.ok === true && typeof b.key === "string") return b.key;
      throw new Error("获取校验键失败");
    }).catch((e) => {
      keyPromise = void 0;
      throw e;
    });
  }
  return keyPromise;
}
async function postJson(path, body, retry = true) {
  try {
    const key = await writeKey();
    const resp = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mind-key": key },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (resp.status === 401 && retry) {
      writeKey(true);
      return postJson(path, body, false);
    }
    return data;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
function sayToMind(text) {
  return postJson("/dsh-mind/say", { text });
}
function setMindStopped(stopped) {
  return postJson("/dsh-mind/kill", { stopped });
}
async function fetchStatus() {
  const resp = await fetch("/dsh-mind/status");
  return await resp.json();
}
async function fetchFeed(n = 200, beforeSeq) {
  const qs = beforeSeq !== void 0 ? `&beforeSeq=${beforeSeq}` : "";
  const resp = await fetch(`/dsh-mind/timeline?n=${n}${qs}`);
  const body = await resp.json();
  return body.steps ?? [];
}
async function fetchGoals() {
  const resp = await fetch("/dsh-mind/goals");
  const body = await resp.json();
  return body.goals ?? [];
}
async function fetchMissions() {
  const resp = await fetch("/dsh-mind/missions");
  const body = await resp.json();
  return body.missions ?? "";
}
function saveMissions(text) {
  return postJson("/dsh-mind/missions", { text });
}
async function fetchTimelineMeta() {
  const resp = await fetch("/dsh-mind/timeline?meta=1");
  const body = await resp.json();
  return body.steps ?? [];
}
async function fetchRange(fromMs, toMs) {
  const resp = await fetch(`/dsh-mind/timeline?fromTs=${fromMs}&toTs=${toMs}`);
  const body = await resp.json();
  return body.steps ?? [];
}
async function fetchAsks() {
  const resp = await fetch("/dsh-mind/asks");
  const body = await resp.json();
  return Array.isArray(body.asks) ? body.asks : [];
}
async function fetchPrompts() {
  const resp = await fetch("/dsh-mind/prompts");
  return await resp.json();
}
function savePrompts(blocks) {
  return postJson("/dsh-mind/prompts", { blocks });
}
function usePoll(fn, pollMs) {
  const [data, setData] = (0, import_react.useState)();
  const [error, setError] = (0, import_react.useState)();
  const [tick, setTick] = (0, import_react.useState)(0);
  const fnRef = (0, import_react.useRef)(fn);
  fnRef.current = fn;
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    const load = () => {
      fnRef.current().then((d) => {
        if (!cancelled) {
          setData(d);
          setError(void 0);
        }
      }).catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    };
    void load();
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs, tick]);
  return { data, error, refresh: (0, import_react.useCallback)(() => setTick((t) => t + 1), []) };
}

// src/client/Being.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var MOODS = {
  awake: { rgb: "79,179,169", breath: "6.5s", swirl: 0.12, dim: 1 },
  thinking: { rgb: "83,200,232", breath: "2.6s", swirl: 0.8, dim: 1 },
  attentive: { rgb: "232,185,83", breath: "3.4s", swirl: 0.35, dim: 1 },
  asleep: { rgb: "91,111,181", breath: "11s", swirl: 0, dim: 0.55 },
  stopped: { rgb: "138,143,152", breath: "13s", swirl: 0, dim: 0.45 }
};
var kfInjected = false;
function injectKeyframes() {
  if (kfInjected) return;
  kfInjected = true;
  const el = document.createElement("style");
  el.textContent = `
@keyframes dsh-mind-breathe { from { transform: scale(.93); } to { transform: scale(1.07); } }
@keyframes dsh-mind-spin { to { transform: rotate(360deg); } }
@keyframes dsh-mind-ripple { from { transform: scale(1); opacity: .5; } to { transform: scale(2.2); opacity: 0; } }
@keyframes dsh-mind-chest { from { transform: scaleY(1); } to { transform: scaleY(1.06); } }
@keyframes dsh-mind-floatup { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, -30px); opacity: 0; } }`;
  document.head.appendChild(el);
}
function FloatFx({ kind, seq, size }) {
  const emoji = kind === "hearts" ? "💞" : kind === "coffee" ? "☕" : "😵";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      style: {
        position: "absolute",
        top: -size * 0.18,
        left: "50%",
        fontSize: Math.max(14, size * 0.22),
        pointerEvents: "none",
        animation: "dsh-mind-floatup 1.6s ease-out forwards"
      },
      children: emoji
    },
    seq
  );
}
function Being({ size, status, theater, fx, silhouette = true, ripple, style }) {
  injectKeyframes();
  const input = theater ?? status;
  const mood = beingMood(status);
  const m = MOODS[mood];
  const showRipple = ripple ?? mood === "attentive";
  const g = beingGlyph(input);
  const rhythm = beingRhythm(input);
  const dimScale = beingDim(input);
  const breathSec = Math.round(parseFloat(m.breath) * rhythm * 10) / 10;
  const breath = `dsh-mind-breathe ${breathSec}s ease-in-out infinite alternate`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "relative", width: size, height: size, borderRadius: "50%", animation: breath, ...style }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      left: -size * 0.3,
      top: -size * 0.3,
      width: size * 1.6,
      height: size * 1.6,
      borderRadius: "50%",
      pointerEvents: "none",
      opacity: m.dim * dimScale,
      animation: breath,
      background: `radial-gradient(circle, rgba(${m.rgb},.42) 0%, rgba(${m.rgb},0) 68%)`,
      filter: `blur(${Math.max(5, Math.round(size * 0.09))}px)`
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      overflow: "hidden",
      opacity: m.dim * dimScale,
      background: `radial-gradient(circle at 35% 30%, rgba(${m.rgb},1) 0%, rgb(${m.rgb}) 52%, rgba(${m.rgb},.55) 100%)`,
      boxShadow: `0 0 ${Math.round(size * 0.34)}px rgba(${m.rgb},.5), inset 0 0 ${Math.round(size * 0.22)}px rgba(255,255,255,.18)`
    }, children: [
      silhouette && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "svg",
        {
          style: { position: "absolute", left: "17%", top: "15%", width: "66%", height: "73%", opacity: 0.52 },
          viewBox: "0 0 100 100",
          "aria-hidden": true,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { fill: "rgba(8,12,18,.7)", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "50", cy: "29", r: "11.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { style: { animation: `dsh-mind-chest ${m.breath} ease-in-out infinite alternate`, transformOrigin: "50% 100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M50 44 C37 44 28.5 55 26.5 68 C40 75 60 75 73.5 68 C71.5 55 63 44 50 44 Z" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M23 73 C38 65.5 62 65.5 77 73 C67.5 82 32.5 82 23 73 Z" })
          ] })
        }
      ),
      m.swirl > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        position: "absolute",
        left: "10%",
        top: "10%",
        width: "80%",
        height: "80%",
        borderRadius: "50%",
        opacity: m.swirl,
        background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,.4) 18%, transparent 42%)",
        animation: "dsh-mind-spin 3s linear infinite"
      } })
    ] }),
    g.label !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        role: "status",
        style: {
          position: "absolute",
          left: "50%",
          bottom: -size * 0.14,
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: Math.max(11, size * 0.1),
          lineHeight: 1.5,
          padding: "1px 8px",
          borderRadius: 999,
          background: "var(--dsw-alias-bg-overlay, rgba(24,26,30,.92))",
          border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))",
          color: "var(--dsw-alias-label-secondary, #bbb)"
        },
        children: [
          g.glyph,
          " ",
          g.label
        ]
      }
    ),
    showRipple && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      left: "-6%",
      top: "-6%",
      width: "112%",
      height: "112%",
      borderRadius: "50%",
      pointerEvents: "none",
      border: `2px solid rgb(${m.rgb})`,
      animation: "dsh-mind-ripple 1.9s ease-out infinite"
    } }),
    fx !== void 0 && fx.seq > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FloatFx, { kind: fx.kind, seq: fx.seq, size })
  ] });
}

// src/client/Companion.tsx
var import_react4 = require("react");

// src/client/Composer.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
function Composer({ status, refresh, compact }) {
  const [text, setText] = (0, import_react2.useState)("");
  const [sending, setSending] = (0, import_react2.useState)(false);
  const [note, setNote] = (0, import_react2.useState)();
  const stopped = status !== void 0 && (status.stoppedByMaster || !status.enabled);
  const send = () => {
    const t = text.trim();
    if (t === "" || sending) return;
    setSending(true);
    setNote(void 0);
    void sayToMind(t).then((r) => {
      setSending(false);
      if (r.ok) {
        setText("");
        refresh();
      } else {
        setNote(r.error ?? "没说出去，再试一次");
      }
    });
  };
  if (stopped) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: compact ? "8px 10px" : "10px 14px",
      border: "1px solid var(--dsw-alias-border-l1, #333)",
      borderRadius: 12,
      color: "var(--dsw-alias-label-secondary, #888)",
      fontSize: 13
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { flex: 1 }, children: "TA 正在休息。" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            void setMindStopped(false).then(refresh);
          },
          style: { padding: "5px 14px", cursor: "pointer", borderRadius: 8 },
          children: "叫醒 TA"
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      padding: compact ? "6px 6px 6px 12px" : "8px 8px 8px 14px",
      border: "1px solid var(--dsw-alias-border-l1, #333)",
      borderRadius: 12,
      background: "var(--dsw-alias-bg-layer-1, transparent)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "textarea",
        {
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          },
          rows: 1,
          placeholder: "对 TA 说点什么…（TA 听到就会回应）",
          style: { flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", color: "inherit", fontSize: 13, lineHeight: "20px", maxHeight: 96 }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          disabled: text.trim() === "" || sending,
          onClick: send,
          style: {
            padding: "6px 16px",
            cursor: text.trim() === "" || sending ? "default" : "pointer",
            borderRadius: 8,
            border: "none",
            color: "#06231f",
            fontWeight: 600,
            background: text.trim() === "" || sending ? "rgba(79,179,169,.35)" : "rgb(79,179,169)",
            transition: "background .15s"
          },
          children: sending ? "…" : "告诉 TA"
        }
      )
    ] }),
    note !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "var(--dsw-alias-state-error-primary, #c0392b)", fontSize: 12, marginTop: 4 }, children: note })
  ] });
}

// src/client/Phone.tsx
var import_react3 = require("react");

// src/client/format.tsx
var fmtUsd = (v) => `$${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)}`;
var fmtClock = (ts) => new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

// src/client/Phone.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var SUB = "var(--dsw-alias-label-secondary, #999)";
var s = {
  phone: {
    width: 264,
    maxHeight: 460,
    display: "flex",
    flexDirection: "column",
    padding: "12px 12px 8px",
    borderRadius: 22,
    background: "var(--dsw-alias-bg-overlay, rgba(24,26,30,.97))",
    border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))",
    boxShadow: "0 10px 34px rgba(0,0,0,.4)",
    color: "var(--dsw-alias-label-primary, #eee)"
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 13, fontWeight: 600 },
  close: { border: "none", background: "transparent", color: SUB, fontSize: 14, cursor: "pointer", padding: "0 2px" },
  tabs: { display: "flex", gap: 4, marginBottom: 8 },
  tab: (on) => ({
    flex: 1,
    textAlign: "center",
    padding: "4px 0",
    fontSize: 11.5,
    cursor: "pointer",
    borderRadius: 8,
    border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.22))",
    background: on ? "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.14))" : "transparent",
    color: on ? "var(--dsw-alias-label-primary, #eee)" : SUB
  }),
  body: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 },
  row: { padding: "7px 8px", borderRadius: 10, border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.18))", fontSize: 12 },
  what: { fontWeight: 500, lineHeight: 1.45 },
  meta: { fontSize: 10.5, color: "var(--dsw-alias-label-tertiary, #888)", marginTop: 2 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    resize: "none",
    padding: "6px 8px",
    marginTop: 6,
    borderRadius: 8,
    border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))",
    background: "var(--dsw-alias-bg-layer-1, rgba(0,0,0,.25))",
    color: "var(--dsw-alias-label-primary, #eee)",
    fontSize: 12
  },
  btn: { padding: "4px 10px", border: "none", borderRadius: 8, background: "var(--dsw-alias-state-business-primary, #4a6fa5)", color: "#fff", fontSize: 11.5, cursor: "pointer" },
  btnGhost: { padding: "4px 10px", border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3))", borderRadius: 8, background: "transparent", color: SUB, fontSize: 11.5, cursor: "pointer" },
  col: { fontSize: 11, color: SUB, margin: "6px 0 2px", fontWeight: 600 },
  task: { fontSize: 11.5, padding: "3px 0", borderBottom: "1px dashed var(--dsw-alias-border-l1, rgba(128,128,128,.14))", lineHeight: 1.5 },
  empty: { fontSize: 12, color: SUB, padding: "10px 0" }
};
function Phone({ onClose, onGoTodos }) {
  const [tab, setTab] = (0, import_react3.useState)("asks");
  const [asks, setAsks] = (0, import_react3.useState)();
  const [board, setBoard] = (0, import_react3.useState)();
  const [boardErr, setBoardErr] = (0, import_react3.useState)(false);
  const [feed, setFeed] = (0, import_react3.useState)();
  const [msg, setMsg] = (0, import_react3.useState)("");
  const loadAsks = (0, import_react3.useCallback)(async () => {
    try {
      setAsks(await fetchAsks());
    } catch {
      setAsks([]);
    }
  }, []);
  const loadBoard = (0, import_react3.useCallback)(async () => {
    try {
      const r = await fetch("/dsh-task-board/state");
      const b = await r.json();
      const tasks = (b.state?.tasks ?? []).filter((t) => t.archived !== true).map((t) => ({ title: t.title ?? "(未命名)", column: t.column ?? "?" }));
      setBoard(tasks);
    } catch {
      setBoard([]);
    }
  }, []);
  const loadLife = (0, import_react3.useCallback)(async () => {
    try {
      const feed2 = await fetchFeed(40);
      setFeed(coalesceRests(feed2.slice(0, 14).map(narrateStep)));
    } catch {
      setFeed([]);
    }
  }, []);
  (0, import_react3.useEffect)(() => {
    void loadAsks();
    void loadBoard();
    void loadLife();
  }, [loadAsks, loadBoard, loadLife]);
  const done = (m) => {
    setMsg(m);
    void loadAsks();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { ...s.phone, marginLeft: "auto", marginRight: 14 }, role: "dialog", "aria-label": "分身的手机", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: s.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: s.title, children: "📱 分身的手机" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", "aria-label": "收起手机", style: s.close, onClick: onClose, children: "×" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: s.tabs, children: ["asks", "board", "life"].map((t) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: s.tab(t === tab), onClick: () => {
      setTab(t);
    }, children: t === "asks" ? "请求单" : t === "board" ? "看板" : "生活" }, t)) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: s.body, children: [
      tab === "asks" && ((asks ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: s.empty, children: "请求单是空的——TA 没有卡住的事。" }) : (asks ?? []).map((a) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AskItem, { ask: a, onDone: (m) => {
        setMsg(m);
        void loadAsks();
      } }, a.id))),
      tab === "board" && ((board ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: s.empty, children: "看板暂无进行中的任务。" }) : (board ?? []).map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: s.task, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "var(--dsw-alias-state-business-primary, #4a6fa5)" }, children: "▦" }),
        " ",
        t.title
      ] }, `${t.title}-${i}`))),
      tab === "life" && (feed ?? []).map((n) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 11.5, alignItems: "baseline", padding: "3px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: SUB, whiteSpace: "nowrap", fontSize: 10.5 }, children: fmtClock(n.ts) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: n.kind === "you" ? `你说：${n.body ?? ""}` : n.title })
      ] }, n.seq))
    ] }),
    tab === "asks" && (asks ?? []).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: { ...s.btnGhost, alignSelf: "flex-start" }, onClick: onGoTodos, children: "去数字分身 · 今日待办逐条处理 →" }),
    msg !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, color: "var(--dsw-alias-state-success-primary, #2A9D8F)", marginTop: 6 }, children: msg })
  ] });
}

// src/client/nav.ts
var TWIN_TAB_LABEL = "数字分身";
var ASKS_FOCUS_EVENT = "dsh-twin:focus-todo";
function openTwinTodos() {
  try {
    const strip = document.querySelector("[data-conversation-tabs]");
    const buttons = strip !== null ? Array.from(strip.querySelectorAll('button[role="tab"]')) : Array.from(document.querySelectorAll('button[role="tab"]'));
    const target = buttons.find((b) => (b.textContent ?? "").trim() === TWIN_TAB_LABEL);
    if (target !== void 0) target.click();
  } catch {
  }
  try {
    window.dispatchEvent(new CustomEvent(ASKS_FOCUS_EVENT));
  } catch {
  }
}

// src/client/Companion.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var POLL_STATUS_MS = 25e3;
var POLL_FEED_MS = 2e4;
var SUB2 = "var(--dsw-alias-label-secondary, #888)";
var WARN = "var(--dsw-alias-state-warn-primary, #b8860b)";
function AskBadge({ count }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "span",
    {
      role: "button",
      "aria-label": `${count} 件事等你答复`,
      title: `${count} 件事等你给——点击去逐条答复`,
      onClick: (e) => {
        e.stopPropagation();
        openTwinTodos();
      },
      style: {
        position: "absolute",
        top: -3,
        right: -5,
        zIndex: 1,
        minWidth: 19,
        height: 19,
        padding: "0 5px",
        borderRadius: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: WARN,
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: "19px",
        border: "1.5px solid var(--dsw-alias-bg-overlay, rgba(24,26,30,.97))",
        boxShadow: "0 1px 5px rgba(0,0,0,.35)",
        cursor: "pointer",
        userSelect: "none"
      },
      children: count > 9 ? "9+" : count
    }
  );
}
function Section({ summary, children, defaultOpen = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { open: defaultOpen, style: { borderTop: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.18))" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "summary",
      {
        style: {
          cursor: "pointer",
          fontSize: 12.5,
          color: "var(--dsw-alias-label-secondary, #aaa)",
          userSelect: "none",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 2px"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.color = "var(--dsw-alias-label-primary, #eee)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.color = "var(--dsw-alias-label-secondary, #aaa)";
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 9, opacity: 0.8 }, children: "▶" }),
          summary
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { paddingBottom: 8 }, children })
  ] });
}
function CompanionLayer() {
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [phone, setPhone] = (0, import_react4.useState)(false);
  const [fx, setFx] = (0, import_react4.useState)({ kind: "hearts", seq: 0 });
  const [petLine, setPetLine] = (0, import_react4.useState)("");
  const status = usePoll(fetchStatus, POLL_STATUS_MS);
  const st = status.data;
  const asks = st?.openAsks ?? 0;
  const asleep = st?.quiet?.active === true;
  const pet = (kind) => {
    setFx({ kind, seq: fx.seq + 1 });
    if (asleep && kind === "poke") setPetLine("嘘——睡着呢。");
    else if (kind === "hearts") setPetLine("嗯～被摸到了。");
    else if (kind === "coffee") setPetLine("醒脑中——");
    else setPetLine("哎哟。");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { position: "fixed", right: 18, bottom: 18, zIndex: 2147483e3, pointerEvents: "none" }, children: [
    open && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
      pointerEvents: "auto",
      position: "relative",
      width: 344,
      marginBottom: 10,
      padding: "14px 14px 10px",
      borderRadius: 16,
      background: "var(--dsw-alias-bg-overlay, rgba(24,26,30,.97))",
      border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))",
      boxShadow: "0 12px 40px rgba(0,0,0,.45)",
      display: "flex",
      flexDirection: "column",
      gap: 10
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          "aria-label": "收起",
          title: "收起",
          onClick: () => setOpen(false),
          style: {
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: SUB2,
            fontSize: 15,
            lineHeight: "24px",
            textAlign: "center",
            cursor: "pointer",
            padding: 0
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.16))";
            e.currentTarget.style.color = "var(--dsw-alias-label-primary, #eee)";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = SUB2;
          },
          children: "×"
        }
      ),
      asks > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${WARN} 40%, transparent)`
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: WARN }, children: [
          "有 ",
          asks,
          " 件事等你给",
          st?.openAskPreview !== void 0 ? `：${st.openAskPreview}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            title: "跳到数字分身 · 今日待办，逐条答复",
            onClick: () => {
              setOpen(false);
              openTwinTodos();
            },
            style: {
              padding: "3px 10px",
              cursor: "pointer",
              borderRadius: 8,
              fontSize: 12,
              flexShrink: 0,
              border: `1px solid color-mix(in srgb, ${WARN} 45%, transparent)`,
              color: WARN,
              background: "transparent",
              whiteSpace: "nowrap"
            },
            children: "去处理 →"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, paddingRight: 22 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "div",
          {
            role: "button",
            "aria-label": "戳一下分身",
            title: "戳 TA 一下",
            onClick: () => pet("poke"),
            style: { cursor: "pointer", borderRadius: "50%", flexShrink: 0 },
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Being, { size: 62, status: st, theater: st, fx })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 14, fontWeight: 600, lineHeight: "20px" }, children: "分身" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #bbb)", lineHeight: "18px", marginTop: 2 }, children: st !== void 0 ? presenceLine(st) : "…" }),
          petLine !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 11.5, color: "var(--dsw-alias-state-success-primary, #2A9D8F)", marginTop: 2 }, children: petLine }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 6, marginTop: 5 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                title: "摸摸头",
                onClick: () => pet("hearts"),
                style: { padding: "1px 8px", fontSize: 11, cursor: "pointer", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))", background: "transparent", color: SUB2 },
                children: "摸摸"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                title: "递一杯咖啡",
                onClick: () => pet("coffee"),
                style: { padding: "1px 8px", fontSize: 11, cursor: "pointer", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))", background: "transparent", color: SUB2 },
                children: "☕"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                type: "button",
                title: "打开分身的手机（请求单/看板/生活速览）",
                onClick: () => setPhone((p) => !p),
                style: { padding: "1px 8px", fontSize: 11, cursor: "pointer", borderRadius: 999, border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.25))", background: "transparent", color: SUB2 },
                children: "📱"
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Composer, { status: st, compact: true, refresh: () => {
        status.refresh();
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Section, { summary: "TA 最近的生活", defaultOpen: true, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 10.5, color: SUB2, margin: "-2px 0 2px" }, children: "安静时空醒约每 30 分钟记一笔（心跳照常每 5 分钟一拍）" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RecentLife, {})
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Section, { summary: "照看 TA", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CareMini, { status: st, refresh: () => {
        status.refresh();
      } }) })
    ] }),
    phone && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { pointerEvents: "auto", position: "relative", marginBottom: 10, display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Phone, { status: st, onClose: () => setPhone(false), onGoTodos: () => {
      setPhone(false);
      openTwinTodos();
    } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { pointerEvents: "auto", display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        role: "button",
        title: st !== void 0 ? presenceLine(st) : "分身（右键打开 TA 的手机）",
        onClick: () => setOpen((o) => !o),
        onContextMenu: (e) => {
          e.preventDefault();
          setPhone((p) => !p);
        },
        style: { position: "relative", cursor: "pointer", padding: 6, borderRadius: "9999px", transition: "transform .18s ease" },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "scale(1)";
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Being, { size: 56, status: st, theater: st }),
          asks > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AskBadge, { count: asks })
        ]
      }
    ) })
  ] });
}
function RecentLife() {
  const feed = usePoll(async () => (await fetchFeed(30)).slice(0, 14), POLL_FEED_MS);
  if (feed.data === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 12, color: SUB2, padding: "6px 0" }, children: "…" });
  }
  if (feed.data.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 12, color: SUB2, padding: "6px 0" }, children: "TA 还没醒过。" });
  }
  const rows = coalesceRests(feed.data.map(narrateStep));
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 7, padding: "8px 0 4px", maxHeight: 260, overflowY: "auto" }, children: rows.map((n) => {
    if (n.kind === "rest" && n.fold !== void 0 && n.fold.count > 1) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("summary", { style: { cursor: "pointer", display: "flex", gap: 8, alignItems: "baseline", color: SUB2, listStyle: "revert" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { whiteSpace: "nowrap", fontSize: 11, fontFamily: "var(--ds-font-family-code, ui-monospace), ui-monospace, monospace" }, children: [
            fmtClock(n.fold.fromTs),
            "~",
            fmtClock(n.fold.toTs)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: n.title })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { padding: "2px 0 2px 14px", display: "flex", flexDirection: "column", gap: 2 }, children: n.fold.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 8, color: SUB2, fontSize: 11 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontFamily: "var(--ds-font-family-code, ui-monospace), ui-monospace, monospace" }, children: fmtClock(item.ts) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.title })
        ] }, item.seq)) })
      ] }) }, n.seq);
    }
    const text = n.kind === "you" ? `你说：${n.body ?? ""}` : n.kind === "rest" ? n.title : `${n.title}${n.body !== void 0 && n.body !== "" ? `：${n.body.slice(0, 60)}` : ""}`;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 12, alignItems: "baseline" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: SUB2, whiteSpace: "nowrap", fontSize: 11, fontFamily: "var(--ds-font-family-code, ui-monospace), ui-monospace, monospace" }, children: fmtClock(n.ts) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: n.kind === "rest" ? SUB2 : n.kind === "you" ? "var(--dsw-alias-label-primary, #eee)" : void 0,
        fontWeight: n.kind === "you" ? 500 : 400
      }, children: text })
    ] }, n.seq);
  }) });
}
function CareMini({ status, refresh }) {
  if (status === void 0) return null;
  const { spend } = status;
  const pct = Math.min(100, Math.round(spend.usedUsd / Math.max(spend.hardCapUsd, 0.01) * 100));
  const overSoft = spend.usedUsd >= spend.softCapUsd;
  const overHard = spend.usedUsd >= spend.hardCapUsd;
  const stopped = status.stoppedByMaster || !status.enabled;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 9, fontSize: 12, padding: "8px 0 2px", color: "var(--dsw-alias-label-secondary, #bbb)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          "今天的心思 ",
          fmtUsd(spend.usedUsd)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          "/ ",
          fmtUsd(spend.hardCapUsd)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { height: 4, borderRadius: 2, background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
        width: `${pct}%`,
        height: "100%",
        borderRadius: 2,
        background: overHard ? "var(--dsw-alias-state-error-primary, #c0392b)" : overSoft ? "var(--dsw-alias-state-warn-primary, #b8860b)" : "var(--dsw-alias-state-success-primary, #2A9D8F)"
      } }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: [
      (status.pendingApprovals ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { color: "var(--dsw-alias-state-warn-primary, #b8860b)" }, children: [
        status.pendingApprovals,
        " 件等你点头"
      ] }),
      (status.openAsks ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { color: "var(--dsw-alias-state-warn-primary, #b8860b)" }, children: [
        status.openAsks,
        " 件等你给",
        status.openAskPreview !== void 0 ? `：${status.openAskPreview}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
        "软顶 ",
        fmtUsd(spend.softCapUsd)
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        onClick: () => {
          void setMindStopped(!stopped).then(refresh);
        },
        style: {
          padding: "4px 12px",
          cursor: "pointer",
          borderRadius: 8,
          fontSize: 12,
          border: `1px solid color-mix(in srgb, ${stopped ? "var(--dsw-alias-state-success-primary, #2A9D8F)" : "var(--dsw-alias-state-warn-primary, #b8860b)"} 45%, transparent)`,
          color: stopped ? "var(--dsw-alias-state-success-primary, #2A9D8F)" : "var(--dsw-alias-state-warn-primary, #b8860b)",
          background: "transparent"
        },
        children: stopped ? "▶ 恢复心智" : "⏸ 暂停心智"
      }
    ) })
  ] });
}

// src/client/MindPage.tsx
var import_react11 = require("react");

// src/client/EngView.tsx
var import_react8 = require("react");

// src/client/PromptsEditor.tsx
var import_react5 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var SUB3 = "var(--dsw-alias-label-secondary, #888)";
var BORDER = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var WARN2 = "var(--dsw-alias-state-warn-primary, #b8860b)";
var OK = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var BLOCK_ORDER = ["menu", "rules", "outputFormat", "style"];
var textareaStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 150,
  padding: "8px 10px",
  fontFamily: "inherit",
  fontSize: 12.5,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))",
  color: "var(--dsw-alias-label-primary, inherit)",
  resize: "vertical"
};
function PromptsEditor() {
  const [data, setData] = (0, import_react5.useState)();
  const [error, setError] = (0, import_react5.useState)();
  const [draft, setDraft] = (0, import_react5.useState)({});
  const [saving, setSaving] = (0, import_react5.useState)(false);
  const [notice, setNotice] = (0, import_react5.useState)("");
  const load = () => {
    fetchPrompts().then((d) => {
      setData(d);
      const next = {};
      for (const b of d.blocks) next[b.key] = b.current;
      setDraft(next);
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  (0, import_react5.useEffect)(load, []);
  const byKey = (key) => data?.blocks.find((b) => b.key === key);
  const dirtyKeys = BLOCK_ORDER.filter((k) => {
    const info = byKey(k);
    return info !== void 0 && draft[k] !== void 0 && draft[k] !== info.current;
  });
  const save = () => {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    const payload = {};
    for (const k of dirtyKeys) payload[k] = draft[k] === byKey(k)?.default ? null : draft[k];
    savePrompts(payload).then((d) => {
      setSaving(false);
      if (d.ok) {
        setNotice("已保存——下一次唤醒即生效");
        load();
      } else setNotice(`保存失败：${d.error ?? "未知"}`);
    }).catch((e) => {
      setSaving(false);
      setNotice(e instanceof Error ? e.message : String(e));
    });
  };
  if (error !== void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { color: WARN2, fontSize: 12.5, padding: "8px 0" }, children: [
      "提示词读取失败：",
      error
    ] });
  }
  if (data === void 0) return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: SUB3, fontSize: 12.5, padding: "8px 0" }, children: "读取提示词…" });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 12, color: SUB3, lineHeight: 1.6 }, children: "这些文本块决定 TA 每次醒来「怎么想、怎么做事、怎么说话」。修改后保存，下一次唤醒即用新词； 留空或恢复默认 = 用内置词。人格与守卫来自「数字分身」设置，不在此处。" }),
    BLOCK_ORDER.map((key) => {
      const info = byKey(key);
      if (info === void 0) return null;
      const value = draft[key] ?? info.current;
      const isDefault = value === info.default;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 12.5, fontWeight: 600 }, children: info.label }),
          info.overridden && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10.5, color: WARN2 }, children: "已自定义" }),
          !isDefault && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10.5, color: WARN2 }, children: "未保存" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { marginLeft: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              onClick: () => setDraft((prev) => ({ ...prev, [key]: info.default })),
              style: { fontSize: 11, cursor: "pointer", border: "none", background: "transparent", color: SUB3, textDecoration: "underline" },
              children: "恢复默认"
            }
          ) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "textarea",
          {
            value,
            onChange: (e) => setDraft((prev) => ({ ...prev, [key]: e.target.value })),
            rows: key === "menu" ? 14 : 8,
            style: textareaStyle
          }
        )
      ] }, key);
    }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          disabled: saving || dirtyKeys.length === 0,
          onClick: save,
          style: {
            padding: "6px 18px",
            cursor: dirtyKeys.length === 0 ? "default" : "pointer",
            borderRadius: 8,
            fontSize: 12.5,
            opacity: dirtyKeys.length === 0 ? 0.5 : 1
          },
          children: saving ? "保存中…" : `保存${dirtyKeys.length > 0 ? `（${dirtyKeys.length} 处修改）` : ""}`
        }
      ),
      notice !== "" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 12, color: notice.startsWith("已保存") ? OK : WARN2 }, children: notice })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("details", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("summary", { style: { cursor: "pointer", fontSize: 12, color: SUB3 }, children: "组装预览（TA 每次唤醒实际读到的骨架，不含时间线等动态数据）" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { style: {
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: 11.5,
        lineHeight: 1.55,
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))",
        color: "var(--dsw-alias-label-secondary, #aaa)",
        maxHeight: 320,
        overflow: "auto"
      }, children: data.composed })
    ] })
  ] });
}

// src/client/GoalsCard.tsx
var import_react6 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var SUB4 = "var(--dsw-alias-label-secondary, #888)";
var BORDER2 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK2 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
function Card({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: {
    background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
    border: `1px solid ${BORDER2}`,
    borderRadius: 12,
    padding: "10px 14px",
    ...style
  }, children });
}
function GoalsCard() {
  const [goals, setGoals] = (0, import_react6.useState)();
  (0, import_react6.useEffect)(() => {
    let cancelled = false;
    fetchGoals().then((g) => {
      if (!cancelled) setGoals(g);
    }).catch(() => {
      if (!cancelled) setGoals([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Card, { style: { padding: "10px 14px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { fontSize: 12, color: SUB4, marginBottom: 6, display: "flex", justifyContent: "space-between" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontWeight: 600 }, children: "活跃目标" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: 11 }, children: "TA 自己立的（[目标] 标记记忆）" })
    ] }),
    goals === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: SUB4, fontSize: 12.5, padding: "4px 0" }, children: "读取中…" }) : goals.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: SUB4, fontSize: 12.5, padding: "4px 0" }, children: "暂无——TA 还没立过目标（goals 函数会以 [目标] 标记记录）。" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: goals.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: OK2 }, children: "◆" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: g.title, children: g.title }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: SUB4, fontSize: 11, whiteSpace: "nowrap" }, children: g.ts.slice(5, 10) })
    ] }, i)) })
  ] });
}

// src/client/MissionsCard.tsx
var import_react7 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
var SUB5 = "var(--dsw-alias-label-secondary, #888)";
var BORDER3 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK3 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var WARN3 = "var(--dsw-alias-state-warn-primary, #b8860b)";
function MissionsCard() {
  const [loaded, setLoaded] = (0, import_react7.useState)();
  const [draft, setDraft] = (0, import_react7.useState)("");
  const [saving, setSaving] = (0, import_react7.useState)(false);
  const [notice, setNotice] = (0, import_react7.useState)("");
  (0, import_react7.useEffect)(() => {
    fetchMissions().then((t) => {
      setLoaded(t);
      setDraft(t);
    }).catch(() => setLoaded(""));
  }, []);
  const dirty = loaded !== void 0 && draft !== loaded;
  const save = () => {
    setSaving(true);
    saveMissions(draft).then((d) => {
      setSaving(false);
      if (d.ok) {
        setLoaded(draft);
        setNotice("已保存——下一次唤醒即进入 TA 的议程");
      } else setNotice(`保存失败：${d.error ?? "未知"}`);
    }).catch((e) => {
      setSaving(false);
      setNotice(e instanceof Error ? e.message : String(e));
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 4 }, children: "主人关心的长期事项" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 12, color: SUB5, marginBottom: 6, lineHeight: 1.6 }, children: "你希望 TA 长期关注、持续跟进的事写在这里（一行一件）。安静的时候 TA 会围绕它们复盘、预研、做准备——这是 TA 的议程来源。" }),
    loaded === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { color: SUB5, fontSize: 12.5, padding: "4px 0" }, children: "读取中…" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "textarea",
        {
          value: draft,
          onChange: (e) => setDraft(e.target.value),
          rows: 5,
          placeholder: "例如：\n跟进 G4 复核登记包的落地与主人批准情况\n关注 dsh 套件的健康度，发现异常主动报告\n每周五整理本周记忆，帮我回顾一周",
          style: {
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 10px",
            fontFamily: "inherit",
            fontSize: 12.5,
            lineHeight: 1.6,
            border: `1px solid ${BORDER3}`,
            borderRadius: 8,
            background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))",
            color: "var(--dsw-alias-label-primary, inherit)",
            resize: "vertical"
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            disabled: !dirty || saving,
            onClick: save,
            style: { padding: "5px 16px", fontSize: 12.5, borderRadius: 8, cursor: dirty ? "pointer" : "default", opacity: dirty ? 1 : 0.5 },
            children: saving ? "保存中…" : "保存"
          }
        ),
        notice !== "" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontSize: 12, color: notice.startsWith("已保存") ? OK3 : WARN3 }, children: notice })
      ] })
    ] })
  ] });
}

// src/client/EngView.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var SUB6 = "var(--dsw-alias-label-secondary, #888)";
var BORDER4 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK4 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var WARN4 = "var(--dsw-alias-state-warn-primary, #b8860b)";
var ERR = "var(--dsw-alias-state-error-primary, #c0392b)";
var BRAND = "var(--dsw-alias-brand-primary, #4a6fa5)";
var fmtTime = (ts) => ts > 0 ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
function Card2({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
    background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
    border: `1px solid ${BORDER4}`,
    borderRadius: 12,
    padding: "10px 14px",
    ...style
  }, children });
}
function Stat({ label, value, sub, accent }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Card2, { style: { flex: "1 1 150px", minWidth: 140 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 11, color: SUB6, letterSpacing: ".04em", marginBottom: 4 }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 16, fontWeight: 600, color: accent ?? "var(--dsw-alias-label-primary, inherit)" }, children: value }),
    sub !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 11, color: SUB6, marginTop: 3 }, children: sub })
  ] });
}
function Chip({ text, color }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: {
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: 7,
    fontSize: 10.5,
    whiteSpace: "nowrap",
    color,
    background: `color-mix(in srgb, ${color} 13%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`
  }, children: text });
}
function fnColor(fn) {
  switch (fn) {
    case "act":
      return OK4;
    case "share":
      return OK4;
    case "learn":
    case "recall":
      return BRAND;
    case "goals":
      return WARN4;
    case "idle":
      return SUB6;
    default:
      return BRAND;
  }
}
function typeChip(type, fn) {
  if (type === "wake") return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: `wake · ${fn ?? "think"}`, color: fnColor(fn) });
  if (type === "message_in" || type === "message_out") return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: type, color: OK4 });
  if (type === "error") return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: "error", color: ERR });
  if (type === "thought") return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: "thought", color: BRAND });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: type, color: SUB6 });
}
var TRIGGER_LABEL = { spontaneous: "自发", reactive: "响应", event: "事件", watchdog: "看门狗" };
function fmtFullTime(ts) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString("zh-CN", { hour12: false });
}
function fmtRelative(ts) {
  const ms = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.floor(ms / 6e4);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  return `${Math.floor(hr / 24)} 天前`;
}
function NavBtn({ disabled, onClick, title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "button",
    {
      type: "button",
      disabled: disabled === true,
      onClick,
      title,
      style: {
        cursor: disabled === true ? "default" : "pointer",
        border: `1px solid ${BORDER4}`,
        borderRadius: 7,
        background: "transparent",
        color: "var(--dsw-alias-label-primary, inherit)",
        fontSize: 14,
        lineHeight: 1,
        padding: "3px 9px",
        opacity: disabled === true ? 0.35 : 1
      },
      children
    }
  );
}
function StepDetailModal({ step, onPrev, onNext, onClose }) {
  const [full, setFull] = (0, import_react8.useState)();
  const [copied, setCopied] = (0, import_react8.useState)(false);
  (0, import_react8.useEffect)(() => {
    setFull(void 0);
    let cancelled = false;
    void fetchFeed(200).then((steps) => {
      if (!cancelled) setFull(steps.find((s2) => s2.seq === step.seq));
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [step.seq]);
  (0, import_react8.useEffect)(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev !== void 0) onPrev();
      if (e.key === "ArrowRight" && onNext !== void 0) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, onPrev, onNext]);
  const content = full !== void 0 && full.content !== "" ? full.content : step.content;
  const copy = () => {
    void navigator.clipboard?.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
    });
  };
  const usage = full?.usage;
  const trigger = full?.trigger !== void 0 ? TRIGGER_LABEL[full.trigger] ?? full.trigger : void 0;
  const isErr = step.type === "error";
  const rel = fmtRelative(step.ts);
  const metaPills = [];
  if (step.source !== "") metaPills.push(/* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: `来源 · ${step.source}`, color: SUB6 }, "src"));
  if (trigger !== void 0) metaPills.push(/* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: `触发 · ${trigger}`, color: BRAND }, "trg"));
  if (full?.backoffLevel !== void 0) metaPills.push(/* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: `退避 L${full.backoffLevel}`, color: WARN4 }, "bkg"));
  if (full?.resolves !== void 0) metaPills.push(/* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: `解决 · #${full.resolves}`, color: OK4 }, "rsv"));
  if (usage !== void 0) metaPills.push(/* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Chip, { text: `↑${usage.tokensIn} ↓${usage.tokensOut} tok · ${fmtUsd(usage.costUsd)}`, color: OK4 }, "usg"));
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      onClick: onClose,
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 1e3,
        padding: 24,
        background: "color-mix(in srgb, var(--dsw-alias-bg-base, #000) 55%, transparent)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "mindOverlayIn .16s ease-out"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("style", { children: "@keyframes mindOverlayIn{from{opacity:0}to{opacity:1}}@keyframes mindPanelIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            role: "dialog",
            "aria-modal": "true",
            onClick: (e) => e.stopPropagation(),
            style: {
              background: "var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #222))",
              border: `1px solid var(--dsw-alias-border-l2, ${BORDER4})`,
              borderRadius: 16,
              width: "min(720px, 100%)",
              maxHeight: "76vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,.4)",
              animation: "mindPanelIn .2s ease-out"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 0", flex: "0 0 auto" }, children: [
                typeChip(step.type, step.fn),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { color: SUB6, fontSize: 11.5, fontFamily: "var(--ds-font-family-code, ui-monospace), ui-monospace, monospace" }, children: [
                  "#",
                  step.seq
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { marginLeft: "auto", display: "flex", gap: 4 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(NavBtn, { disabled: onPrev === void 0, onClick: onPrev, title: "更早一步（←）", children: "‹" }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(NavBtn, { disabled: onNext === void 0, onClick: onNext, title: "更晚一步（→）", children: "›" }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(NavBtn, { onClick: onClose, title: "关闭（Esc）", children: "×" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { padding: "3px 16px 0", fontSize: 11.5, color: SUB6, flex: "0 0 auto" }, children: [
                fmtFullTime(step.ts),
                rel !== "" ? ` · ${rel}` : ""
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { padding: "12px 16px 14px", overflow: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 10 }, children: [
                metaPills.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: metaPills }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
                  border: `1px solid ${BORDER4}`,
                  borderLeft: `3px solid ${isErr ? ERR : BORDER4}`,
                  borderRadius: 10,
                  background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
                  padding: "10px 12px",
                  fontSize: 13,
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "var(--dsw-alias-label-primary, inherit)"
                }, children: content }),
                full === void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 11, color: SUB6 }, children: "正在获取全文…" }),
                full?.final !== void 0 && full.final !== "" && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
                  border: `1px solid ${BORDER4}`,
                  borderLeft: `3px solid ${BRAND}`,
                  borderRadius: 10,
                  background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
                  padding: "10px 12px"
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 11, color: SUB6, marginBottom: 4, letterSpacing: ".04em" }, children: "FINAL 交接棒" }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 12.5, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: full.final })
                ] }),
                full?.refs !== void 0 && Object.keys(full.refs).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 11, color: SUB6, marginBottom: 4, letterSpacing: ".04em" }, children: "引用" }),
                  Object.entries(full.refs).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 12, lineHeight: 1.8 }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: BRAND, fontFamily: "var(--ds-font-family-code, ui-monospace), ui-monospace, monospace", flex: "0 0 auto" }, children: k }),
                    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: SUB6, wordBreak: "break-all" }, children: v })
                  ] }, k))
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: `1px solid ${BORDER4}`, flex: "0 0 auto" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: 11, color: SUB6 }, children: "Esc 关闭 · ← → 切换步骤" }),
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: copy,
                    style: {
                      marginLeft: "auto",
                      cursor: "pointer",
                      borderRadius: 8,
                      fontSize: 12,
                      padding: "4px 12px",
                      background: "transparent",
                      border: `1px solid color-mix(in srgb, ${copied ? OK4 : BRAND} 45%, transparent)`,
                      color: copied ? OK4 : BRAND
                    },
                    children: copied ? "✓ 已复制" : "复制全文"
                  }
                )
              ] })
            ]
          }
        )
      ]
    }
  );
}
function EngView({ status, refresh }) {
  const [selected, setSelected] = (0, import_react8.useState)(null);
  if (status === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { padding: 12, color: SUB6, fontSize: 13 }, children: "读取中…" });
  }
  const { spend } = status;
  const capped = spend.usedUsd >= spend.hardCapUsd;
  const soft = !capped && spend.usedUsd >= spend.softCapUsd;
  const stopped = status.stoppedByMaster || !status.enabled;
  const asleep = status.quiet?.active === true;
  const stateText = stopped ? "已暂停" : asleep ? "静音时段" : status.running ? "思考中" : "待机";
  const stateColor = stopped ? SUB6 : asleep ? BRAND : status.running ? OK4 : BRAND;
  const spendAccent = capped ? ERR : soft ? WARN4 : void 0;
  const pct = Math.min(100, Math.round(spend.usedUsd / Math.max(spend.hardCapUsd, 0.01) * 100));
  const nextWakeMin = status.wakeAt > Date.now() ? Math.max(1, Math.round((status.wakeAt - Date.now()) / 6e4)) : 0;
  const selIdx = selected !== null ? status.tail.findIndex((s2) => s2.seq === selected.seq) : -1;
  const older = selIdx > 0 ? status.tail[selIdx - 1] : void 0;
  const newer = selIdx !== -1 && selIdx < status.tail.length - 1 ? status.tail[selIdx + 1] : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { flex: "1 1 150px", minWidth: 140 }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Card2, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { fontSize: 11, color: SUB6, letterSpacing: ".04em", marginBottom: 4 }, children: "状态" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: {
            display: "inline-block",
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: stateColor,
            boxShadow: status.running ? `0 0 0 3px color-mix(in srgb, ${OK4} 22%, transparent)` : void 0
          } }),
          stateText
        ] }),
        status.quiet?.enabled && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { fontSize: 11, color: SUB6, marginTop: 3 }, children: [
          "作息 ",
          status.quiet.start,
          "–",
          status.quiet.end
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Stat, { label: "退避档位", value: `L${status.backoffLevel}`, sub: `自醒间隔 ≤ ${Math.round(Math.min(3e5, 5e3 * Math.pow(2, Math.max(0, status.backoffLevel - 1))) / 1e3)}s` }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Stat, { label: "上次唤醒", value: fmtTime(status.lastWakeAt) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Stat, { label: "下次自醒", value: stopped ? "已停" : asleep ? "静音中" : nextWakeMin > 0 ? `~${nextWakeMin} 分钟` : "随时" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Stat, { label: "今日花费", value: fmtUsd(spend.usedUsd), sub: `/ 硬顶 ${fmtUsd(spend.hardCapUsd)}${capped ? " · 触顶停自发" : soft ? " · 过软顶：自驱降频" : ""}`, accent: spendAccent })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Card2, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { flex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { height: 6, borderRadius: 3, background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))", overflow: "hidden" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { width: `${pct}%`, height: "100%", borderRadius: 3, background: spendAccent ?? OK4, transition: "width .4s" } }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { fontSize: 11.5, color: SUB6, whiteSpace: "nowrap" }, children: [
          pct,
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            type: "button",
            onClick: () => {
              void setMindStopped(!stopped).then(refresh);
            },
            style: {
              padding: "5px 16px",
              cursor: "pointer",
              borderRadius: 9,
              fontSize: 12.5,
              border: `1px solid color-mix(in srgb, ${stopped ? OK4 : WARN4} 45%, transparent)`,
              color: stopped ? OK4 : WARN4,
              background: "transparent"
            },
            children: stopped ? "▶ 恢复心智" : "⏸ 暂停心智"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: SUB6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
          "待处理观察 ",
          status.pending ?? 0
        ] }),
        (status.pendingApprovals ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { color: WARN4 }, children: [
          "待主人批准 ",
          status.pendingApprovals
        ] }),
        (status.openAsks ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { color: WARN4 }, children: [
          "等你给 ",
          status.openAsks,
          status.openAskPreview !== void 0 ? `：${status.openAskPreview}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { children: [
          "软顶 ",
          fmtUsd(spend.softCapUsd),
          " · 硬顶 ",
          fmtUsd(spend.hardCapUsd)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GoalsCard, {}),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Card2, { style: { padding: "10px 14px 14px" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MissionsCard, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Card2, { style: { padding: "10px 14px 14px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { fontSize: 12, color: SUB6, marginBottom: 8, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontWeight: 600 }, children: "提示词" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: 11 }, children: "TA 每次唤醒读的行为文本——改完保存，下一拍即生效" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PromptsEditor, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Card2, { style: { padding: "10px 14px 6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { fontSize: 12, color: SUB6, marginBottom: 6, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontWeight: 600 }, children: "时间线 · 最近" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { fontSize: 11 }, children: [
          status.tail.length,
          " 步"
        ] })
      ] }),
      status.tail.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { color: SUB6, padding: "8px 0 10px" }, children: "暂无步骤——分身尚未醒来" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { display: "flex", flexDirection: "column" }, children: status.tail.slice().reverse().map((step, i, arr) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          onClick: () => setSelected(step),
          title: "点击查看完整信息",
          style: {
            display: "flex",
            gap: 10,
            alignItems: "baseline",
            padding: "5px 6px",
            borderRadius: 7,
            borderBottom: i === arr.length - 1 ? "none" : `1px solid ${BORDER4}`,
            cursor: "pointer"
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08))";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = "transparent";
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: SUB6, fontFamily: "var(--ds-font-family-code, ui-monospace), ui-monospace, monospace", fontSize: 11.5, whiteSpace: "nowrap" }, children: new Date(step.ts).toLocaleTimeString("zh-CN", { hour12: false }) }),
            typeChip(step.type, step.fn),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, flex: 1 }, children: step.content })
          ]
        },
        step.seq
      )) })
    ] }),
    selected !== null && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      StepDetailModal,
      {
        step: selected,
        onPrev: older !== void 0 ? () => setSelected(older) : void 0,
        onNext: newer !== void 0 ? () => setSelected(newer) : void 0,
        onClose: () => setSelected(null)
      }
    )
  ] });
}

// src/client/LifeTimeline.tsx
var import_react9 = require("react");

// src/lifetimeline-scale.ts
var DAY = 864e5;
var WEEK = 7 * DAY;
function levelForSpan(spanMs) {
  if (spanMs > 550 * DAY) return "year";
  if (spanMs > 45 * DAY) return "month";
  if (spanMs > 7 * DAY) return "week";
  if (spanMs > 36 * 36e5) return "day";
  return "hour";
}
function bucketStart(level, t) {
  const d = new Date(t);
  switch (level) {
    case "year":
      return new Date(d.getFullYear(), 0, 1).getTime();
    case "month":
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    case "week": {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dow = (day.getDay() + 6) % 7;
      return day.getTime() - dow * DAY;
    }
    case "day":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    case "hour":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
  }
}
function nextBucketStart(level, bucketT) {
  const d = new Date(bucketT);
  switch (level) {
    case "year":
      return new Date(d.getFullYear() + 1, 0, 1).getTime();
    case "month":
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    case "week":
      return bucketT + WEEK;
    case "day":
      return bucketT + DAY;
    case "hour":
      return bucketT + 36e5;
  }
}
function ticksForRange(level, startMs, endMs) {
  const out = [];
  const from = bucketStart(level, startMs);
  const push = (t, label, major = false) => {
    if (t >= from && t <= endMs) out.push({ t, label, major });
  };
  if (level === "year") {
    const y0 = new Date(startMs).getFullYear();
    const y1 = new Date(endMs).getFullYear();
    for (let y = y0; y <= y1; y++) push(new Date(y, 0, 1).getTime(), `${y}年`, true);
  } else if (level === "month") {
    const cur = new Date(startMs);
    cur.setDate(1);
    cur.setHours(0, 0, 0, 0);
    while (cur.getTime() <= endMs) {
      const t = cur.getTime();
      push(t, `${cur.getMonth() + 1}月`, cur.getMonth() === 0);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (level === "week") {
    let t = bucketStart("week", startMs);
    while (t <= endMs) {
      const d = new Date(t);
      push(t, `${d.getMonth() + 1}/${d.getDate()} 周`);
      t += WEEK;
    }
  } else if (level === "day") {
    const cur = new Date(startMs);
    cur.setHours(0, 0, 0, 0);
    while (cur.getTime() <= endMs) {
      const t = cur.getTime();
      push(t, `${cur.getMonth() + 1}/${cur.getDate()}`, cur.getDate() === 1);
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const cur = new Date(startMs);
    cur.setMinutes(0, 0, 0);
    let lastDay = "";
    while (cur.getTime() <= endMs) {
      const t = cur.getTime();
      const day = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      const prefix = `${cur.getMonth() + 1}/${cur.getDate()}`;
      const firstOfDay = day !== lastDay;
      push(
        t,
        firstOfDay ? `${prefix} ${cur.getHours()}时` : `${cur.getHours()}时`,
        cur.getHours() === 0
      );
      lastDay = day;
      cur.setHours(cur.getHours() + 1);
    }
  }
  return out;
}
var DENSE_BUCKET = 30;

// src/client/LifeTimeline.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var SUB7 = "var(--dsw-alias-label-secondary, #888)";
var BORDER5 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK5 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var ERR2 = "var(--dsw-alias-state-error-primary, #c0392b)";
var BRAND2 = "var(--dsw-alias-brand-primary, #4a6fa5)";
var WARN5 = "var(--dsw-alias-state-warn-primary, #b8860b)";
var MIN_SPAN = 2 * 36e5;
var HEIGHT = 190;
var AXIS_Y = 132;
var LEVEL_LABEL = { year: "年", month: "月", week: "周", day: "日", hour: "时" };
function nodeColor(type, fn) {
  if (type === "error") return ERR2;
  if (type === "message_in") return "var(--dsw-alias-label-primary, #eee)";
  if (type === "task") return WARN5;
  switch (fn) {
    case "act":
      return OK5;
    case "share":
      return OK5;
    case "learn":
    case "recall":
      return BRAND2;
    case "goals":
      return WARN5;
    default:
      return BRAND2;
  }
}
function LifeTimeline() {
  const [meta, setMeta] = (0, import_react9.useState)();
  const [error, setError] = (0, import_react9.useState)();
  const [view, setView] = (0, import_react9.useState)();
  const [width, setWidth] = (0, import_react9.useState)(900);
  const [detail, setDetail] = (0, import_react9.useState)();
  const containerRef = (0, import_react9.useRef)(null);
  const dragRef = (0, import_react9.useRef)(void 0);
  (0, import_react9.useEffect)(() => {
    fetchTimelineMeta().then((d) => {
      setMeta(d);
      if (d.length > 0) {
        const first = Date.parse(d[d.length - 1].ts);
        const last = Date.parse(d[0].ts);
        const pad = Math.max(2 * 36e5, (last - first) * 0.03);
        setView({ start: first - pad, end: Math.min(last + pad, Date.now() + 36e5) });
      }
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const measureRef = (el) => {
    containerRef.current = el;
    if (el !== null && el.clientWidth > 0) setWidth((prev) => Math.abs(prev - el.clientWidth) > 2 ? el.clientWidth : prev);
  };
  (0, import_react9.useEffect)(() => {
    const onResize = () => {
      const el = containerRef.current;
      if (el !== null && el.clientWidth > 0) setWidth((prev) => Math.abs(prev - el.clientWidth) > 2 ? el.clientWidth : prev);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (error !== void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { color: ERR2, fontSize: 12.5, padding: "8px 0" }, children: [
      "时间轴读取失败：",
      error
    ] });
  }
  if (meta === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: SUB7, fontSize: 12.5, padding: "8px 0" }, children: "翻开 TA 的一生…" });
  }
  if (meta.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: SUB7, fontSize: 12.5, padding: "8px 0" }, children: "TA 还没醒过。" });
  }
  const firstTs = Date.parse(meta[meta.length - 1].ts);
  const dataEnd = Date.parse(meta[0].ts);
  const fit = () => {
    const pad = Math.max(2 * 36e5, (dataEnd - firstTs) * 0.03);
    setView({ start: firstTs - pad, end: Math.min(dataEnd + pad, Date.now() + 36e5) });
    setDetail(void 0);
  };
  const v = view ?? { start: firstTs, end: Math.min(dataEnd, Date.now()) };
  const span = Math.max(1, v.end - v.start);
  const level = levelForSpan(span);
  const msToX = (t) => (t - v.start) / span * width;
  const xToMs = (x) => v.start + x / width * span;
  const buckets = /* @__PURE__ */ new Map();
  for (const s2 of meta) {
    const t = Date.parse(s2.ts);
    if (t < v.start || t > v.end) continue;
    const start = bucketStart(level, t);
    let b = buckets.get(start);
    if (b === void 0) {
      b = { start, end: nextBucketStart(level, start), total: 0, idle: 0, items: [], color: SUB7 };
      buckets.set(start, b);
    }
    if (s2.type === "idle") {
      b.idle += 1;
      continue;
    }
    b.total += 1;
    b.items.push(s2);
    b.color = nodeColor(s2.type, s2.fn);
  }
  const bucketList = [...buckets.values()].sort((a, b) => a.start - b.start);
  const maxIdle = Math.max(1, ...bucketList.map((b) => b.idle));
  const ticks = ticksForRange(level, v.start, v.end);
  const onWheel = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = xToMs(e.clientX - rect.left);
    const factor = e.deltaY > 0 ? 1.25 : 0.8;
    let next = span * factor;
    const dataSpan = Math.max(MIN_SPAN, dataEnd - firstTs);
    next = Math.max(MIN_SPAN, Math.min(dataSpan * 1.15, next));
    const ratio = (anchor - v.start) / span;
    const start = anchor - next * ratio;
    setView({ start, end: start + next });
    setDetail(void 0);
  };
  const onDragStart = (e) => {
    dragRef.current = { x: e.clientX, start: v.start, end: v.end };
    const move = (ev) => {
      const d = dragRef.current;
      if (d === void 0) return;
      const dx = ev.clientX - d.x;
      const shift = -(dx / width) * (d.end - d.start);
      setView({ start: d.start + shift, end: d.end + shift });
    };
    const up = () => {
      dragRef.current = void 0;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const onNodeClick = (b) => {
    const alreadyDrilled = b.end - b.start >= (v.end - v.start) * 0.5;
    if ((b.total > DENSE_BUCKET || level !== "hour") && !alreadyDrilled) {
      const pad = Math.max(36e5, (b.end - b.start) * 0.05);
      setView({ start: b.start - pad, end: b.end + pad });
      setDetail(void 0);
      return;
    }
    setDetail({ loading: true });
    fetchRange(b.start, b.end).then((steps) => setDetail({ loading: false, rows: coalesceRests(steps.map(narrateStep)) })).catch(() => setDetail({ loading: false, rows: [] }));
  };
  const fmtSpan = () => {
    const days = span / 864e5;
    if (days > 365) return `${Math.round(days / 365)} 年`;
    if (days > 1) return `${Math.round(days)} 天`;
    if (days * 24 > 1) return `${Math.round(days * 24)} 小时`;
    return `${Math.round(days * 24 * 60)} 分钟`;
  };
  const fmtDay = (t) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const fmtHM = (t) => {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { style: {
        fontSize: 10.5,
        padding: "1px 8px",
        borderRadius: 7,
        color: BRAND2,
        background: `color-mix(in srgb, ${BRAND2} 13%, transparent)`,
        border: `1px solid color-mix(in srgb, ${BRAND2} 38%, transparent)`
      }, children: [
        "粒度 · ",
        LEVEL_LABEL[level]
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { style: { fontSize: 11, color: SUB7 }, children: [
        fmtDay(v.start),
        " ",
        fmtHM(v.start),
        " ~ ",
        fmtDay(v.end),
        " ",
        fmtHM(v.end),
        "（",
        fmtSpan(),
        "）"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: 11, color: SUB7 }, children: "· 滚轮缩放 / 拖拽平移 / 点击节点下钻" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "button",
        {
          type: "button",
          onClick: fit,
          style: { marginLeft: "auto", fontSize: 11, cursor: "pointer", border: "none", background: "transparent", color: SUB7, textDecoration: "underline" },
          children: "复位看一生"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      "div",
      {
        ref: measureRef,
        onWheel,
        onMouseDown: onDragStart,
        style: { width: "100%", cursor: dragRef.current !== void 0 ? "grabbing" : "grab", userSelect: "none", touchAction: "none" },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { width, height: HEIGHT, style: { display: "block", overflow: "visible" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("line", { x1: 0, y1: AXIS_Y, x2: width, y2: AXIS_Y, stroke: BORDER5, strokeWidth: 1 }),
          ticks.map((t) => {
            const x = msToX(t.t);
            return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("g", { children: [
              t.major === true && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("line", { x1: x, y1: 12, x2: x, y2: AXIS_Y, stroke: BORDER5, strokeWidth: 1, strokeDasharray: "2 4", opacity: 0.55 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("line", { x1: x, y1: AXIS_Y - (t.major === true ? 9 : 6), x2: x, y2: AXIS_Y + 6, stroke: BORDER5, strokeWidth: 1 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("text", { x: x + 4, y: AXIS_Y + 20, fontSize: t.major === true ? 11 : 10.5, fontWeight: t.major === true ? 600 : 400, fill: SUB7, fontFamily: "ui-monospace, monospace", children: t.label })
            ] }, `t${t.t}`);
          }),
          bucketList.filter((b) => b.idle > 0).map((b) => {
            const x = msToX(b.start);
            const w = Math.max(2, msToX(b.end) - x - 1);
            const h = Math.max(2, b.idle / maxIdle * 26);
            return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("rect", { x, y: AXIS_Y - h, width: w, height: h, rx: 1.5, fill: "rgba(128,128,128,.16)", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("title", { children: `${new Date(b.start).toLocaleString("zh-CN")} 起的${level === "hour" ? "一小时" : "一段"} · ${b.idle} 次心跳（空醒，非活动）` }) }, `i${b.start}`);
          }),
          bucketList.filter((b) => b.total > 0).map((b) => {
            const x = msToX(b.start) + 1;
            const w = Math.max(2, msToX(b.end) - msToX(b.start) - 2);
            const h = Math.min(96, 6 + Math.sqrt(b.total) * 11);
            const y = AXIS_Y - h;
            const dense = b.total > DENSE_BUCKET || level !== "hour";
            return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
              "g",
              {
                style: { cursor: "pointer" },
                onMouseEnter: (e) => {
                  e.currentTarget.querySelector("rect")?.setAttribute("opacity", "1");
                },
                onMouseLeave: (e) => {
                  e.currentTarget.querySelector("rect")?.setAttribute("opacity", "0.82");
                },
                onClick: () => onNodeClick(b),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("title", { children: `${new Date(b.start).toLocaleString("zh-CN")} 起的${level === "hour" ? "一小时" : "一段"} · ${b.total} 件活动${b.idle > 0 ? `（另有 ${b.idle} 次心跳）` : ""}${dense ? " · 点击下钻" : " · 点击看详情"}` }),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("rect", { x, y, width: w, height: h, rx: 3, fill: b.color, opacity: 0.82 }),
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("text", { x: x + w / 2, y: y - 4, textAnchor: "middle", fontSize: 9.5, fill: SUB7, fontWeight: 600, children: b.total > 99 ? "99+" : b.total })
                ]
              },
              `n${b.start}`
            );
          })
        ] })
      }
    ),
    detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: {
      marginTop: 10,
      padding: "8px 12px",
      borderRadius: 10,
      maxHeight: 260,
      overflowY: "auto",
      border: `1px solid ${BORDER5}`,
      background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))"
    }, children: [
      detail.loading && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: SUB7, fontSize: 12.5 }, children: "载入该时段…" }),
      !detail.loading && (detail.rows === void 0 || detail.rows.length === 0) && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { color: SUB7, fontSize: 12.5 }, children: "该时段没有记录。" }),
      detail.rows?.map((n) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", padding: "3px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { color: SUB7, fontSize: 11, whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }, children: fmtClock(n.ts) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
          n.title,
          n.body !== void 0 && n.body !== "" ? `：${n.body.slice(0, 80)}` : ""
        ] })
      ] }, n.seq))
    ] })
  ] });
}

// src/client/OfficeView.tsx
var import_react10 = require("react");
var import_jsx_runtime10 = require("react/jsx-runtime");
var SUB8 = "var(--dsw-alias-label-secondary, #999)";
var SPOTS = {
  desk: { x: 46, y: 62 },
  book: { x: 78, y: 34 },
  goal: { x: 66, y: 22 },
  coffee: { x: 16, y: 66 },
  rest: { x: 30, y: 80 },
  door: { x: 6, y: 70 },
  window: { x: 24, y: 30 }
};
function spotFor(kind, fn) {
  if (kind === "message_in") return "door";
  if (kind === "rest" || kind === "idle") return "coffee";
  const f = (fn ?? "").toLowerCase();
  if (f === "learn") return "book";
  if (f === "goals") return "goal";
  if (f === "ask") return "goal";
  if (f === "share" || f === "message_out") return "window";
  return "desk";
}
function titleOf(kind, fn) {
  if (kind === "message_in") return "收到你的话";
  if (kind === "idle") return "歇了一会儿";
  if (kind === "error") return "唤醒失败（自愈/待查）";
  const f = (fn ?? "").toLowerCase();
  if (f === "learn") return "查了些资料";
  if (f === "act") return "干了一件活";
  if (f === "think") return "想了件事";
  if (f === "share") return "投递了产出";
  if (f === "goals") return "理了目标";
  if (f === "ask") return "有事等你给";
  if (f === "recall") return "翻了下记忆";
  return fn !== "" ? `唤醒（${fn}）` : "醒来";
}
function hhmm(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function sky(h) {
  if (h >= 6 && h < 8) return "linear-gradient(180deg,#33415c 0%,#232a33 55%)";
  if (h >= 8 && h < 17) return "linear-gradient(180deg,#3d5270 0%,#1d232c 60%)";
  if (h >= 17 && h < 20) return "linear-gradient(180deg,#4a3a52 0%,#1d2129 55%)";
  return "linear-gradient(180deg,#182030 0%,#12161d 60%)";
}
function OfficeView({ onBack }) {
  const [steps, setSteps] = (0, import_react10.useState)([]);
  const [idx, setIdx] = (0, import_react10.useState)(-1);
  const [playing, setPlaying] = (0, import_react10.useState)(false);
  const [speed, setSpeed] = (0, import_react10.useState)(1400);
  const [live, setLive] = (0, import_react10.useState)(true);
  const timer = (0, import_react10.useRef)(null);
  const status = usePoll(fetchStatus, 3e4);
  const st = status.data;
  (0, import_react10.useEffect)(() => {
    let alive = true;
    void (async () => {
      try {
        const meta = await fetchTimelineMeta();
        const horizon = Date.now() - 1e3 * 60 * 60 * 36;
        const rows = meta.filter((m) => {
          const t = Date.parse(m.ts);
          return Number.isFinite(t) && t >= horizon;
        }).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)).map((m) => ({ ts: m.ts, kind: m.type, fn: m.fn ?? "", title: titleOf(m.type, m.fn ?? "") }));
        if (alive) setSteps(rows);
      } catch {
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  (0, import_react10.useEffect)(() => {
    if (!playing) {
      if (timer.current !== null) {
        clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    timer.current = setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % Math.max(1, steps.length);
        if (next === 0) setPlaying(false);
        return next;
      });
    }, speed);
    return () => {
      if (timer.current !== null) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [playing, speed, steps.length]);
  const cur = idx >= 0 ? steps[idx] : void 0;
  const liveSpot = st?.quiet?.active === true ? "rest" : st?.running === true ? "desk" : "coffee";
  const shown = live ? liveSpot : cur !== void 0 ? spotFor(cur.kind, cur.fn) : "desk";
  const pos = SPOTS[shown] ?? SPOTS.desk;
  const hour = live ? (/* @__PURE__ */ new Date()).getHours() : cur !== void 0 ? new Date(cur.ts).getHours() : (/* @__PURE__ */ new Date()).getHours();
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { maxWidth: 1080, margin: "0 auto", padding: "10px 16px 40px", display: "flex", flexDirection: "column", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 15, fontWeight: 600 }, children: "🏢 分身的一天 · 办公室" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: SUB8 }, children: [
        st?.spend !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { children: [
          "今日心思 ",
          fmtUsd(st.spend.usedUsd),
          " / ",
          fmtUsd(st.spend.hardCapUsd)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "button",
          {
            type: "button",
            onClick: onBack,
            style: {
              padding: "4px 14px",
              cursor: "pointer",
              borderRadius: 8,
              fontSize: 12.5,
              border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))",
              background: "transparent",
              color: "var(--dsw-alias-label-secondary, #bbb)"
            },
            children: "← 回到分身"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: {
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 16,
          overflow: "hidden",
          background: sky(hour),
          border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.22))"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", left: "10%", top: "12%", width: "20%", height: "30%", borderRadius: 8, background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))", border: "2px solid rgba(255,255,255,.2)" }, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }, children: hour >= 6 && hour < 18 ? "☀️" : "🌙" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", left: "58%", top: "12%", width: "18%", height: "22%", borderRadius: 6, background: "rgba(255,255,255,.1)", border: "2px solid rgba(255,255,255,.18)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }, children: "🎯" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", bottom: -22, width: "100%", textAlign: "center", fontSize: 11, color: SUB8 }, children: "白板 · goals/ask" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", right: "6%", top: "34%", width: "13%", height: "30%", borderRadius: 6, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }, children: "📚" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", bottom: -22, width: "100%", textAlign: "center", fontSize: 11, color: SUB8 }, children: "书架 · learn" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", left: "40%", top: "50%", width: "22%", height: "26%", borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 30 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "🖥️" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: "🪑" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", bottom: -22, width: "100%", textAlign: "center", fontSize: 11, color: SUB8 }, children: "工位 · act/think/wake" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", left: "9%", top: "58%", width: "14%", height: "22%", borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }, children: "☕" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", bottom: -22, width: "100%", textAlign: "center", fontSize: 11, color: SUB8 }, children: "咖啡角 · idle" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", left: "26%", top: "76%", width: "15%", height: "16%", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }, children: "🛏️" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", bottom: -20, width: "100%", textAlign: "center", fontSize: 11, color: SUB8 }, children: "休息角 · 静音" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { position: "absolute", left: "2%", top: "56%", width: "7%", height: "30%", borderRadius: "6px 6px 0 0", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.16)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }, children: "🚪" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", bottom: -20, width: "100%", textAlign: "center", fontSize: 11, color: SUB8 }, children: "门口" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", left: 0, right: 0, top: "88%", height: 1, background: "rgba(255,255,255,.1)" } }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: {
            position: "absolute",
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: "translate(-50%, -50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, rgba(79,179,169,1), rgb(79,179,169) 52%, rgba(79,179,169,.55) 100%)",
            boxShadow: "0 0 24px rgba(79,179,169,.55)",
            transition: "left 1s cubic-bezier(.4,0,.2,1), top 1s cubic-bezier(.4,0,.2,1)",
            zIndex: 5
          }, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", left: 13, top: 9, width: 17, height: 23, background: "rgba(8,12,18,.72)", borderRadius: "50% 50% 42% 42%" } }) }),
          !live && cur !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: {
            position: "absolute",
            left: `${pos.x}%`,
            top: `calc(${pos.y}% - 76px)`,
            transform: "translateX(-50%)",
            maxWidth: 300,
            padding: "8px 12px",
            borderRadius: 12,
            zIndex: 6,
            background: "var(--dsw-alias-bg-overlay, rgba(20,24,30,.95))",
            border: "1px solid rgba(255,255,255,.18)",
            fontSize: 12.5
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { fontSize: 11, color: SUB8, marginBottom: 2 }, children: [
              hhmm(cur.ts),
              " · ",
              cur.title
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { lineHeight: 1.5 }, children: cur.body ?? "" })
          ] }),
          live && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", left: `${pos.x}%`, top: `calc(${pos.y}% - 56px)`, transform: "translateX(-50%)", padding: "2px 10px", borderRadius: 999, background: "rgba(20,24,30,.9)", border: "1px solid rgba(255,255,255,.16)", fontSize: 11.5, color: SUB8, whiteSpace: "nowrap" }, children: st?.quiet?.active === true ? "🌙 静音时段 · 睡着" : st?.running === true ? "💭 正在想/干" : "🌤 醒着待命" }),
          steps.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { position: "absolute", left: 0, right: 0, top: "46%", textAlign: "center", fontSize: 13, color: SUB8 }, children: "36 小时内没有时间线步骤——分身还没醒过。" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12.5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            setLive(false);
            setPlaying((p) => {
              if (idx < 0 && steps.length > 0) setIdx(0);
              return !p;
            });
          },
          style: {
            padding: "5px 14px",
            cursor: "pointer",
            borderRadius: 8,
            border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))",
            background: "transparent",
            color: "var(--dsw-alias-label-primary, #eee)"
          },
          children: playing ? "⏸ 暂停" : "▶ 播放"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
        "select",
        {
          value: String(speed),
          onChange: (e) => {
            setSpeed(Number(e.target.value));
          },
          style: { padding: "4px 8px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.3))", background: "transparent", color: "var(--dsw-alias-label-primary, #eee)", fontSize: 12 },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: "2600", children: "1×" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: "1400", children: "2×" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: "700", children: "4×" })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "input",
        {
          type: "range",
          min: 0,
          max: Math.max(0, steps.length - 1),
          value: Math.max(0, idx),
          onChange: (e) => {
            setLive(false);
            setPlaying(false);
            setIdx(Number(e.target.value));
          },
          style: { flex: 1, minWidth: 200, accentColor: "#4fc2b1" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            setPlaying(false);
            setLive(true);
            setIdx(-1);
          },
          style: {
            padding: "5px 14px",
            cursor: "pointer",
            borderRadius: 8,
            border: `1px solid ${live ? "rgba(79,179,169,.6)" : "var(--dsw-alias-border-l1, rgba(128,128,128,.3))"}`,
            background: "transparent",
            color: live ? "rgb(79,179,169)" : "var(--dsw-alias-label-secondary, #bbb)"
          },
          children: "● 实时"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { color: SUB8, fontSize: 12 }, children: live ? "实时" : cur !== void 0 ? `第 ${idx + 1} / ${steps.length} 步` : "" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 12.5, color: SUB8, padding: "8px 12px", borderLeft: "3px solid rgb(79,179,169)", background: "rgba(255,255,255,.04)", borderRadius: 8, minHeight: 20 }, children: live ? st?.quiet?.active === true ? "静音时段——TA 在休息角睡着，醒来会接着排。" : st?.running === true ? "TA 正在工位上想/干活。" : "TA 醒着，在咖啡角待命。" : cur !== void 0 ? `${hhmm(cur.ts)} · ${cur.title}` : "按「播放」回放分身的一天；或切「实时」跟随此刻状态。" })
  ] });
}

// src/client/MindPage.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var VIEW_KEY = "dsh-mind.view";
function MindPage() {
  const [view, setView] = (0, import_react11.useState)(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "eng" ? "eng" : "person";
    } catch {
      return "person";
    }
  });
  const status = usePoll(fetchStatus, 5e3);
  if (view === "office") {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { padding: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ViewToggle, { view, onToggle: () => {
        setView("person");
        try {
          localStorage.setItem(VIEW_KEY, "person");
        } catch {
        }
      } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(OfficeView, { onBack: () => {
        setView("person");
        try {
          localStorage.setItem(VIEW_KEY, "person");
        } catch {
        }
      } })
    ] });
  }
  if (view === "eng") {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { padding: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ViewToggle, { view, onToggle: () => {
        setView("person");
        try {
          localStorage.setItem(VIEW_KEY, "person");
        } catch {
        }
      } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(EngView, { status: status.data })
    ] });
  }
  const st = status.data;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { maxWidth: 720, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            setView("office");
          },
          style: { padding: "3px 10px", fontSize: 12, cursor: "pointer", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l1, #444)", background: "transparent", color: "var(--dsw-alias-label-secondary, #aaa)" },
          children: "🏢 办公室"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ViewToggle, { view, onToggle: () => {
        setView("eng");
        try {
          localStorage.setItem(VIEW_KEY, "eng");
        } catch {
        }
      } })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "18px 0 6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Being, { size: 216, status: st }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { fontSize: 18, fontWeight: 600 }, children: "分身" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { fontSize: 14, color: "var(--dsw-alias-label-secondary, #bbb)", marginTop: 4 }, children: st !== void 0 ? presenceLine(st) : "…" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #888)", textAlign: "center" }, children: [
        greeting(/* @__PURE__ */ new Date()),
        "。TA 就住在这台 dsh 里——右下角也一直有 TA，说句话 TA 就会回应。",
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("br", {}),
        "想调教 TA 的行为方式？切到「工程视图」改 TA 的提示词。"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("details", { open: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("summary", { style: { cursor: "pointer", fontSize: 13, color: "var(--dsw-alias-label-secondary, #aaa)", userSelect: "none" }, children: "TA 的一生（时间轴 · 滚轮缩放）" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { paddingTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(LifeTimeline, {}) })
    ] })
  ] });
}
function ViewToggle({ view, onToggle }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "button",
    {
      type: "button",
      onClick: onToggle,
      style: { padding: "3px 10px", fontSize: 12, cursor: "pointer", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l1, #444)", background: "transparent", color: "var(--dsw-alias-label-secondary, #aaa)" },
      children: view === "person" ? "工程视图" : "回到 TA"
    }
  );
}

// src/client/activity-sensor.tsx
var import_react12 = require("react");
var REPORT_THROTTLE_MS = 25e3;
var mountSeq = 0;
function ActivitySensor() {
  (0, import_react12.useEffect)(() => {
    mountSeq += 1;
    const mounts = mountSeq;
    let lastSentAt = 0;
    let dirty = false;
    let pending = false;
    const report = () => {
      if (pending) return;
      const now = Date.now();
      if (now - lastSentAt < REPORT_THROTTLE_MS) return;
      pending = true;
      lastSentAt = now;
      void (async () => {
        try {
          const key = await writeKey();
          await fetch("/dsh-mind/console-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-mind-key": key },
            body: JSON.stringify({
              at: now,
              mounts,
              vis: document.visibilityState,
              focus: document.hasFocus(),
              href: location.hash.slice(0, 40)
            })
          });
        } catch {
        }
        pending = false;
      })();
    };
    const markDirty = (e) => {
      if (e !== void 0 && e.isTrusted !== true) return;
      if (document.hasFocus() !== true) return;
      dirty = true;
    };
    const onTick = () => {
      if (!dirty) return;
      dirty = false;
      report();
    };
    lastSentAt = Date.now();
    report();
    const timer = setInterval(onTick, 3e3);
    document.addEventListener("mousemove", (e) => markDirty(e), { passive: true });
    document.addEventListener("keydown", (e) => markDirty(e), true);
    document.addEventListener("click", (e) => markDirty(e), true);
    document.addEventListener("scroll", (e) => markDirty(e), { passive: true, capture: true });
    return () => {
      clearInterval(timer);
      document.removeEventListener("mousemove", markDirty);
      document.removeEventListener("keydown", markDirty, true);
      document.removeEventListener("click", markDirty, true);
      document.removeEventListener("scroll", markDirty, { capture: true });
    };
  }, []);
  return null;
}

// src/client/index.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var inject = ["slots"];
var C = {
  sub: "var(--dsw-alias-label-secondary, #888)",
  border: "var(--dsw-alias-border-l1, rgba(128,128,128,.25))",
  ok: "var(--dsw-alias-state-success-primary, #2A9D8F)",
  brand: "var(--dsw-alias-brand-primary, #4a6fa5)"
};
function PresenceDot({ status, size = 8 }) {
  const stopped = status !== void 0 && (status.stoppedByMaster || !status.enabled);
  const asleep = status?.quiet?.active === true;
  const color = stopped ? C.sub : asleep ? C.brand : status?.running === true ? C.ok : C.brand;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    opacity: stopped ? 0.45 : 1,
    flexShrink: 0,
    boxShadow: status?.running === true ? `0 0 0 3px color-mix(in srgb, ${C.ok} 25%, transparent)` : void 0
  } });
}
function PersonCard() {
  const status = usePoll(async () => {
    const resp = await fetch("/dsh-mind/status");
    return await resp.json();
  }, 3e4);
  const st = status.data;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: C.sub }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PresenceDot, { status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: st !== void 0 ? presenceLine(st) : "分身：住在这台 dsh 里的心智" }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: { opacity: 0.7 }, children: "· 侧边栏「心智」看 TA" })
  ] });
}
function SidebarIcon({ size, active }) {
  const [status, setStatus] = (0, import_react13.useState)();
  (0, import_react13.useEffect)(() => {
    let cancelled = false;
    const load = () => {
      void fetch("/dsh-mind/status").then((r) => r.json()).then((b) => {
        if (!cancelled) setStatus(b);
      }).catch(() => {
      });
    };
    void load();
    const t = setInterval(load, 3e4);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  const stopped = status !== void 0 && (status.stoppedByMaster || !status.enabled);
  const asleep = status?.quiet?.active === true;
  const color = active ? "var(--dsw-alias-label-primary, inherit)" : stopped ? "var(--dsw-alias-label-secondary, #888)" : "var(--dsw-alias-label-secondary, #aaa)";
  const dotColor = stopped ? "var(--dsw-alias-label-secondary, #888)" : asleep ? "var(--dsw-alias-brand-primary, #4a6fa5)" : "var(--dsw-alias-state-success-primary, #2A9D8F)";
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { style: { position: "relative", display: "inline-flex", width: size, height: size }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("circle", { cx: "12", cy: "8.2", r: "3.6", stroke: color, strokeWidth: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M4.8 20c1.3-3.4 4-5 7.2-5s5.9 1.6 7.2 5", stroke: color, strokeWidth: "2", strokeLinecap: "round" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: dotColor,
      border: "1.5px solid var(--dsw-specific-sidebar-fill, transparent)"
    } })
  ] });
}
function PageCard() {
  const status = usePoll(fetchStatus, 3e4);
  const st = status.data;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14, padding: "10px 4px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Being, { size: 64, status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { fontSize: 14, fontWeight: 600 }, children: "分身" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #bbb)" }, children: st !== void 0 ? presenceLine(st) : "…" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #888)", marginTop: 2 }, children: "会话顶部「心智」Tab 打开 TA 的房间；右下角也一直有 TA。" })
    ] })
  ] });
}
function apply(ctx) {
  const warn = (where, e) => {
    console.warn(`[dsh-mind] 槽位注册失败（${where}，显式降级）:`, e instanceof Error ? e.message : String(e));
  };
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: "@dsh-extra/dsh-mind"
  }, (props) => {
    if (props.view !== "page") return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PersonCard, {});
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PageCard, {});
  }));
  try {
    ctx.slots.inject(
      "conversation.view",
      () => ctx.slots.register(
        { name: "conversation.view", id: "mind", order: 21, label: () => "心智" },
        MindPage
      )
    );
  } catch (e) {
    console.warn("[dsh-mind] conversation.view 注册失败（显式降级）:", e instanceof Error ? e.message : String(e));
  }
  try {
    ctx.slots.inject(
      "shell.overlay",
      () => ctx.slots.register(
        { name: "shell.overlay", id: "dsh-mind-companion", order: 90, label: () => "心智" },
        () => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(CompanionLayer, {}),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ActivitySensor, {})
        ] })
      )
    );
  } catch (e) {
    console.warn("[dsh-mind] shell.overlay 注册失败（显式降级）:", e instanceof Error ? e.message : String(e));
  }
  const slots = ctx.slots;
  if (typeof slots.spec !== "function") return;
  try {
    const registerNew = slots.register;
    if (slots.spec("main") !== void 0) {
      ctx.slots.inject("main", () => registerNew({ name: "main", key: "mind" }, MindPage));
    }
    if (slots.spec("sidebar.panellist") !== void 0) {
      ctx.slots.inject("sidebar.panellist", () => registerNew(
        { name: "sidebar.panellist", id: "mind", order: 20, label: () => "心智" },
        (props) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SidebarIcon, { size: props.size, active: props.active })
      ));
    }
  } catch (e) {
    console.warn("[dsh-mind] main/panellist 注册失败（显式降级）:", e instanceof Error ? e.message : String(e));
  }
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
