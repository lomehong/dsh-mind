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
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots"];
function useStatus(pollMs) {
  const [data, setData] = (0, import_react.useState)();
  const [error, setError] = (0, import_react.useState)();
  const [tick, setTick] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch("/dsh-mind/status");
        const body = await resp.json();
        if (!cancelled) {
          if (body.ok) {
            setData(body);
            setError(void 0);
          } else setError("读取失败");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs, tick]);
  return { data, error, refresh: () => setTick((t) => t + 1) };
}
async function setStopped(stopped) {
  await fetch("/dsh-mind/kill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stopped })
  });
}
var fmtTime = (ts) => ts > 0 ? new Date(ts).toLocaleTimeString() : "—";
var fmtUsd = (v) => `$${v.toFixed(2)}`;
function Page() {
  const { data, error, refresh } = useStatus(5e3);
  if (data === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: 12, color: "#888" }, children: error !== void 0 ? `读取失败：${error}` : "读取中…" });
  }
  const capped = data.spend.usedUsd >= data.spend.hardCapUsd;
  const soft = !capped && data.spend.usedUsd >= data.spend.softCapUsd;
  const stopped = data.stoppedByMaster || !data.enabled;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
        padding: "2px 10px",
        borderRadius: 10,
        background: stopped ? "#999" : data.running ? "#2A9D8F" : "#4a6fa5",
        color: "#fff"
      }, children: stopped ? "已暂停" : data.running ? "思考中" : "待机" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "退避档位 L",
        data.backoffLevel
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "上次唤醒 ",
        fmtTime(data.lastWakeAt)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: capped ? "#c0392b" : soft ? "#b8860b" : void 0 }, children: [
        "今日 ",
        fmtUsd(data.spend.usedUsd),
        " / 硬顶 ",
        fmtUsd(data.spend.hardCapUsd),
        capped ? "（已触顶：自发暂停）" : soft ? "（软顶：快模型）" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "待处理 ",
        data.pending
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: () => {
            void setStopped(!stopped).then(refresh);
          },
          style: { marginLeft: "auto", padding: "4px 14px", cursor: "pointer" },
          children: stopped ? "▶ 恢复心智" : "⏸ 暂停心智"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, marginBottom: 4 }, children: "时间线（最近）" }),
      data.tail.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#888" }, children: "暂无步骤——分身尚未醒来" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: data.tail.slice().reverse().map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "#888", fontFamily: "monospace", whiteSpace: "nowrap" }, children: new Date(step.ts).toLocaleTimeString() }),
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
function apply(ctx) {
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: "@dsh-extra/dsh-mind"
  }, (props) => {
    if (props.view !== "page") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #888)" }, children: "分身心智：持续思考与自主行动的运行时（时间线 / 节奏 / 成本护栏）。" });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Page, {});
  }));
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
