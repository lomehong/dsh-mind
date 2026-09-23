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
var import_react5 = require("react");

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
    case "message_in":
      return { ...base, kind: "you", title: `你说（来自 ${s.refs?.from ?? s.source}）`, body: clip(s.content) };
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
function presenceLine(s, now = Date.now()) {
  if (s.stoppedByMaster) return "我在休息——是你让我停的，需要时叫我";
  if (!s.enabled) return "我在沉睡（总开关未开）";
  if (s.quiet?.active === true) return `我睡着了（${s.quiet.start}–${s.quiet.end}），醒来会继续`;
  if (s.running) return "我正在想事情……";
  if (s.spend !== void 0 && s.spend.usedUsd >= s.spend.hardCapUsd) return "我今天想得够多了，在省着用（明天继续）";
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
async function fetchFeed(n = 200) {
  const resp = await fetch(`/dsh-mind/timeline?n=${n}`);
  const body = await resp.json();
  return body.steps ?? [];
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

// src/client/Companion.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var POLL_STATUS_MS = 25e3;
var POLL_FEED_MS = 2e4;
var SUB = "var(--dsw-alias-label-secondary, #888)";
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
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Section, { summary: "TA 最近的生活", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RecentLife, {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Section, { summary: "照看 TA", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CareMini, { status: st, refresh: () => {
        status.refresh();
      } }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { pointerEvents: "auto", display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        role: "button",
        title: st !== void 0 ? presenceLine(st) : "分身",
        onClick: () => setOpen((o) => !o),
        style: { cursor: "pointer", padding: 6, borderRadius: "9999px", transition: "transform .18s ease" },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "scale(1)";
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Being, { size: 56, status: st })
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 7, padding: "8px 0 4px", maxHeight: 260, overflowY: "auto" }, children: [...feed.data].reverse().map((s) => {
    const n = narrateStep(s);
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
var import_react4 = require("react");

// src/client/EngView.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var SUB2 = "var(--dsw-alias-label-secondary, #888)";
var BORDER = "var(--dsw-alias-border-l1, rgba(128,128,128,.22))";
var OK = "var(--dsw-alias-state-success-primary, #2A9D8F)";
var WARN = "var(--dsw-alias-state-warn-primary, #b8860b)";
var ERR = "var(--dsw-alias-state-error-primary, #c0392b)";
var BRAND = "var(--dsw-alias-brand-primary, #4a6fa5)";
var fmtTime = (ts) => ts > 0 ? new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
function Card({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
    background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,.06))",
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: "10px 14px",
    ...style
  }, children });
}
function Stat({ label, value, sub, accent }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { style: { flex: "1 1 150px", minWidth: 140 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 11, color: SUB2, letterSpacing: ".04em", marginBottom: 4 }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 16, fontWeight: 600, color: accent ?? "var(--dsw-alias-label-primary, inherit)" }, children: value }),
    sub !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 11, color: SUB2, marginTop: 3 }, children: sub })
  ] });
}
function Chip({ text, color }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: {
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
      return OK;
    case "share":
      return OK;
    case "learn":
    case "recall":
      return BRAND;
    case "goals":
      return WARN;
    case "idle":
      return SUB2;
    default:
      return BRAND;
  }
}
function typeChip(type, fn) {
  if (type === "wake") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { text: `wake · ${fn ?? "think"}`, color: fnColor(fn) });
  if (type === "message_in" || type === "message_out") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { text: type, color: OK });
  if (type === "error") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { text: "error", color: ERR });
  if (type === "thought") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { text: "thought", color: BRAND });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { text: type, color: SUB2 });
}
function EngView({ status, refresh }) {
  if (status === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { padding: 12, color: SUB2, fontSize: 13 }, children: "读取中…" });
  }
  const { spend } = status;
  const capped = spend.usedUsd >= spend.hardCapUsd;
  const soft = !capped && spend.usedUsd >= spend.softCapUsd;
  const stopped = status.stoppedByMaster || !status.enabled;
  const asleep = status.quiet?.active === true;
  const stateText = stopped ? "已暂停" : asleep ? "静音时段" : status.running ? "思考中" : "待机";
  const stateColor = stopped ? SUB2 : asleep ? BRAND : status.running ? OK : BRAND;
  const spendAccent = capped ? ERR : soft ? WARN : void 0;
  const pct = Math.min(100, Math.round(spend.usedUsd / Math.max(spend.hardCapUsd, 0.01) * 100));
  const nextWakeMin = status.wakeAt > Date.now() ? Math.max(1, Math.round((status.wakeAt - Date.now()) / 6e4)) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: "1 1 150px", minWidth: 140 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontSize: 11, color: SUB2, letterSpacing: ".04em", marginBottom: 4 }, children: "状态" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: {
            display: "inline-block",
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: stateColor,
            boxShadow: status.running ? `0 0 0 3px color-mix(in srgb, ${OK} 22%, transparent)` : void 0
          } }),
          stateText
        ] }),
        status.quiet?.enabled && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 11, color: SUB2, marginTop: 3 }, children: [
          "作息 ",
          status.quiet.start,
          "–",
          status.quiet.end
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Stat, { label: "退避档位", value: `L${status.backoffLevel}`, sub: `自醒间隔 ≤ ${Math.round(Math.min(3e5, 5e3 * Math.pow(2, Math.max(0, status.backoffLevel - 1))) / 1e3)}s` }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Stat, { label: "上次唤醒", value: fmtTime(status.lastWakeAt) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Stat, { label: "下次自醒", value: stopped ? "已停" : asleep ? "静音中" : nextWakeMin > 0 ? `~${nextWakeMin} 分钟` : "随时" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Stat, { label: "今日花费", value: fmtUsd(spend.usedUsd), sub: `/ 硬顶 ${fmtUsd(spend.hardCapUsd)}${capped ? " · 触顶停自发" : soft ? " · 过软顶降快模型" : ""}`, accent: spendAccent })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { flex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { height: 6, borderRadius: 3, background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.18))", overflow: "hidden" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: `${pct}%`, height: "100%", borderRadius: 3, background: spendAccent ?? OK, transition: "width .4s" } }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { fontSize: 11.5, color: SUB2, whiteSpace: "nowrap" }, children: [
          pct,
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
              border: `1px solid color-mix(in srgb, ${stopped ? OK : WARN} 45%, transparent)`,
              color: stopped ? OK : WARN,
              background: "transparent"
            },
            children: stopped ? "▶ 恢复心智" : "⏸ 暂停心智"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: SUB2 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          "待处理观察 ",
          status.pending ?? 0
        ] }),
        (status.pendingApprovals ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { color: WARN }, children: [
          "待主人批准 ",
          status.pendingApprovals
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          "软顶 ",
          fmtUsd(spend.softCapUsd),
          " · 硬顶 ",
          fmtUsd(spend.hardCapUsd)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { style: { padding: "10px 14px 14px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 12, color: SUB2, marginBottom: 8, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontWeight: 600 }, children: "提示词" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 11 }, children: "TA 每次唤醒读的行为文本——改完保存，下一拍即生效" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PromptsEditor, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { style: { padding: "10px 14px 6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { fontSize: 12, color: SUB2, marginBottom: 6, display: "flex", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontWeight: 600 }, children: "时间线 · 最近" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { fontSize: 11 }, children: [
          status.tail.length,
          " 步"
        ] })
      ] }),
      status.tail.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { color: SUB2, padding: "8px 0 10px" }, children: "暂无步骤——分身尚未醒来" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", flexDirection: "column" }, children: status.tail.slice().reverse().map((step, i, arr) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          title: step.content,
          style: {
            display: "flex",
            gap: 10,
            alignItems: "baseline",
            padding: "5px 6px",
            borderRadius: 7,
            borderBottom: i === arr.length - 1 ? "none" : `1px solid ${BORDER}`
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08))";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = "transparent";
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { color: SUB2, fontFamily: "ui-monospace, monospace", fontSize: 11.5, whiteSpace: "nowrap" }, children: new Date(step.ts).toLocaleTimeString("zh-CN", { hour12: false }) }),
            typeChip(step.type, step.fn),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, flex: 1 }, children: step.content })
          ]
        },
        step.seq
      )) })
    ] })
  ] });
}

// src/client/MindPage.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var VIEW_KEY = "dsh-mind.view";
function MindPage() {
  const [view, setView] = (0, import_react4.useState)(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "eng" ? "eng" : "person";
    } catch {
      return "person";
    }
  });
  const status = usePoll(fetchStatus, 5e3);
  if (view === "eng") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ViewToggle, { view, onToggle: () => {
        setView("person");
        try {
          localStorage.setItem(VIEW_KEY, "person");
        } catch {
        }
      } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EngView, { status: status.data })
    ] });
  }
  const st = status.data;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { maxWidth: 720, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ViewToggle, { view, onToggle: () => {
      setView("eng");
      try {
        localStorage.setItem(VIEW_KEY, "eng");
      } catch {
      }
    } }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "18px 0 6px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Being, { size: 216, status: st }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { textAlign: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 18, fontWeight: 600 }, children: "分身" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 14, color: "var(--dsw-alias-label-secondary, #bbb)", marginTop: 4 }, children: st !== void 0 ? presenceLine(st) : "…" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #888)", textAlign: "center" }, children: [
        greeting(/* @__PURE__ */ new Date()),
        "。TA 就住在这台 dsh 里——右下角也一直有 TA，说句话 TA 就会回应。",
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("br", {}),
        "想调教 TA 的行为方式？切到「工程视图」改 TA 的提示词。"
      ] })
    ] })
  ] });
}
function ViewToggle({ view, onToggle }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
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
var import_jsx_runtime6 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: {
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: C.sub }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PresenceDot, { status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: st !== void 0 ? presenceLine(st) : "分身：住在这台 dsh 里的心智" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { opacity: 0.7 }, children: "· 侧边栏「心智」看 TA" })
  ] });
}
function SidebarIcon({ size, active }) {
  const [status, setStatus] = (0, import_react5.useState)();
  (0, import_react5.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { position: "relative", display: "inline-flex", width: size, height: size }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "12", cy: "8.2", r: "3.6", stroke: color, strokeWidth: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M4.8 20c1.3-3.4 4-5 7.2-5s5.9 1.6 7.2 5", stroke: color, strokeWidth: "2", strokeLinecap: "round" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: {
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
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 14, padding: "10px 4px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Being, { size: 64, status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: 14, fontWeight: 600 }, children: "分身" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #bbb)" }, children: st !== void 0 ? presenceLine(st) : "…" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #888)", marginTop: 2 }, children: "会话顶部「心智」Tab 打开 TA 的房间；右下角也一直有 TA。" })
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
    if (props.view !== "page") return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PersonCard, {});
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PageCard, {});
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
        (props) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SidebarIcon, { size: props.size, active: props.active })
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
