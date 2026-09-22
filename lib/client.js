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
          } else setError("\u8BFB\u53D6\u5931\u8D25");
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
var fmtTime = (ts) => ts > 0 ? new Date(ts).toLocaleTimeString() : "\u2014";
var fmtUsd = (v) => `$${v.toFixed(2)}`;
function Page() {
  const { data, error, refresh } = useStatus(5e3);
  if (data === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: 12, color: "#888" }, children: error !== void 0 ? `\u8BFB\u53D6\u5931\u8D25\uFF1A${error}` : "\u8BFB\u53D6\u4E2D\u2026" });
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
      }, children: stopped ? "\u5DF2\u6682\u505C" : data.running ? "\u601D\u8003\u4E2D" : "\u5F85\u673A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u9000\u907F\u6863\u4F4D L",
        data.backoffLevel
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u4E0A\u6B21\u5524\u9192 ",
        fmtTime(data.lastWakeAt)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: capped ? "#c0392b" : soft ? "#b8860b" : void 0 }, children: [
        "\u4ECA\u65E5 ",
        fmtUsd(data.spend.usedUsd),
        " / \u786C\u9876 ",
        fmtUsd(data.spend.hardCapUsd),
        capped ? "\uFF08\u5DF2\u89E6\u9876\uFF1A\u81EA\u53D1\u6682\u505C\uFF09" : soft ? "\uFF08\u8F6F\u9876\uFF1A\u5FEB\u6A21\u578B\uFF09" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u5F85\u5904\u7406 ",
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
          children: stopped ? "\u25B6 \u6062\u590D\u5FC3\u667A" : "\u23F8 \u6682\u505C\u5FC3\u667A"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, marginBottom: 4 }, children: "\u65F6\u95F4\u7EBF\uFF08\u6700\u8FD1\uFF09" }),
      data.tail.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#888" }, children: "\u6682\u65E0\u6B65\u9AA4\u2014\u2014\u5206\u8EAB\u5C1A\u672A\u9192\u6765" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: data.tail.slice().reverse().map((step) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
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
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #888)" }, children: "\u5206\u8EAB\u5FC3\u667A\uFF1A\u6301\u7EED\u601D\u8003\u4E0E\u81EA\u4E3B\u884C\u52A8\u7684\u8FD0\u884C\u65F6\uFF08\u65F6\u95F4\u7EBF / \u8282\u594F / \u6210\u672C\u62A4\u680F\uFF09\u3002" });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Page, {});
  }));
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
