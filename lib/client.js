window.__ModuleLoader__.load({ id: "dsh-conversation-jump", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var React = __toESM(require("react"), 1);
var name = "dsh-conversation-jump-client";
var inject = ["slots"];
var SHOW_UP_SPEED_PX_PER_SECOND = 200;
var POSITION_SAMPLE_MS = 100;
var MESSAGE_ANCHOR_DIVISOR = 12;
var POSITION_EPSILON_PX = 4;
var AUTO_HIDE_MS = 5e3;
var CSS = `
  .dsh-conv-nav {
    position: fixed;
    right: 16px;
    bottom: 168px;
    z-index: 60;
    display: flex;
    flex-direction: row;
    gap: 4px;
    padding: 4px;
    pointer-events: auto;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 999px;
    background: var(--dsw-alias-button-floating-fill);
    box-shadow: var(--dsw-shadow-lv2);
  }
  .dsh-conv-nav__button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    cursor: pointer;
    color: var(--dsw-alias-label-primary);
    background: transparent;
    border: 0;
    border-radius: 999px;
  }
  .dsh-conv-nav__button:hover { background: var(--dsw-alias-interactive-bg-hover); }
  .dsh-conv-nav__button:active { background: var(--dsw-alias-interactive-bg-hover-solid); }
  .dsh-conv-nav__button svg { display: block; }
  /* Hide the built-in "to bottom" floating button (replaced by our own "\u56DE\u5230\u5E95\u90E8").
     NOTE: the CSS-module hash prefix changes across DSH upgrades, so match the
     stable _toBottomSlot suffix instead of a hard-coded hash. !important is
     required: the product rule .EvIC1a_toBottomSlot { display: flex } has the
     very same 0-1-0 specificity, so which one wins would otherwise depend on
     whether this style element lands before or after the ui-chat stylesheet. */
  [class*='_toBottomSlot'] { display: none !important; }
`;
function apply(ctx) {
  const slots = ctx.get("slots");
  if (!slots) return;
  let suppressScrollCount = 0;
  const pendingTimeouts = /* @__PURE__ */ new Set();
  const pendingIntervals = /* @__PURE__ */ new Set();
  function ensureStyle() {
    if (document.querySelector("style[data-dsh-conversation-nav]")) return;
    const style = document.createElement("style");
    style.dataset.dshConversationNav = "";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  ctx.effect(() => {
    ensureStyle();
    return () => {
      const style = document.querySelector("style[data-dsh-conversation-nav]");
      if (style) style.remove();
      for (const handle of pendingTimeouts) window.clearTimeout(handle);
      pendingTimeouts.clear();
      for (const handle of pendingIntervals) window.clearInterval(handle);
      pendingIntervals.clear();
    };
  }, "dsh-conversation-jump: styles");
  function later(callback, delay) {
    const handle = window.setTimeout(() => {
      pendingTimeouts.delete(handle);
      callback();
    }, delay);
    pendingTimeouts.add(handle);
  }
  function every(callback, delay) {
    const handle = window.setInterval(callback, delay);
    pendingIntervals.add(handle);
    return () => {
      pendingIntervals.delete(handle);
      window.clearInterval(handle);
    };
  }
  function setScrollTop(el, value) {
    suppressScrollCount += 1;
    el.scrollTop = value;
    later(() => {
      suppressScrollCount = Math.max(0, suppressScrollCount - 1);
    }, 100);
  }
  function findScrollport() {
    const el = document.querySelector("[data-conversation-scroll]");
    return el instanceof HTMLElement ? el : null;
  }
  function isOwnMessage(row) {
    const kind = row.getAttribute("data-chat-flow-kind");
    return kind === "user" || kind === "steering";
  }
  function ownMessages(scrollport) {
    return Array.from(scrollport.querySelectorAll("[data-chat-anchor-key]")).filter(isOwnMessage);
  }
  function findLoadOlderButton(scrollport) {
    const flow = scrollport.querySelector("[data-chat-flow]");
    if (!flow) return null;
    const firstItem = flow.querySelector("[data-chat-anchor-key]");
    for (const button of flow.querySelectorAll("button")) {
      if (button.closest("[data-chat-anchor-key]")) continue;
      if (firstItem && (button.compareDocumentPosition(firstItem) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue;
      return button;
    }
    return null;
  }
  function anchorOf(el) {
    const viewport = el.getBoundingClientRect();
    return viewport.top + viewport.height / MESSAGE_ANCHOR_DIVISOR;
  }
  function positionRail(scrollport, rail) {
    const flow = scrollport.querySelector("[data-chat-flow]");
    const composer = scrollport.querySelector("[data-composer-seat]");
    const right = flow ? Math.max(12, window.innerWidth - flow.getBoundingClientRect().right) : 12;
    const bottom = composer ? composer.offsetHeight + 12 : 164;
    rail.style.right = `${right}px`;
    rail.style.bottom = `${bottom}px`;
  }
  function pollLoadOlder(scrollport, onDone) {
    const before = scrollport.querySelectorAll("[data-chat-anchor-key]").length;
    let attempts = 0;
    const stop = every(() => {
      attempts += 1;
      const after = scrollport.querySelectorAll("[data-chat-anchor-key]").length;
      if (after > before || attempts >= 60) {
        stop();
        later(onDone, 60);
      }
    }, 100);
  }
  function loadAllOlder(scrollport) {
    setScrollTop(scrollport, 0);
    const button = findLoadOlderButton(scrollport);
    if (!button) return;
    if (button.disabled) {
      later(() => loadAllOlder(scrollport), 150);
      return;
    }
    suppressScrollCount += 1;
    button.click();
    pollLoadOlder(scrollport, () => {
      suppressScrollCount = Math.max(0, suppressScrollCount - 1);
      loadAllOlder(scrollport);
    });
  }
  function scrollToTop() {
    const scrollport = findScrollport();
    if (!scrollport) return;
    loadAllOlder(scrollport);
  }
  function scrollToBottom() {
    const scrollport = findScrollport();
    if (scrollport) setScrollTop(scrollport, scrollport.scrollHeight);
  }
  function scrollToPreviousAfterLoad(scrollport, priorOldestKey) {
    const messages = ownMessages(scrollport);
    if (messages.length === 0) return;
    let priorOldestIndex = 0;
    if (priorOldestKey !== null) {
      const found = messages.findIndex((message) => message.dataset.chatAnchorKey === priorOldestKey);
      if (found >= 0) priorOldestIndex = found;
    }
    const target = messages[Math.max(0, priorOldestIndex - 1)];
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchorOf(scrollport))
    );
  }
  function tryLoadOlder(scrollport) {
    const button = findLoadOlderButton(scrollport);
    if (!button || button.disabled) return false;
    const priorOldestKey = ownMessages(scrollport)[0]?.dataset.chatAnchorKey ?? null;
    setScrollTop(scrollport, 0);
    suppressScrollCount += 1;
    button.click();
    pollLoadOlder(scrollport, () => {
      suppressScrollCount = Math.max(0, suppressScrollCount - 1);
      scrollToPreviousAfterLoad(scrollport, priorOldestKey);
    });
    return true;
  }
  function scrollToPrevious() {
    const scrollport = findScrollport();
    if (!scrollport) return;
    const messages = ownMessages(scrollport);
    if (messages.length === 0) return;
    const anchor = anchorOf(scrollport);
    let target = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].getBoundingClientRect().bottom < anchor - POSITION_EPSILON_PX) {
        target = messages[i];
        break;
      }
    }
    if (target === null || target === messages[0]) {
      if (tryLoadOlder(scrollport)) return;
      if (target === null) {
        setScrollTop(scrollport, 0);
        return;
      }
    }
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchor)
    );
  }
  function scrollToNext() {
    const scrollport = findScrollport();
    if (!scrollport) return;
    const messages = ownMessages(scrollport);
    if (messages.length === 0) return;
    const anchor = anchorOf(scrollport);
    let target = null;
    for (const message of messages) {
      if (message.getBoundingClientRect().top > anchor + POSITION_EPSILON_PX) {
        target = message;
        break;
      }
    }
    if (target === null) {
      setScrollTop(scrollport, scrollport.scrollHeight);
      return;
    }
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchor)
    );
  }
  function Chevron(props) {
    let points;
    if (props.double && props.direction === "up") points = ["18 19 12 13 6 19", "18 11 12 5 6 11"];
    else if (props.double) points = ["6 5 12 11 18 5", "6 13 12 19 18 13"];
    else if (props.direction === "up") points = ["18 15 12 9 6 15"];
    else points = ["6 9 12 15 18 9"];
    return React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    }, points.map((value) => React.createElement("polyline", { key: value, points: value })));
  }
  function NavButton(props) {
    return React.createElement("button", {
      type: "button",
      className: "dsh-conv-nav__button",
      title: props.title,
      "aria-label": props.title,
      onClick: props.onClick
    }, React.createElement(Chevron, { direction: props.direction, double: props.double }));
  }
  function NavigationRail(props) {
    const current = props.useSessions ? props.useSessions((state) => state.current) : void 0;
    const [visible, setVisible] = React.useState(false);
    const [clickCount, setClickCount] = React.useState(0);
    const railRef = React.useRef(null);
    React.useEffect(() => {
      if (!visible) return;
      const handle = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
      return () => window.clearTimeout(handle);
    }, [visible, clickCount]);
    const run = (action) => {
      setClickCount((count) => count + 1);
      action();
    };
    React.useLayoutEffect(() => {
      if (!current || !visible) return;
      ensureStyle();
      const scrollport = findScrollport();
      const rail = railRef.current;
      if (scrollport && rail) positionRail(scrollport, rail);
    }, [current, visible]);
    React.useEffect(() => {
      ensureStyle();
      if (!current) return;
      let attachedScrollport = null;
      let onScroll = null;
      let lastTop = 0;
      let previousTop = 0;
      let previousTime = 0;
      const tick = () => {
        const scrollport = findScrollport();
        if (!scrollport) return;
        ensureStyle();
        const rail = railRef.current;
        if (attachedScrollport !== scrollport) {
          if (attachedScrollport && onScroll) attachedScrollport.removeEventListener("scroll", onScroll);
          attachedScrollport = scrollport;
          lastTop = scrollport.scrollTop;
          onScroll = () => {
            if (!attachedScrollport) return;
            const top = attachedScrollport.scrollTop;
            const delta = top - lastTop;
            lastTop = top;
            if (suppressScrollCount === 0 && delta > 0) setVisible(false);
          };
          scrollport.addEventListener("scroll", onScroll, { passive: true });
          previousTop = scrollport.scrollTop;
          previousTime = Date.now();
        }
        if (rail) positionRail(scrollport, rail);
        const now = Date.now();
        if (previousTime !== 0) {
          const elapsedMs = now - previousTime;
          const delta = scrollport.scrollTop - previousTop;
          if (elapsedMs > 0) {
            const speed = Math.abs(delta / elapsedMs * 1e3);
            if (delta < 0 && speed > SHOW_UP_SPEED_PX_PER_SECOND) setVisible(true);
          }
        }
        previousTop = scrollport.scrollTop;
        previousTime = now;
      };
      tick();
      const stop = every(tick, POSITION_SAMPLE_MS);
      return () => {
        stop();
        if (attachedScrollport && onScroll) attachedScrollport.removeEventListener("scroll", onScroll);
      };
    }, [current]);
    if (!current || !visible) return null;
    return React.createElement(
      "div",
      {
        className: "dsh-conv-nav",
        role: "toolbar",
        "aria-label": "\u4F1A\u8BDD\u5BFC\u822A",
        ref: railRef
      },
      React.createElement(NavButton, { title: "\u56DE\u5230\u9876\u90E8", direction: "up", double: true, onClick: () => run(scrollToTop) }),
      React.createElement(NavButton, { title: "\u4E0A\u4E00\u4E2A", direction: "up", double: false, onClick: () => run(scrollToPrevious) }),
      React.createElement(NavButton, { title: "\u4E0B\u4E00\u4E2A", direction: "down", double: false, onClick: () => run(scrollToNext) }),
      React.createElement(NavButton, { title: "\u56DE\u5230\u5E95\u90E8", direction: "down", double: true, onClick: () => run(scrollToBottom) })
    );
  }
  slots.inject("shell.overlay", () => slots.register(
    { name: "shell.overlay", id: "dsh-conversation-jump", order: 0 },
    NavigationRail
  ));
}
return module.exports; } });
