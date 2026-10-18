import * as React from 'react'

export const name = 'dsh-conversation-jump-client'
/**
 * The web client has no `timer` service (cordis-plugin-timer is host-only), so
 * only the slots seat is declared. Declaring it is mandatory: the web boot kernel
 * creates every plugin fiber concurrently, so without this the fiber activates
 * before `@deepseek-ai/dsh-client-ui-renderer` provides `slots` and `apply` would
 * observe `ctx.get('slots') === undefined`.
 */
export const inject: string[] = ['slots']

const SHOW_UP_SPEED_PX_PER_SECOND = 200
const POSITION_SAMPLE_MS = 100
const MESSAGE_ANCHOR_DIVISOR = 12
const POSITION_EPSILON_PX = 4
/** How long a reader input still counts as the cause of the scrolls that follow it. */
const READER_INTENT_MS = 500
/** How long the scroll events of this plugin's own write still belong to it. */
const SELF_WRITE_MS = 150
const AUTO_HIDE_MS = 3000
const LOAD_OLDER_RETRY_MS = 150
const LOAD_OLDER_RETRY_LIMIT = 200
const PREVIOUS_PAGE_LIMIT = 40

const CSS = `
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
  /* Hide the built-in "to bottom" floating button (replaced by our own "回到底部").
     NOTE: the CSS-module hash prefix changes across DSH upgrades, so match the
     stable _toBottomSlot suffix instead of a hard-coded hash. !important is
     required: the product rule .EvIC1a_toBottomSlot { display: flex } has the
     very same 0-1-0 specificity, so which one wins would otherwise depend on
     whether this style element lands before or after the ui-chat stylesheet. */
  [class*='_toBottomSlot'] { display: none !important; }
`

export function apply(ctx: any): void {
  const slots = ctx.get('slots')
  if (!slots) return

  /** True while this plugin drives the host's "load older" control and its page has not landed yet. */
  let paging = false
  /** True while that drive is the "to top" loop, which keeps paging until the real top. */
  let toTop = false
  /** Timestamp until which incoming scroll events are this plugin's own writes. */
  let selfWriteUntil = 0
  const pendingTimeouts = new Set<number>()
  const pendingIntervals = new Set<number>()

  /**
   * Re-install the rail stylesheet when it is absent. Disposal removes the style
   * node while the rail component can already be mounted (the renderer's slot
   * entry and this fiber refresh independently, e.g. under the dev-mode HMR
   * driver), and nothing else would put it back until the next `apply`: the rail
   * would sit unstyled at the top-left and the product's own "to bottom" button
   * would reappear. Called every tick, so the style heals on the next 100ms
   * sample at the latest.
   */
  function ensureStyle(): void {
    if (document.querySelector('style[data-dsh-conversation-nav]')) return
    const style = document.createElement('style')
    style.dataset.dshConversationNav = ''
    style.textContent = CSS
    document.head.appendChild(style)
  }

  ctx.effect(() => {
    ensureStyle()
    return () => {
      const style = document.querySelector('style[data-dsh-conversation-nav]')
      if (style) style.remove()
      for (const handle of pendingTimeouts) window.clearTimeout(handle)
      pendingTimeouts.clear()
      for (const handle of pendingIntervals) window.clearInterval(handle)
      pendingIntervals.clear()
    }
  }, 'dsh-conversation-jump: styles')

  /** Native one-shot timer, tracked so dispose cancels anything still pending. */
  function later(callback: () => void, delay: number): void {
    const handle = window.setTimeout(() => {
      pendingTimeouts.delete(handle)
      callback()
    }, delay)
    pendingTimeouts.add(handle)
  }

  /** Native repeating timer; returns the stop handle the old `timer` service used to return. */
  function every(callback: () => void, delay: number): () => void {
    const handle = window.setInterval(callback, delay)
    pendingIntervals.add(handle)
    return () => {
      pendingIntervals.delete(handle)
      window.clearInterval(handle)
    }
  }

  /**
   * Move the scrollport ourselves. The reader asked for this jump, so it is
   * announced as reader intent first: the host otherwise keeps the paging anchor it
   * retained for a history load and re-applies it, which silently undoes the landing
   * and reads as a dead button.
   *
   * The host attributes a move to the reader only on a sampled scroll, and it
   * samples 500ms late. While a turn streams, its "follow the tail" intent re-lands
   * the viewport on the floor at every content commit, so that sample would always
   * see the floor: follow is never released and the jump is reverted — the button
   * reads as dead until a real wheel scroll clears follow. Arming the sampler with a
   * scroll event and settling it with scrollend samples the move right now, while
   * this position is current, so the host clears follow instead of fighting it.
   */
  function setScrollTop(el: HTMLElement, value: number): void {
    announceReaderIntent(el)
    el.scrollTop = value
    // Our own movement is not the reader scrolling: the rail must not retire on it,
    // even when a real wheel happened moments before (its intent window is longer
    // than this one).
    selfWriteUntil = Date.now() + SELF_WRITE_MS
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(new Event('scrollend'))
  }

  function findScrollport(): HTMLElement | null {
    const el = document.querySelector('[data-conversation-scroll]')
    return el instanceof HTMLElement ? el : null
  }

  function isOwnMessage(row: Element): boolean {
    const kind = row.getAttribute('data-chat-flow-kind')
    return kind === 'user' || kind === 'steering'
  }

  function ownMessages(scrollport: HTMLElement): HTMLElement[] {
    return Array.from(scrollport.querySelectorAll<HTMLElement>('[data-chat-anchor-key]')).filter(isOwnMessage)
  }

  function findLoadOlderButton(scrollport: HTMLElement): HTMLButtonElement | null {
    const flow = scrollport.querySelector('[data-chat-flow]')
    if (!flow) return null
    const firstItem = flow.querySelector('[data-chat-anchor-key]')
    for (const button of flow.querySelectorAll<HTMLButtonElement>('button')) {
      if (button.closest('[data-chat-anchor-key]')) continue
      if (firstItem && (button.compareDocumentPosition(firstItem) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue
      return button
    }
    return null
  }

  function anchorOf(el: HTMLElement): number {
    const viewport = el.getBoundingClientRect()
    return viewport.top + viewport.height / MESSAGE_ANCHOR_DIVISOR
  }

  function positionRail(scrollport: HTMLElement, rail: HTMLElement): void {
    const flow = scrollport.querySelector('[data-chat-flow]')
    const composer = scrollport.querySelector<HTMLElement>('[data-composer-seat]')
    const right = flow
      ? Math.max(12, window.innerWidth - flow.getBoundingClientRect().right)
      : 12
    const bottom = composer ? composer.offsetHeight + 16 : 168
    rail.style.right = `${right}px`
    rail.style.bottom = `${bottom}px`
  }

  function pollLoadOlder(scrollport: HTMLElement, onDone: (grew: boolean) => void): void {
    const before = scrollport.querySelectorAll('[data-chat-anchor-key]').length
    let attempts = 0
    const stop = every(() => {
      attempts += 1
      const grew = scrollport.querySelectorAll('[data-chat-anchor-key]').length > before
      if (grew || attempts >= 60) {
        stop()
        later(() => onDone(grew), 60)
      }
    }, 100)
  }

  /**
   * Wait until the host's paging lane is free, then run `then`. The host ignores a
   * "load older" click while a request of its own is already in flight — its button
   * is disabled and reads 加载中… — and this plugin holds the same lane while it
   * pages. A step that arrives in that window is not dropped; it waits and runs.
   * Bounded twice over: the wait gives up rather than poll a host that never comes
   * back, and it never re-arms itself.
   */
  function whenLaneFree(scrollport: HTMLElement, then: () => void): void {
    let attempts = 0
    const attempt = (): void => {
      attempts += 1
      const button = findLoadOlderButton(scrollport)
      if (!paging && (button === null || !button.disabled)) { then(); return }
      if (attempts < LOAD_OLDER_RETRY_LIMIT) later(attempt, LOAD_OLDER_RETRY_MS)
    }
    later(attempt, LOAD_OLDER_RETRY_MS)
  }

  /**
   * Announce reader intent on the scrollport. While an older page loads, the host
   * retains the row that was under the viewport as its paging anchor and re-applies
   * it as that page's content changes size — measured passes one and four to seven
   * seconds after the page lands, each of them far below the top this loop had set.
   * It drops that anchor only for a reading intent on the scrollport (`wheel`,
   * `touchstart`, `pointerdown`, the scroll keys, `beforematch`), and a programmatic
   * scroll is none of them, so the correction would otherwise win however long this
   * plugin fought it. The reader did ask for this jump, so a wheel is exactly what
   * happened; the host's intent handler never checks `isTrusted`.
   */
  function announceReaderIntent(scrollport: HTMLElement): void {
    scrollport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true }))
  }

  function loadAllOlder(scrollport: HTMLElement): void {
    // A "previous", "next" or "to bottom" step supersedes an in-flight "to top"
    // jump: stop paging there.
    if (!toTop) { paging = false; return }
    setScrollTop(scrollport, 0)
    const button = findLoadOlderButton(scrollport)
    if (!button) { paging = false; toTop = false; return }
    if (button.disabled) {
      later(() => loadAllOlder(scrollport), LOAD_OLDER_RETRY_MS)
      return
    }
    paging = true
    button.click()
    // The click begins the host's paging ownership; release it before that page
    // lands, or its anchor restore lands the reader mid-history instead of on top.
    announceReaderIntent(scrollport)
    pollLoadOlder(scrollport, () => loadAllOlder(scrollport))
  }

  function scrollToTop(): void {
    const scrollport = findScrollport()
    if (!scrollport) return
    toTop = true
    loadAllOlder(scrollport)
  }

  function scrollToBottom(): void {
    // An explicit "to bottom" supersedes an in-flight "to top" jump.
    toTop = false
    const scrollport = findScrollport()
    if (scrollport) setScrollTop(scrollport, scrollport.scrollHeight)
  }

  /** Put the own message at `index` on the anchor line. */
  function landOnOwnMessage(scrollport: HTMLElement, index: number): void {
    const target = ownMessages(scrollport)[index]
    if (!target) return
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchorOf(scrollport)),
    )
  }

  /**
   * Index of the own message a "previous" step should land on, or -1 while the
   * message before the reader is still outside the loaded window. Without a
   * reference message the reader sits after everything loaded, so the newest own
   * message is the one to land on; a reference that is gone falls back the same way.
   */
  function previousIndex(scrollport: HTMLElement, referenceKey: string | null): number {
    const messages = ownMessages(scrollport)
    if (messages.length === 0) return -1
    if (referenceKey === null) return messages.length - 1
    const at = messages.findIndex((message) => message.dataset.chatAnchorKey === referenceKey)
    return at < 0 ? messages.length - 1 : at - 1
  }

  /**
   * Page older history in until the user message before `referenceKey` is loaded,
   * then land on it. The host pages by node count — 50 per request — while a single
   * agent turn routinely spans more than that, so a page that adds no user message
   * at all is normal. Landing right after such a page would put the view back where
   * it started and read as "the button did nothing"; `hops` bounds the search. When
   * the reference is already the oldest loaded message and the host has nothing
   * left, the oldest one is the best landing there is.
   */
  function loadPrevious(scrollport: HTMLElement, referenceKey: string | null, hops: number): boolean {
    const button = findLoadOlderButton(scrollport)
    if (!button) return false
    if (button.disabled || paging) {
      whenLaneFree(scrollport, () => scrollToPrevious())
      return true
    }
    setScrollTop(scrollport, 0)
    paging = true
    button.click()
    // Same ownership as the "to top" loop: this page lands on a row the host would
    // otherwise drag back to the reading anchor it retained for the page load.
    announceReaderIntent(scrollport)
    pollLoadOlder(scrollport, (grew) => {
      paging = false
      const index = previousIndex(scrollport, referenceKey)
      if (index >= 0) { landOnOwnMessage(scrollport, index); return }
      if (grew && hops < PREVIOUS_PAGE_LIMIT && loadPrevious(scrollport, referenceKey, hops + 1)) return
      landOnOwnMessage(scrollport, 0)
    })
    return true
  }

  function tryLoadOlder(scrollport: HTMLElement): boolean {
    const referenceKey = ownMessages(scrollport)[0]?.dataset.chatAnchorKey ?? null
    return loadPrevious(scrollport, referenceKey, 0)
  }

  function scrollToPrevious(): void {
    // A "previous" step supersedes an in-flight "to top" jump.
    toTop = false
    const scrollport = findScrollport()
    if (!scrollport) return
    const messages = ownMessages(scrollport)
    if (messages.length === 0) {
      // One agent turn can span more nodes than a host page, so the loaded window
      // may hold no user message at all — the reader's own question is still
      // outside it. Page older history in until one shows up.
      tryLoadOlder(scrollport)
      return
    }

    const anchor = anchorOf(scrollport)
    let target: HTMLElement | null = null
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].getBoundingClientRect().bottom < anchor - POSITION_EPSILON_PX) {
        target = messages[i]
        break
      }
    }

    // Page older history in only when there is no own message above the anchor at
    // all. An own message that merely happens to be the oldest *loaded* one is still
    // this step's target: landing on it is the step, and paging first would lock onto
    // the message before it (loadPrevious lands on `reference - 1`) and skip the
    // reader's question by one.
    if (target === null) {
      if (tryLoadOlder(scrollport)) return
      setScrollTop(scrollport, 0)
      return
    }

    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchor),
    )
  }

  function scrollToNext(): void {
    // A "next" step supersedes an in-flight "to top" jump, whose pending page would
    // otherwise scroll back to the top right after this step moved the viewport.
    toTop = false
    const scrollport = findScrollport()
    if (!scrollport) return
    const messages = ownMessages(scrollport)
    if (messages.length === 0) return

    const anchor = anchorOf(scrollport)
    let target: HTMLElement | null = null
    for (const message of messages) {
      if (message.getBoundingClientRect().top > anchor + POSITION_EPSILON_PX) {
        target = message
        break
      }
    }
    if (target === null) { setScrollTop(scrollport, scrollport.scrollHeight); return }
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchor),
    )
  }

  function Chevron(props: { direction: 'up' | 'down'; double: boolean }): any {
    let points: string[]
    if (props.double && props.direction === 'up') points = ['18 19 12 13 6 19', '18 11 12 5 6 11']
    else if (props.double) points = ['6 5 12 11 18 5', '6 13 12 19 18 13']
    else if (props.direction === 'up') points = ['18 15 12 9 6 15']
    else points = ['6 9 12 15 18 9']

    return React.createElement('svg', {
      viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
      strokeLinejoin: 'round', 'aria-hidden': true,
    }, points.map((value) => React.createElement('polyline', { key: value, points: value })))
  }

  function NavButton(props: {
    title: string
    direction: 'up' | 'down'
    double: boolean
    onClick: () => void
  }): any {
    return React.createElement('button', {
      type: 'button',
      className: 'dsh-conv-nav__button',
      title: props.title,
      'aria-label': props.title,
      onClick: props.onClick,
    }, React.createElement(Chevron, { direction: props.direction, double: props.double }))
  }

  /**
   * The session the main view shows, or undefined when no conversation is open.
   * DSH 0.1.x published it as the sessions store's `current` field; 0.2 dropped
   * that field and marks the session its main view retains instead, which is how
   * the shipped client derives the same id. Reading only `current` would leave
   * the rail permanently unrendered on 0.2, since the gate below rejects
   * undefined.
   */
  function currentSessionId(state: any): string | undefined {
    if (typeof state?.current === 'string' && state.current !== '') return state.current
    const rows = state?.byId
    if (!rows || typeof rows !== 'object') return undefined
    for (const [id, row] of Object.entries<any>(rows)) {
      if (((row?.retainedBy?.mainView) ?? 0) > 0) return id
    }
    return undefined
  }

  function NavigationRail(props: any): any {
    const current = props.useSessions ? props.useSessions(currentSessionId) : undefined
    const [visible, setVisible] = React.useState(false)
    const [clickCount, setClickCount] = React.useState(0)
    const [hovered, setHovered] = React.useState(false)
    const railRef = React.useRef<HTMLElement | null>(null)
    /** When the reader last drove the viewport themselves (wheel, touch, keys). */
    const readerIntentAt = React.useRef(0)

    // Auto-hide: each appearance lasts AUTO_HIDE_MS, and a click restarts that
    // countdown so the rail stays while it is actually being used. A pointer on the
    // rail counts as use — hiding it under a reader who is reaching for a button is
    // how a click ends up on the conversation instead.
    React.useEffect(() => {
      if (!visible || hovered) return
      const handle = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS)
      return () => window.clearTimeout(handle)
    }, [visible, clickCount, hovered])

    const run = (action: () => void): void => {
      setClickCount((count) => count + 1)
      action()
    }

    React.useLayoutEffect(() => {
      if (!current || !visible) return
      ensureStyle()
      const scrollport = findScrollport()
      const rail = railRef.current
      if (scrollport && rail) positionRail(scrollport, rail)
    }, [current, visible])

    React.useEffect(() => {
      ensureStyle()
      if (!current) return

      let attachedScrollport: HTMLElement | null = null
      let onScroll: (() => void) | null = null
      let onIntent: ((event: Event) => void) | null = null
      let lastTop = 0
      let previousTop = 0
      let previousTime = 0

      const tick = (): void => {
        const scrollport = findScrollport()
        if (!scrollport) return
        ensureStyle()
        const rail = railRef.current

        if (attachedScrollport !== scrollport) {
          if (attachedScrollport) {
            if (onScroll) attachedScrollport.removeEventListener('scroll', onScroll)
            if (onIntent) {
              attachedScrollport.removeEventListener('wheel', onIntent)
              attachedScrollport.removeEventListener('touchmove', onIntent)
              attachedScrollport.removeEventListener('keydown', onIntent)
            }
          }
          attachedScrollport = scrollport
          lastTop = scrollport.scrollTop
          onScroll = () => {
            if (!attachedScrollport) return
            const top = attachedScrollport.scrollTop
            const delta = top - lastTop
            lastTop = top
            if (Date.now() < selfWriteUntil) return
            // Only the reader's own scrolling retires the rail. This plugin's jumps and
            // the host's own corrections (its paging anchor lands a second or more after
            // a page commits) also move the viewport down, and hiding on those took the
            // buttons away mid-use: the next click had nothing left to hit.
            if (delta > 0 && readerIntentAt.current !== 0 && Date.now() - readerIntentAt.current < READER_INTENT_MS) {
              setVisible(false)
            }
          }
          onIntent = (event: Event) => {
            // Only real input counts: this plugin dispatches a wheel to claim its own
            // jumps from the host, and that must not be read as the reader scrolling.
            if (!event.isTrusted) return
            readerIntentAt.current = Date.now()
          }
          const intent = onIntent
          scrollport.addEventListener('scroll', onScroll, { passive: true })
          scrollport.addEventListener('wheel', intent, { passive: true })
          scrollport.addEventListener('touchmove', intent, { passive: true })
          scrollport.addEventListener('keydown', intent)
          previousTop = scrollport.scrollTop
          previousTime = Date.now()
        }

        if (rail) positionRail(scrollport, rail)

        const now = Date.now()
        if (previousTime !== 0) {
          const elapsedMs = now - previousTime
          const delta = scrollport.scrollTop - previousTop
          if (elapsedMs > 0) {
            const speed = Math.abs(delta / elapsedMs * 1000)
            if (delta < 0 && speed > SHOW_UP_SPEED_PX_PER_SECOND) setVisible(true)
          }
        }
        previousTop = scrollport.scrollTop
        previousTime = now
      }

      tick()
      const stop = every(tick, POSITION_SAMPLE_MS)
      return () => {
        stop()
        if (attachedScrollport && onScroll) attachedScrollport.removeEventListener('scroll', onScroll)
      }
    }, [current])

    if (!current || !visible) return null
    return React.createElement('div', {
      className: 'dsh-conv-nav',
      role: 'toolbar',
      'aria-label': '会话导航',
      ref: railRef,
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
    },
    React.createElement(NavButton, { title: '回到顶部', direction: 'up', double: true, onClick: () => run(scrollToTop) }),
    React.createElement(NavButton, { title: '上一个', direction: 'up', double: false, onClick: () => run(scrollToPrevious) }),
    React.createElement(NavButton, { title: '下一个', direction: 'down', double: false, onClick: () => run(scrollToNext) }),
    React.createElement(NavButton, { title: '回到底部', direction: 'down', double: true, onClick: () => run(scrollToBottom) }))
  }

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-conversation-jump', order: 0 },
    NavigationRail,
  ))
}
