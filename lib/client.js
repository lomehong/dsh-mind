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
var import_react9 = require("react");

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
function isIdleWake(s) {
  if (s.type !== "wake") return false;
  if (s.fn === "idle") return true;
  const text = `${s.final ?? ""}
${s.content}`;
  return /(^|\n)\s*本拍\s*idle|FINAL\s*=\s*"?\[idle\]|^\[?\s*idle\b|Idle\s*—/i.test(text);
}
function narrateStep(s) {
  const base = { seq: s.seq, ts: s.ts };
  const clip = (t, n = 400) => t.length > n ? `${t.slice(0, n - 1)}…` : t;
  switch (s.type) {
    case "message_in": {
      const from = s.refs?.from ?? s.source;
      if (s.source === "世界观察" || from === "世界") {
        return { ...base, kind: "moment", title: `世界有动静（${s.source}）`, body: clip(s.content) };
      }
      return { ...base, kind: "you", title: `你说（来自 ${from}）`, body: clip(s.content) };
    }
    case "message_out":
      return { ...base, kind: "mind", title: "我对你说", body: clip(s.content) };
    case "wake": {
      if (isIdleWake(s)) {
        return { ...base, kind: "rest", title: FN_LABELS.idle, tone: "subtle" };
      }
      const fn = s.fn ?? "think";
      const label = FN_LABELS[fn] ?? "我在想";
      const parts = [];
      if (s.trigger !== void 0) parts.push(s.trigger);
      if (s.usage !== void 0 && (s.usage.tokensIn > 0 || s.usage.tokensOut > 0)) {
        parts.push(`${s.usage.tokensIn}/${s.usage.tokensOut} tok · $${s.usage.costUsd.toFixed(4)}`);
      }
      const detail = parts.length > 0 ? parts.join(" · ") : void 0;
      return {
        ...base,
        kind: "moment",
        title: `${label}…`,
        body: clip(s.final ?? s.content),
        ...detail !== void 0 ? { detail } : {}
      };
    }
    case "thought":
      return { ...base, kind: "moment", title: "我有个念头", body: clip(s.content) };
    case "observation":
      return { ...base, kind: "moment", title: "我注意到", body: clip(s.content) };
    case "task":
      return { ...base, kind: "moment", title: "我接了一件活", body: clip(s.content) };
    case "idle":
      return { ...base, kind: "rest", title: "我歇了一会儿", tone: "subtle" };
    case "error":
      return { ...base, kind: "break", title: "有个念头断了，醒来会接着排", body: clip(s.content, 200), tone: "warn" };
    default:
      return { ...base, kind: "moment", title: "……", body: clip(s.content) };
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
function presenceLine(s, now = Date.now()) {
  if (s.stoppedByMaster) return "我在休息——是你让我停的，需要时叫我";
  if (!s.enabled) return "我在沉睡（总开关未开）";
  if (s.quiet?.active === true) return `我睡着了（${s.quiet.start}–${s.quiet.end}），醒来会继续`;
  if (s.running) return "我正在想事情……";
  if (s.spend !== void 0 && s.spend.usedUsd >= s.spend.hardCapUsd) return "我今天想得够多了，在省着用（明天继续）";
  if ((s.openAsks ?? 0) > 0) return `有件事卡住了，等你给${s.openAskWhat !== void 0 ? `：${s.openAskWhat}` : ""}`;
  if ((s.pending ?? 0) > 0) return "我刚收到你的话，正在准备回应……";
  if (s.wakeAt > now) {
    const mins = Math.round((s.wakeAt - now) / 6e4);
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
function beingMood(s) {
  if (s === void 0) return "awake";
  if (s.stoppedByMaster || !s.enabled) return "stopped";
  if (s.quiet?.active === true) return "asleep";
  if ((s.pending ?? 0) > 0) return "attentive";
  if (s.running) return "thinking";
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
@keyframes dsh-mind-chest { from { transform: scaleY(1); } to { transform: scaleY(1.06); } }`;
  document.head.appendChild(el);
}
function Being({ size, status, silhouette = true, ripple, style }) {
  injectKeyframes();
  const mood = beingMood(status);
  const m = MOODS[mood];
  const showRipple = ripple ?? mood === "attentive";
  const breath = `dsh-mind-breathe ${m.breath} ease-in-out infinite alternate`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "relative", width: size, height: size, borderRadius: "50%", animation: breath, ...style }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
      position: "absolute",
      left: -size * 0.3,
      top: -size * 0.3,
      width: size * 1.6,
      height: size * 1.6,
      borderRadius: "50%",
      pointerEvents: "none",
      opacity: m.dim,
      animation: breath,
      background: `radial-gradient(circle, rgba(${m.rgb},.42) 0%, rgba(${m.rgb},0) 68%)`,
      filter: `blur(${Math.max(5, Math.round(size * 0.09))}px)`
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      overflow: "hidden",
      opacity: m.dim,
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
    } })
  ] });
}

// src/client/Companion.tsx
var import_react3 = require("react");

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

// src/client/format.tsx
var fmtUsd = (v) => `$${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)}`;
var fmtClock = (ts) => new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

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
var import_jsx_runtime3 = require("react/jsx-runtime");
var POLL_STATUS_MS = 25e3;
var POLL_FEED_MS = 2e4;
var SUB = "var(--dsw-alias-label-secondary, #888)";
var WARN = "var(--dsw-alias-state-warn-primary, #b8860b)";
function AskBadge({ count }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
function Section({ summary, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("details", { style: { borderTop: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.18))" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 9, opacity: 0.8 }, children: "▶" }),
          summary
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { paddingBottom: 8 }, children })
  ] });
}
function CompanionLayer() {
  const [open, setOpen] = (0, import_react3.useState)(false);
  const status = usePoll(fetchStatus, POLL_STATUS_MS);
  const st = status.data;
  const asks = st?.openAsks ?? 0;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "fixed", right: 18, bottom: 18, zIndex: 2147483e3, pointerEvents: "none" }, children: [
    open && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
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
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
            color: SUB,
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
            e.currentTarget.style.color = SUB;
          },
          children: "×"
        }
      ),
      asks > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${WARN} 40%, transparent)`
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: WARN }, children: [
          "有 ",
          asks,
          " 件事等你给",
          st?.openAskPreview !== void 0 ? `：${st.openAskPreview}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12, paddingRight: 22 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Being, { size: 62, status: st }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 14, fontWeight: 600, lineHeight: "20px" }, children: "分身" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #bbb)", lineHeight: "18px", marginTop: 2 }, children: st !== void 0 ? presenceLine(st) : "…" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Composer, { status: st, compact: true, refresh: () => {
        status.refresh();
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { summary: "TA 最近的生活", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 10.5, color: SUB, margin: "-2px 0 2px" }, children: "安静时空醒约每 30 分钟记一笔（心跳照常每 5 分钟一拍）" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RecentLife, {})
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Section, { summary: "照看 TA", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CareMini, { status: st, refresh: () => {
        status.refresh();
      } }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { pointerEvents: "auto", display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        role: "button",
        title: st !== void 0 ? presenceLine(st) : "分身",
        onClick: () => setOpen((o) => !o),
        style: { position: "relative", cursor: "pointer", padding: 6, borderRadius: "9999px", transition: "transform .18s ease" },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "scale(1)";
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Being, { size: 56, status: st }),
          asks > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AskBadge, { count: asks })
        ]
      }
    ) })
  ] });
}
function RecentLife() {
  const feed = usePoll(async () => (await fetchFeed(30)).slice(0, 14), POLL_FEED_MS);
  if (feed.data === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 12, color: SUB, padding: "6px 0" }, children: "…" });
  }
  if (feed.data.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 12, color: SUB, padding: "6px 0" }, children: "TA 还没醒过。" });
  }
  const rows = coalesceRests(feed.data.map(narrateStep));
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 7, padding: "8px 0 4px", maxHeight: 260, overflowY: "auto" }, children: rows.map((n) => {
    if (n.kind === "rest" && n.fold !== void 0 && n.fold.count > 1) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("summary", { style: { cursor: "pointer", display: "flex", gap: 8, alignItems: "baseline", color: SUB, listStyle: "revert" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { whiteSpace: "nowrap", fontSize: 11, fontFamily: "ui-monospace, monospace" }, children: [
            fmtClock(n.fold.fromTs),
            "~",
            fmtClock(n.fold.toTs)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: n.title })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: "2px 0 2px 14px", display: "flex", flexDirection: "column", gap: 2 }, children: n.fold.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 8, color: SUB, fontSize: 11 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontFamily: "ui-monospace, monospace" }, children: fmtClock(item.ts) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: item.title })
        ] }, item.seq)) })
      ] }) }, n.seq);
    }
    const text = n.kind === "you" ? `你说：${n.body ?? ""}` : n.kind === "rest" ? n.title : `${n.title}${n.body !== void 0 && n.body !== "" ? `：${n.body.slice(0, 60)}` : ""}`;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 12, alignItems: "baseline" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: SUB, whiteSpace: "nowrap", fontSize: 11, fontFamily: "ui-monospace, monospace" }, children: fmtClock(n.ts) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: n.kind === "rest" ? SUB : n.kind === "you" ? "var(--dsw-alias-label-primary, #eee)" : void 0,
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 9, fontSize: 12, padding: "8px 0 2px", color: "var(--dsw-alias-label-secondary, #bbb)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
          "今天的心思 ",
          fmtUsd(spend.usedUsd)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
          "/ ",
          fmtUsd(spend.hardCapUsd)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { height: 4, borderRadius: 2, background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: {
        width: `${pct}%`,
        height: "100%",
        borderRadius: 2,
        background: overHard ? "var(--dsw-alias-state-error-primary, #c0392b)" : overSoft ? "var(--dsw-alias-state-warn-primary, #b8860b)" : "var(--dsw-alias-state-success-primary, #2A9D8F)"
      } }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" }, children: [
      (status.pendingApprovals ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { color: "var(--dsw-alias-state-warn-primary, #b8860b)" }, children: [
        status.pendingApprovals,
        " 件等你点头"
      ] }),
      (status.openAsks ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { color: "var(--dsw-alias-state-warn-primary, #b8860b)" }, children: [
        status.openAsks,
        " 件等你给",
        status.openAskPreview !== void 0 ? `：${status.openAskPreview}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
        "软顶 ",
        fmtUsd(spend.softCapUsd)
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
var import_react8 = require("react");

// src/client/PromptsEditor.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var SUB2 = "var(--dsw-alias-label-secondary, #888)";
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
  const [data, setData] = (0, import_react4.useState)();
  const [error, setError] = (0, import_react4.useState)();
  const [draft, setDraft] = (0, import_react4.useState)({});
  const [saving, setSaving] = (0, import_react4.useState)(false);
  const [notice, setNotice] = (0, import_react4.useState)("");
  const load = () => {
    fetchPrompts().then((d) => {
      setData(d);
      const next = {};
      for (const b of d.blocks) next[b.key] = b.current;
      setDraft(next);
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  (0, import_react4.useEffect)(load, []);
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
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { color: WARN2, fontSize: 12.5, padding: "8px 0" }, children: [
      "提示词读取失败：",
      error
    ] });
  }
  if (data === void 0) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { color: SUB2, fontSize: 12.5, padding: "8px 0" }, children: "读取提示词…" });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 12, color: SUB2, lineHeight: 1.6 }, children: "这些文本块决定 TA 每次醒来「怎么想、怎么做事、怎么说话」。修改后保存，下一次唤醒即用新词； 留空或恢复默认 = 用内置词。人格与守卫来自「数字分身」设置，不在此处。" }),
    BLOCK_ORDER.map((key) => {
      const info = byKey(key);
      if (info === void 0) return null;
      const value = draft[key] ?? info.current;
      const isDefault = value === info.default;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 12.5, fontWeight: 600 }, children: info.label }),
          info.overridden && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 10.5, color: WARN2 }, children: "已自定义" }),
          !isDefault && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 10.5, color: WARN2 }, children: "未保存" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { marginLeft: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              onClick: () => setDraft((prev) => ({ ...prev, [key]: info.default })),
              style: { fontSize: 11, cursor: "pointer", border: "none", background: "transparent", color: SUB2, textDecoration: "underline" },
              children: "恢复默认"
            }
          ) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
      notice !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 12, color: notice.startsWith("已保存") ? OK : WARN2 }, children: notice })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("summary", { style: { cursor: "pointer", fontSize: 12, color: SUB2 }, children: "组装预览（TA 每次唤醒实际读到的骨架，不含时间线等动态数据）" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { style: {
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
var import_react5 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var SUB3 = "var(--dsw-alias-label-secondary, #888)";
var BORDER2 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK2 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
function Card({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: {
    background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
    border: `1px solid ${BORDER2}`,
    borderRadius: 12,
    padding: "10px 14px",
    ...style
  }, children });
}
function GoalsCard() {
  const [goals, setGoals] = (0, import_react5.useState)();
  (0, import_react5.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Card, { style: { padding: "10px 14px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { fontSize: 12, color: SUB3, marginBottom: 6, display: "flex", justifyContent: "space-between" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontWeight: 600 }, children: "活跃目标" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 11 }, children: "TA 自己立的（[目标] 标记记忆）" })
    ] }),
    goals === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: SUB3, fontSize: 12.5, padding: "4px 0" }, children: "读取中…" }) : goals.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { color: SUB3, fontSize: 12.5, padding: "4px 0" }, children: "暂无——TA 还没立过目标（goals 函数会以 [目标] 标记记录）。" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: goals.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: OK2 }, children: "◆" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: g.title, children: g.title }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: SUB3, fontSize: 11, whiteSpace: "nowrap" }, children: g.ts.slice(5, 10) })
    ] }, i)) })
  ] });
}

// src/client/MissionsCard.tsx
var import_react6 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var SUB4 = "var(--dsw-alias-label-secondary, #888)";
var BORDER3 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK3 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var WARN3 = "var(--dsw-alias-state-warn-primary, #b8860b)";
function MissionsCard() {
  const [loaded, setLoaded] = (0, import_react6.useState)();
  const [draft, setDraft] = (0, import_react6.useState)("");
  const [saving, setSaving] = (0, import_react6.useState)(false);
  const [notice, setNotice] = (0, import_react6.useState)("");
  (0, import_react6.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 4 }, children: "主人关心的长期事项" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: 12, color: SUB4, marginBottom: 6, lineHeight: 1.6 }, children: "你希望 TA 长期关注、持续跟进的事写在这里（一行一件）。安静的时候 TA 会围绕它们复盘、预研、做准备——这是 TA 的议程来源。" }),
    loaded === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: SUB4, fontSize: 12.5, padding: "4px 0" }, children: "读取中…" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            disabled: !dirty || saving,
            onClick: save,
            style: { padding: "5px 16px", fontSize: 12.5, borderRadius: 8, cursor: dirty ? "pointer" : "default", opacity: dirty ? 1 : 0.5 },
            children: saving ? "保存中…" : "保存"
          }
        ),
        notice !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: 12, color: notice.startsWith("已保存") ? OK3 : WARN3 }, children: notice })
      ] })
    ] })
  ] });
}

// src/client/EngView.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var SUB5 = "var(--dsw-alias-label-secondary, #888)";
var BORDER4 = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK4 = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var WARN4 = "var(--dsw-alias-state-warn-primary, #b8860b)";
var ERR = "var(--dsw-alias-state-error-primary, #c0392b)";
var BRAND = "var(--dsw-alias-brand-primary, #4a6fa5)";
var fmtTime = (ts) => ts > 0 ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
function Card2({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
    background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
    border: `1px solid ${BORDER4}`,
    borderRadius: 12,
    padding: "10px 14px",
    ...style
  }, children });
}
function Stat({ label, value, sub, accent }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Card2, { style: { flex: "1 1 150px", minWidth: 140 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 11, color: SUB5, letterSpacing: ".04em", marginBottom: 4 }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 16, fontWeight: 600, color: accent ?? "var(--dsw-alias-label-primary, inherit)" }, children: value }),
    sub !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 11, color: SUB5, marginTop: 3 }, children: sub })
  ] });
}
function Chip({ text, color }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: {
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
      return SUB5;
    default:
      return BRAND;
  }
}
function typeChip(type, fn) {
  if (type === "wake") return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chip, { text: `wake · ${fn ?? "think"}`, color: fnColor(fn) });
  if (type === "message_in" || type === "message_out") return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chip, { text: type, color: OK4 });
  if (type === "error") return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chip, { text: "error", color: ERR });
  if (type === "thought") return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chip, { text: "thought", color: BRAND });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chip, { text: type, color: SUB5 });
}
function EngView({ status, refresh }) {
  if (status === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { padding: 12, color: SUB5, fontSize: 13 }, children: "读取中…" });
  }
  const { spend } = status;
  const capped = spend.usedUsd >= spend.hardCapUsd;
  const soft = !capped && spend.usedUsd >= spend.softCapUsd;
  const stopped = status.stoppedByMaster || !status.enabled;
  const asleep = status.quiet?.active === true;
  const stateText = stopped ? "已暂停" : asleep ? "静音时段" : status.running ? "思考中" : "待机";
  const stateColor = stopped ? SUB5 : asleep ? BRAND : status.running ? OK4 : BRAND;
  const spendAccent = capped ? ERR : soft ? WARN4 : void 0;
  const pct = Math.min(100, Math.round(spend.usedUsd / Math.max(spend.hardCapUsd, 0.01) * 100));
  const nextWakeMin = status.wakeAt > Date.now() ? Math.max(1, Math.round((status.wakeAt - Date.now()) / 6e4)) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { flex: "1 1 150px", minWidth: 140 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Card2, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: 11, color: SUB5, letterSpacing: ".04em", marginBottom: 4 }, children: "状态" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: {
            display: "inline-block",
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: stateColor,
            boxShadow: status.running ? `0 0 0 3px color-mix(in srgb, ${OK4} 22%, transparent)` : void 0
          } }),
          stateText
        ] }),
        status.quiet?.enabled && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { fontSize: 11, color: SUB5, marginTop: 3 }, children: [
          "作息 ",
          status.quiet.start,
          "–",
          status.quiet.end
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "退避档位", value: `L${status.backoffLevel}`, sub: `自醒间隔 ≤ ${Math.round(Math.min(3e5, 5e3 * Math.pow(2, Math.max(0, status.backoffLevel - 1))) / 1e3)}s` }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "上次唤醒", value: fmtTime(status.lastWakeAt) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "下次自醒", value: stopped ? "已停" : asleep ? "静音中" : nextWakeMin > 0 ? `~${nextWakeMin} 分钟` : "随时" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Stat, { label: "今日花费", value: fmtUsd(spend.usedUsd), sub: `/ 硬顶 ${fmtUsd(spend.hardCapUsd)}${capped ? " · 触顶停自发" : soft ? " · 过软顶降快模型" : ""}`, accent: spendAccent })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Card2, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { flex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { height: 6, borderRadius: 3, background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))", overflow: "hidden" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { width: `${pct}%`, height: "100%", borderRadius: 3, background: spendAccent ?? OK4, transition: "width .4s" } }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { fontSize: 11.5, color: SUB5, whiteSpace: "nowrap" }, children: [
          pct,
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: SUB5 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
          "待处理观察 ",
          status.pending ?? 0
        ] }),
        (status.pendingApprovals ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { color: WARN4 }, children: [
          "待主人批准 ",
          status.pendingApprovals
        ] }),
        (status.openAsks ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { color: WARN4 }, children: [
          "等你给 ",
          status.openAsks,
          status.openAskPreview !== void 0 ? `：${status.openAskPreview}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
          "软顶 ",
          fmtUsd(spend.softCapUsd),
          " · 硬顶 ",
          fmtUsd(spend.hardCapUsd)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(GoalsCard, {}),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Card2, { style: { padding: "10px 14px 14px" }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MissionsCard, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Card2, { style: { padding: "10px 14px 14px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { fontSize: 12, color: SUB5, marginBottom: 8, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontWeight: 600 }, children: "提示词" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontSize: 11 }, children: "TA 每次唤醒读的行为文本——改完保存，下一拍即生效" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PromptsEditor, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Card2, { style: { padding: "10px 14px 6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { fontSize: 12, color: SUB5, marginBottom: 6, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { fontWeight: 600 }, children: "时间线 · 最近" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { fontSize: 11 }, children: [
          status.tail.length,
          " 步"
        ] })
      ] }),
      status.tail.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { color: SUB5, padding: "8px 0 10px" }, children: "暂无步骤——分身尚未醒来" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { display: "flex", flexDirection: "column" }, children: status.tail.slice().reverse().map((step, i, arr) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          title: step.content,
          style: {
            display: "flex",
            gap: 10,
            alignItems: "baseline",
            padding: "5px 6px",
            borderRadius: 7,
            borderBottom: i === arr.length - 1 ? "none" : `1px solid ${BORDER4}`
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08))";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = "transparent";
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: SUB5, fontFamily: "ui-monospace, monospace", fontSize: 11.5, whiteSpace: "nowrap" }, children: new Date(step.ts).toLocaleTimeString("zh-CN", { hour12: false }) }),
            typeChip(step.type, step.fn),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, flex: 1 }, children: step.content })
          ]
        },
        step.seq
      )) })
    ] })
  ] });
}

// src/client/LifeTimeline.tsx
var import_react7 = require("react");

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
var import_jsx_runtime8 = require("react/jsx-runtime");
var SUB6 = "var(--dsw-alias-label-secondary, #888)";
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
  const [meta, setMeta] = (0, import_react7.useState)();
  const [error, setError] = (0, import_react7.useState)();
  const [view, setView] = (0, import_react7.useState)();
  const [width, setWidth] = (0, import_react7.useState)(900);
  const [detail, setDetail] = (0, import_react7.useState)();
  const containerRef = (0, import_react7.useRef)(null);
  const dragRef = (0, import_react7.useRef)(void 0);
  (0, import_react7.useEffect)(() => {
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
  (0, import_react7.useEffect)(() => {
    const onResize = () => {
      const el = containerRef.current;
      if (el !== null && el.clientWidth > 0) setWidth((prev) => Math.abs(prev - el.clientWidth) > 2 ? el.clientWidth : prev);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (error !== void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { color: ERR2, fontSize: 12.5, padding: "8px 0" }, children: [
      "时间轴读取失败：",
      error
    ] });
  }
  if (meta === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { color: SUB6, fontSize: 12.5, padding: "8px 0" }, children: "翻开 TA 的一生…" });
  }
  if (meta.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { color: SUB6, fontSize: 12.5, padding: "8px 0" }, children: "TA 还没醒过。" });
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
  for (const s of meta) {
    const t = Date.parse(s.ts);
    if (t < v.start || t > v.end) continue;
    const start = bucketStart(level, t);
    let b = buckets.get(start);
    if (b === void 0) {
      b = { start, end: nextBucketStart(level, start), total: 0, idle: 0, items: [], color: SUB6 };
      buckets.set(start, b);
    }
    if (s.type === "idle") {
      b.idle += 1;
      continue;
    }
    b.total += 1;
    b.items.push(s);
    b.color = nodeColor(s.type, s.fn);
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
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: {
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
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { fontSize: 11, color: SUB6 }, children: [
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
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontSize: 11, color: SUB6 }, children: "· 滚轮缩放 / 拖拽平移 / 点击节点下钻" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "button",
        {
          type: "button",
          onClick: fit,
          style: { marginLeft: "auto", fontSize: 11, cursor: "pointer", border: "none", background: "transparent", color: SUB6, textDecoration: "underline" },
          children: "复位看一生"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "div",
      {
        ref: measureRef,
        onWheel,
        onMouseDown: onDragStart,
        style: { width: "100%", cursor: dragRef.current !== void 0 ? "grabbing" : "grab", userSelect: "none", touchAction: "none" },
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { width, height: HEIGHT, style: { display: "block", overflow: "visible" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("line", { x1: 0, y1: AXIS_Y, x2: width, y2: AXIS_Y, stroke: BORDER5, strokeWidth: 1 }),
          ticks.map((t) => {
            const x = msToX(t.t);
            return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { children: [
              t.major === true && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("line", { x1: x, y1: 12, x2: x, y2: AXIS_Y, stroke: BORDER5, strokeWidth: 1, strokeDasharray: "2 4", opacity: 0.55 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("line", { x1: x, y1: AXIS_Y - (t.major === true ? 9 : 6), x2: x, y2: AXIS_Y + 6, stroke: BORDER5, strokeWidth: 1 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { x: x + 4, y: AXIS_Y + 20, fontSize: t.major === true ? 11 : 10.5, fontWeight: t.major === true ? 600 : 400, fill: SUB6, fontFamily: "ui-monospace, monospace", children: t.label })
            ] }, `t${t.t}`);
          }),
          bucketList.filter((b) => b.idle > 0).map((b) => {
            const x = msToX(b.start);
            const w = Math.max(2, msToX(b.end) - x - 1);
            const h = Math.max(2, b.idle / maxIdle * 26);
            return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("rect", { x, y: AXIS_Y - h, width: w, height: h, rx: 1.5, fill: "rgba(128,128,128,.16)", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("title", { children: `${new Date(b.start).toLocaleString("zh-CN")} 起的${level === "hour" ? "一小时" : "一段"} · ${b.idle} 次心跳（空醒，非活动）` }) }, `i${b.start}`);
          }),
          bucketList.filter((b) => b.total > 0).map((b) => {
            const x = msToX(b.start) + 1;
            const w = Math.max(2, msToX(b.end) - msToX(b.start) - 2);
            const h = Math.min(96, 6 + Math.sqrt(b.total) * 11);
            const y = AXIS_Y - h;
            const dense = b.total > DENSE_BUCKET || level !== "hour";
            return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("title", { children: `${new Date(b.start).toLocaleString("zh-CN")} 起的${level === "hour" ? "一小时" : "一段"} · ${b.total} 件活动${b.idle > 0 ? `（另有 ${b.idle} 次心跳）` : ""}${dense ? " · 点击下钻" : " · 点击看详情"}` }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("rect", { x, y, width: w, height: h, rx: 3, fill: b.color, opacity: 0.82 }),
                  /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { x: x + w / 2, y: y - 4, textAnchor: "middle", fontSize: 9.5, fill: SUB6, fontWeight: 600, children: b.total > 99 ? "99+" : b.total })
                ]
              },
              `n${b.start}`
            );
          })
        ] })
      }
    ),
    detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: {
      marginTop: 10,
      padding: "8px 12px",
      borderRadius: 10,
      maxHeight: 260,
      overflowY: "auto",
      border: `1px solid ${BORDER5}`,
      background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06))"
    }, children: [
      detail.loading && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { color: SUB6, fontSize: 12.5 }, children: "载入该时段…" }),
      !detail.loading && (detail.rows === void 0 || detail.rows.length === 0) && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { color: SUB6, fontSize: 12.5 }, children: "该时段没有记录。" }),
      detail.rows?.map((n) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline", padding: "3px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: SUB6, fontSize: 11, whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }, children: fmtClock(n.ts) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
          n.title,
          n.body !== void 0 && n.body !== "" ? `：${n.body.slice(0, 80)}` : ""
        ] })
      ] }, n.seq))
    ] })
  ] });
}

// src/client/MindPage.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var VIEW_KEY = "dsh-mind.view";
function MindPage() {
  const [view, setView] = (0, import_react8.useState)(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "eng" ? "eng" : "person";
    } catch {
      return "person";
    }
  });
  const status = usePoll(fetchStatus, 5e3);
  if (view === "eng") {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { padding: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ViewToggle, { view, onToggle: () => {
        setView("person");
        try {
          localStorage.setItem(VIEW_KEY, "person");
        } catch {
        }
      } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(EngView, { status: status.data })
    ] });
  }
  const st = status.data;
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { maxWidth: 720, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ViewToggle, { view, onToggle: () => {
      setView("eng");
      try {
        localStorage.setItem(VIEW_KEY, "eng");
      } catch {
      }
    } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "18px 0 6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Being, { size: 216, status: st }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { fontSize: 18, fontWeight: 600 }, children: "分身" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { fontSize: 14, color: "var(--dsw-alias-label-secondary, #bbb)", marginTop: 4 }, children: st !== void 0 ? presenceLine(st) : "…" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #888)", textAlign: "center" }, children: [
        greeting(/* @__PURE__ */ new Date()),
        "。TA 就住在这台 dsh 里——右下角也一直有 TA，说句话 TA 就会回应。",
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("br", {}),
        "想调教 TA 的行为方式？切到「工程视图」改 TA 的提示词。"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("details", { open: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("summary", { style: { cursor: "pointer", fontSize: 13, color: "var(--dsw-alias-label-secondary, #aaa)", userSelect: "none" }, children: "TA 的一生（时间轴 · 滚轮缩放）" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { paddingTop: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(LifeTimeline, {}) })
    ] })
  ] });
}
function ViewToggle({ view, onToggle }) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "button",
    {
      type: "button",
      onClick: onToggle,
      style: { padding: "3px 10px", fontSize: 12, cursor: "pointer", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l1, #444)", background: "transparent", color: "var(--dsw-alias-label-secondary, #aaa)" },
      children: view === "person" ? "工程视图" : "回到 TA"
    }
  );
}

// src/client/index.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: {
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: C.sub }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PresenceDot, { status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: st !== void 0 ? presenceLine(st) : "分身：住在这台 dsh 里的心智" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { opacity: 0.7 }, children: "· 侧边栏「心智」看 TA" })
  ] });
}
function SidebarIcon({ size, active }) {
  const [status, setStatus] = (0, import_react9.useState)();
  (0, import_react9.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { position: "relative", display: "inline-flex", width: size, height: size }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("circle", { cx: "12", cy: "8.2", r: "3.6", stroke: color, strokeWidth: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M4.8 20c1.3-3.4 4-5 7.2-5s5.9 1.6 7.2 5", stroke: color, strokeWidth: "2", strokeLinecap: "round" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: {
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14, padding: "10px 4px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Being, { size: 64, status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 14, fontWeight: 600 }, children: "分身" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #bbb)" }, children: st !== void 0 ? presenceLine(st) : "…" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #888)", marginTop: 2 }, children: "会话顶部「心智」Tab 打开 TA 的房间；右下角也一直有 TA。" })
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
    if (props.view !== "page") return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PersonCard, {});
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PageCard, {});
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
        CompanionLayer
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
        (props) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SidebarIcon, { size: props.size, active: props.active })
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
