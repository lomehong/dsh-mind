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
var import_react3 = require("react");

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
function narrateStep(s) {
  const base = { seq: s.seq, ts: s.ts };
  const clip = (t, n = 400) => t.length > n ? `${t.slice(0, n - 1)}…` : t;
  switch (s.type) {
    case "message_in":
      return { ...base, kind: "you", title: `你说（来自 ${s.refs?.from ?? s.source}）`, body: clip(s.content) };
    case "message_out":
      return { ...base, kind: "mind", title: "我对你说", body: clip(s.content) };
    case "wake": {
      const fn = s.fn ?? "think";
      if (fn === "idle") {
        return { ...base, kind: "rest", title: FN_LABELS.idle, tone: "subtle" };
      }
      const label = FN_LABELS[fn] ?? "我在想";
      const parts = [];
      if (s.trigger !== void 0) parts.push(s.trigger);
      if (s.usage !== void 0) parts.push(`${s.usage.tokensIn}/${s.usage.tokensOut} tok · $${s.usage.costUsd.toFixed(4)}`);
      return {
        ...base,
        kind: "moment",
        title: `${label}…`,
        body: clip(s.final ?? s.content),
        ...parts.length > 0 ? { detail: parts.join(" · ") } : {}
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
var dayKeyOf = (ts) => ts.slice(0, 10);
function groupByDay(steps, now) {
  const today = dayKeyOf(now.toISOString());
  const yesterday = dayKeyOf(new Date(now.getTime() - 864e5).toISOString());
  const groups = [];
  let current;
  for (const step of [...steps].reverse()) {
    const key = dayKeyOf(step.ts);
    if (current === void 0 || dayKeyOf(current.steps[current.steps.length - 1].ts) !== key) {
      const label = key === today ? "今天" : key === yesterday ? "昨天" : `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日${key.slice(0, 4) !== String(now.getFullYear()) ? `（${key.slice(0, 4)}）` : ""}`;
      current = { label, steps: [] };
      groups.unshift(current);
    }
    current.steps.push(narrateStep(step));
  }
  return groups;
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

// src/client/MindPage.tsx
var import_react2 = require("react");

// src/client/format.tsx
var fmtUsd = (v) => `$${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)}`;
var fmtClock = (ts) => new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
var fmtCountdown = (ms) => {
  if (ms <= 0) return "就这一两分钟";
  const mins = Math.round(ms / 6e4);
  if (mins >= 1) return `约 ${mins} 分钟后`;
  return `${Math.max(1, Math.round(ms / 1e3))} 秒后`;
};

// src/client/EngView.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var fmtTime = (ts) => ts > 0 ? new Date(ts).toLocaleTimeString() : "—";
function EngView({ status, refresh }) {
  if (status === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: 12, color: "var(--dsw-alias-label-secondary, #888)" }, children: "读取中…" });
  }
  const capped = status.spend.usedUsd >= status.spend.hardCapUsd;
  const soft = !capped && status.spend.usedUsd >= status.spend.softCapUsd;
  const stopped = status.stoppedByMaster || !status.enabled;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
        padding: "2px 10px",
        borderRadius: 10,
        background: stopped ? "var(--dsw-alias-label-secondary, #999)" : status.running ? "var(--dsw-alias-state-success-primary, #2A9D8F)" : "var(--dsw-alias-brand-primary, #4a6fa5)",
        color: "#fff"
      }, children: stopped ? "已暂停" : status.running ? "思考中" : "待机" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "退避档位 L",
        status.backoffLevel
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "上次唤醒 ",
        fmtTime(status.lastWakeAt)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: capped ? "var(--dsw-alias-state-error-primary, #c0392b)" : soft ? "var(--dsw-alias-state-warn-primary, #b8860b)" : void 0 }, children: [
        "今日 ",
        fmtUsd(status.spend.usedUsd),
        " / 硬顶 ",
        fmtUsd(status.spend.hardCapUsd),
        capped ? "（已触顶：自发暂停）" : soft ? "（软顶：快模型）" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "待处理 ",
        status.pending ?? 0
      ] }),
      status.pendingApprovals !== void 0 && status.pendingApprovals > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "待批 ",
        status.pendingApprovals
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            void setMindStopped(!stopped).then(refresh);
          },
          style: { marginLeft: "auto", padding: "4px 14px", cursor: "pointer" },
          children: stopped ? "▶ 恢复心智" : "⏸ 暂停心智"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, marginBottom: 4 }, children: "时间线（最近）" }),
      status.tail.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary, #888)" }, children: "暂无步骤——分身尚未醒来" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: status.tail.slice().reverse().map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary, #888)", fontFamily: "monospace", whiteSpace: "nowrap" }, children: new Date(step.ts).toLocaleTimeString() }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontFamily: "monospace" }, children: [
          "[",
          step.type,
          step.fn !== void 0 ? `:${step.fn}` : "",
          "]"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: step.content })
      ] }, step.seq)) })
    ] })
  ] });
}

// src/client/MindPage.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var VIEW_KEY = "dsh-mind.view";
var styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
@keyframes dsh-mind-breathe {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--dsw-alias-state-success-primary, #2A9D8F) 45%, transparent); }
  50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--dsw-alias-state-success-primary, #2A9D8F) 0%, transparent); }
}
@keyframes dsh-mind-dim {
  0%, 100% { opacity: .55; }
  50% { opacity: .8; }
}`;
  document.head.appendChild(el);
}
function PresenceOrb({ status, size = 40 }) {
  injectStyle();
  const stopped = status !== void 0 && (status.stoppedByMaster || !status.enabled);
  const asleep = status?.quiet?.active === true;
  const thinking = status?.running === true;
  const bg = stopped ? "var(--dsw-alias-label-secondary, #9aa0a6)" : asleep ? "color-mix(in srgb, var(--dsw-alias-brand-primary, #4a6fa5) 40%, #1a1c20)" : thinking || status === void 0 ? "var(--dsw-alias-state-success-primary, #2A9D8F)" : "var(--dsw-alias-brand-primary, #4a6fa5)";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: {
    width: size,
    height: size,
    borderRadius: "50%",
    background: bg,
    flexShrink: 0,
    opacity: stopped ? 0.5 : 1,
    animation: thinking ? "dsh-mind-breathe 2.4s ease-in-out infinite" : asleep ? "dsh-mind-dim 4s ease-in-out infinite" : void 0
  } });
}
function Composer({ status, refresh }) {
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
      padding: "10px 14px",
      border: "1px solid var(--dsw-alias-border-l1, #333)",
      borderRadius: 12,
      color: "var(--dsw-alias-label-secondary, #888)",
      fontSize: 13
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { flex: 1 }, children: "TA 正在休息，说不了话。" }),
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
      padding: "8px 8px 8px 14px",
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
          style: { padding: "6px 16px", cursor: "pointer", borderRadius: 8, border: "none", color: "#fff", background: "var(--dsw-alias-brand-primary, #4a6fa5)", opacity: text.trim() === "" || sending ? 0.5 : 1 },
          children: sending ? "…" : "告诉 TA"
        }
      )
    ] }),
    note !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "var(--dsw-alias-state-error-primary, #c0392b)", fontSize: 12, marginTop: 4 }, children: note })
  ] });
}
function StepRow({ step }) {
  const time = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary, #888)", fontSize: 12, whiteSpace: "nowrap" }, children: fmtClock(step.ts) });
  if (step.kind === "you") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      maxWidth: "82%",
      padding: "8px 12px",
      borderRadius: "12px 12px 3px 12px",
      background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.12))",
      border: "1px solid var(--dsw-alias-border-l1, #333)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary, #888)", marginBottom: 2 }, children: [
        "你 · ",
        time.props.children
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: step.body })
    ] }) });
  }
  if (step.kind === "mind") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", justifyContent: "flex-start" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: {
      maxWidth: "82%",
      padding: "8px 12px",
      borderRadius: "12px 12px 12px 3px",
      background: "color-mix(in srgb, var(--dsw-alias-brand-primary, #4a6fa5) 10%, transparent)",
      border: "1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4a6fa5) 35%, transparent)"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary, #888)", marginBottom: 2 }, children: [
        "TA · ",
        time.props.children
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: step.body })
    ] }) });
  }
  if (step.kind === "rest") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "baseline", justifyContent: "center", color: "var(--dsw-alias-label-secondary, #888)", fontSize: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: fmtClock(step.ts) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        "— ",
        step.title,
        " —"
      ] })
    ] });
  }
  if (step.kind === "break") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      time,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: 1, padding: "6px 10px", borderRadius: 8, fontSize: 12.5, border: "1px dashed color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b8860b) 50%, transparent)", color: "var(--dsw-alias-label-secondary, #aaa)" }, children: [
        step.title,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { style: { marginTop: 2 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { style: { cursor: "pointer", fontSize: 11, color: "var(--dsw-alias-label-secondary, #888)" }, children: "细节" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }, children: step.body })
        ] })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
    time,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: 1, minWidth: 0, padding: "6px 0 2px", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.15))" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 13, fontWeight: 600 }, children: step.title }),
      step.body !== void 0 && step.body !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary, #bbb)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }, children: step.body }),
      step.detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("details", { style: { marginTop: 2 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { style: { cursor: "pointer", fontSize: 11, color: "var(--dsw-alias-label-secondary, #888)" }, children: step.detail }) })
    ] })
  ] });
}
function LifeStream({ feed }) {
  if (feed === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary, #888)", fontSize: 13, padding: "12px 0" }, children: "TA 的生活还在加载…" });
  }
  if (feed.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary, #888)", fontSize: 13, padding: "16px 0", textAlign: "center" }, children: "TA 还没醒过 —— 说句话，或等 TA 自己醒来。" });
  }
  const groups = groupByDay(feed, /* @__PURE__ */ new Date());
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: groups.map((day) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, color: "var(--dsw-alias-label-secondary, #888)", fontSize: 12, position: "sticky", top: 0, background: "var(--dsw-alias-bg-base, transparent)", padding: "6px 0", zIndex: 1 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontWeight: 600 }, children: day.label }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { flex: 1, height: 1, background: "var(--dsw-alias-border-l1, rgba(128,128,128,.2))" } })
    ] }),
    day.steps.map((s) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StepRow, { step: s }, s.seq))
  ] }, day.label)) });
}
function CareDrawer({ status, refresh }) {
  if (status === void 0) return null;
  const { spend } = status;
  const pct = Math.min(100, Math.round(spend.usedUsd / Math.max(spend.hardCapUsd, 0.01) * 100));
  const overSoft = spend.usedUsd >= spend.softCapUsd;
  const overHard = spend.usedUsd >= spend.hardCapUsd;
  const barColor = overHard ? "var(--dsw-alias-state-error-primary, #c0392b)" : overSoft ? "var(--dsw-alias-state-warn-primary, #b8860b)" : "var(--dsw-alias-state-success-primary, #2A9D8F)";
  const stopped = status.stoppedByMaster || !status.enabled;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { style: { borderTop: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.2))", paddingTop: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("summary", { style: { cursor: "pointer", fontSize: 13, color: "var(--dsw-alias-label-secondary, #aaa)", userSelect: "none" }, children: [
      "照看 TA",
      status.pendingApprovals !== void 0 && status.pendingApprovals > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { marginLeft: 8, padding: "1px 8px", borderRadius: 8, fontSize: 11, color: "#fff", background: "var(--dsw-alias-state-warn-primary, #b8860b)" }, children: [
        status.pendingApprovals,
        " 件事等你点头"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, padding: "10px 0", color: "var(--dsw-alias-label-secondary, #bbb)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            "今天的心思花了 ",
            fmtUsd(spend.usedUsd)
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: overHard ? "触顶了，TA 在省着用" : overSoft ? "过了软顶，TA 自动放慢了" : `预算 ${fmtUsd(spend.hardCapUsd)}` })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { height: 5, borderRadius: 3, background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,.2))" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { width: `${pct}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width .4s" } }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" }, children: [
        status.quiet !== void 0 && status.quiet.enabled && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          "作息：",
          status.quiet.start,
          "–",
          status.quiet.end,
          " 睡",
          status.quiet.active ? "（已入睡）" : ""
        ] }),
        !stopped && !status.quiet?.active && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          "下次自己醒：",
          fmtCountdown(status.wakeAt - Date.now())
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            onClick: () => {
              void setMindStopped(!stopped).then(refresh);
            },
            style: { padding: "4px 12px", cursor: "pointer", borderRadius: 8 },
            children: stopped ? "叫醒 TA" : "让 TA 休息"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 11 }, children: stopped ? "TA 会记得是被你叫醒的" : "自发思考暂停；别人叫 TA 仍会回应" })
      ] })
    ] })
  ] });
}
function MindPage() {
  const [view, setView] = (0, import_react2.useState)(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "eng" ? "eng" : "person";
    } catch {
      return "person";
    }
  });
  const status = usePoll(fetchStatus, 5e3);
  const feed = usePoll(fetchFeed, 15e3);
  const refreshAll = (0, import_react2.useRef)(() => {
    status.refresh();
    feed.refresh();
  });
  (0, import_react2.useEffect)(() => {
    refreshAll.current = () => {
      status.refresh();
      feed.refresh();
    };
  });
  const topRef = (0, import_react2.useRef)(null);
  if (view === "eng") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { ref: topRef, style: { padding: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ViewToggle, { view, onToggle: () => {
        setView("person");
        try {
          localStorage.setItem(VIEW_KEY, "person");
        } catch {
        }
      } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EngView, { status: status.data, refresh: () => refreshAll.current() })
    ] });
  }
  const st = status.data;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { ref: topRef, style: { maxWidth: 720, margin: "0 auto", padding: "20px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PresenceOrb, { status: st }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 16, fontWeight: 600 }, children: "分身" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary, #bbb)" }, children: st !== void 0 ? presenceLine(st) : "TA 在…" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ViewToggle, { view, onToggle: () => {
        setView("eng");
        try {
          localStorage.setItem(VIEW_KEY, "eng");
        } catch {
        }
      } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { fontSize: 12.5, color: "var(--dsw-alias-label-secondary, #888)" }, children: [
      greeting(/* @__PURE__ */ new Date()),
      "。TA 是住在这台 dsh 里的心智——下面的流水是 TA 自己的生活。"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Composer, { status: st, refresh: () => refreshAll.current() }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(LifeStream, { feed: feed.data }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CareDrawer, { status: st, refresh: () => refreshAll.current() })
  ] });
}
function ViewToggle({ view, onToggle }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
var import_jsx_runtime3 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: {
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: C.sub }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PresenceDot, { status: st }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: st !== void 0 ? presenceLine(st) : "分身：住在这台 dsh 里的心智" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.7 }, children: "· 侧边栏「心智」看 TA" })
  ] });
}
function SidebarIcon({ size, active }) {
  const [status, setStatus] = (0, import_react3.useState)();
  (0, import_react3.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { position: "relative", display: "inline-flex", width: size, height: size }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "12", cy: "8.2", r: "3.6", stroke: color, strokeWidth: "2" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4.8 20c1.3-3.4 4-5 7.2-5s5.9 1.6 7.2 5", stroke: color, strokeWidth: "2", strokeLinecap: "round" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: {
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
function apply(ctx) {
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: "@dsh-extra/dsh-mind"
  }, (props) => {
    if (props.view !== "page") return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PersonCard, {});
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(MindPage, {});
  }));
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
        (props) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SidebarIcon, { size: props.size, active: props.active })
      ));
    }
  } catch {
  }
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
