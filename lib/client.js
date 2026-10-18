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
var READER_INTENT_MS = 500;
var SELF_WRITE_MS = 150;
var AUTO_HIDE_MS = 3e3;
var LOAD_OLDER_RETRY_MS = 150;
var LOAD_OLDER_RETRY_LIMIT = 200;
var PREVIOUS_PAGE_LIMIT = 40;
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
    width: 30px;
    height: 26px;
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
  let paging = false;
  let toTop = false;
  let selfWriteUntil = 0;
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
    announceReaderIntent(el);
    el.scrollTop = value;
    selfWriteUntil = Date.now() + SELF_WRITE_MS;
    el.dispatchEvent(new Event("scroll"));
    el.dispatchEvent(new Event("scrollend"));
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
    const bottom = composer ? composer.offsetHeight + 16 : 168;
    rail.style.right = `${right}px`;
    rail.style.bottom = `${bottom}px`;
  }
  function pollLoadOlder(scrollport, onDone) {
    const before = scrollport.querySelectorAll("[data-chat-anchor-key]").length;
    let attempts = 0;
    const stop = every(() => {
      attempts += 1;
      const grew = scrollport.querySelectorAll("[data-chat-anchor-key]").length > before;
      if (grew || attempts >= 60) {
        stop();
        later(() => onDone(grew), 60);
      }
    }, 100);
  }
  function whenLaneFree(scrollport, then) {
    let attempts = 0;
    const attempt = () => {
      attempts += 1;
      const button = findLoadOlderButton(scrollport);
      if (!paging && (button === null || !button.disabled)) {
        then();
        return;
      }
      if (attempts < LOAD_OLDER_RETRY_LIMIT) later(attempt, LOAD_OLDER_RETRY_MS);
    };
    later(attempt, LOAD_OLDER_RETRY_MS);
  }
  function announceReaderIntent(scrollport) {
    scrollport.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true }));
  }
  function loadAllOlder(scrollport) {
    if (!toTop) {
      paging = false;
      return;
    }
    setScrollTop(scrollport, 0);
    const button = findLoadOlderButton(scrollport);
    if (!button) {
      paging = false;
      toTop = false;
      return;
    }
    if (button.disabled) {
      later(() => loadAllOlder(scrollport), LOAD_OLDER_RETRY_MS);
      return;
    }
    paging = true;
    button.click();
    announceReaderIntent(scrollport);
    pollLoadOlder(scrollport, () => loadAllOlder(scrollport));
  }
  function scrollToTop() {
    const scrollport = findScrollport();
    if (!scrollport) return;
    toTop = true;
    loadAllOlder(scrollport);
  }
  function scrollToBottom() {
    toTop = false;
    const scrollport = findScrollport();
    if (scrollport) setScrollTop(scrollport, scrollport.scrollHeight);
  }
  function landOnOwnMessage(scrollport, index) {
    const target = ownMessages(scrollport)[index];
    if (!target) return;
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchorOf(scrollport))
    );
  }
  function previousIndex(scrollport, referenceKey) {
    const messages = ownMessages(scrollport);
    if (messages.length === 0) return -1;
    if (referenceKey === null) return messages.length - 1;
    const at = messages.findIndex((message) => message.dataset.chatAnchorKey === referenceKey);
    return at < 0 ? messages.length - 1 : at - 1;
  }
  function loadPrevious(scrollport, referenceKey, hops) {
    const button = findLoadOlderButton(scrollport);
    if (!button) return false;
    if (button.disabled || paging) {
      whenLaneFree(scrollport, () => scrollToPrevious());
      return true;
    }
    setScrollTop(scrollport, 0);
    paging = true;
    button.click();
    announceReaderIntent(scrollport);
    pollLoadOlder(scrollport, (grew) => {
      paging = false;
      const index = previousIndex(scrollport, referenceKey);
      if (index >= 0) {
        landOnOwnMessage(scrollport, index);
        return;
      }
      if (grew && hops < PREVIOUS_PAGE_LIMIT && loadPrevious(scrollport, referenceKey, hops + 1)) return;
      landOnOwnMessage(scrollport, 0);
    });
    return true;
  }
  function tryLoadOlder(scrollport) {
    const referenceKey = ownMessages(scrollport)[0]?.dataset.chatAnchorKey ?? null;
    return loadPrevious(scrollport, referenceKey, 0);
  }
  function scrollToPrevious() {
    toTop = false;
    const scrollport = findScrollport();
    if (!scrollport) return;
    const messages = ownMessages(scrollport);
    if (messages.length === 0) {
      tryLoadOlder(scrollport);
      return;
    }
    const anchor = anchorOf(scrollport);
    let target = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].getBoundingClientRect().bottom < anchor - POSITION_EPSILON_PX) {
        target = messages[i];
        break;
      }
    }
    if (target === null) {
      if (tryLoadOlder(scrollport)) return;
      setScrollTop(scrollport, 0);
      return;
    }
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchor)
    );
  }
  function scrollToNext() {
    toTop = false;
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
      width: 18,
      height: 18,
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
  function currentSessionId(state) {
    if (typeof state?.current === "string" && state.current !== "") return state.current;
    const rows = state?.byId;
    if (!rows || typeof rows !== "object") return void 0;
    for (const [id, row] of Object.entries(rows)) {
      if ((row?.retainedBy?.mainView ?? 0) > 0) return id;
    }
    return void 0;
  }
  function NavigationRail(props) {
    const current = props.useSessions ? props.useSessions(currentSessionId) : void 0;
    const [visible, setVisible] = React.useState(false);
    const [clickCount, setClickCount] = React.useState(0);
    const [hovered, setHovered] = React.useState(false);
    const railRef = React.useRef(null);
    const readerIntentAt = React.useRef(0);
    React.useEffect(() => {
      if (!visible || hovered) return;
      const handle = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
      return () => window.clearTimeout(handle);
    }, [visible, clickCount, hovered]);
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
      let onIntent = null;
      let lastTop = 0;
      let previousTop = 0;
      let previousTime = 0;
      const tick = () => {
        const scrollport = findScrollport();
        if (!scrollport) return;
        ensureStyle();
        const rail = railRef.current;
        if (attachedScrollport !== scrollport) {
          if (attachedScrollport) {
            if (onScroll) attachedScrollport.removeEventListener("scroll", onScroll);
            if (onIntent) {
              attachedScrollport.removeEventListener("wheel", onIntent);
              attachedScrollport.removeEventListener("touchmove", onIntent);
              attachedScrollport.removeEventListener("keydown", onIntent);
            }
          }
          attachedScrollport = scrollport;
          lastTop = scrollport.scrollTop;
          onScroll = () => {
            if (!attachedScrollport) return;
            const top = attachedScrollport.scrollTop;
            const delta = top - lastTop;
            lastTop = top;
            if (Date.now() < selfWriteUntil) return;
            if (delta > 0 && readerIntentAt.current !== 0 && Date.now() - readerIntentAt.current < READER_INTENT_MS) {
              setVisible(false);
            }
          };
          onIntent = (event) => {
            if (!event.isTrusted) return;
            readerIntentAt.current = Date.now();
          };
          const intent = onIntent;
          scrollport.addEventListener("scroll", onScroll, { passive: true });
          scrollport.addEventListener("wheel", intent, { passive: true });
          scrollport.addEventListener("touchmove", intent, { passive: true });
          scrollport.addEventListener("keydown", intent);
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
        ref: railRef,
        onPointerEnter: () => setHovered(true),
        onPointerLeave: () => setHovered(false)
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
