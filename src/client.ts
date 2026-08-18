import * as React from 'react'

export const name = 'dsh-conversation-nav-client'
export const inject: string[] = []

const SHOW_UP_SPEED_PX_PER_SECOND = 200
const POSITION_SAMPLE_MS = 100
const MESSAGE_ANCHOR_DIVISOR = 12
const POSITION_EPSILON_PX = 4

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
    width: 34px;
    height: 34px;
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
     NOTE: .Md3f7G_toBottom is a product-internal CSS-module hash and may change across DSH upgrades. */
  .Md3f7G_toBottom { display: none; }
`

export function apply(ctx: any): void {
  const slots = ctx.get('slots')
  if (!slots) return

  const timer = ctx.get('timer')
  let suppressScrollCount = 0

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.dshConversationNav = ''
    style.textContent = CSS
    document.head.appendChild(style)
    return () => style.remove()
  }, 'dsh-conversation-nav: styles')

  function setScrollTop(el: HTMLElement, value: number): void {
    suppressScrollCount += 1
    el.scrollTop = value
    if (timer) timer.timeout(() => { suppressScrollCount = Math.max(0, suppressScrollCount - 1) }, 100)
    else suppressScrollCount = Math.max(0, suppressScrollCount - 1)
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

  function pollLoadOlder(scrollport: HTMLElement, onDone: () => void): void {
    if (!timer) { onDone(); return }
    const before = scrollport.querySelectorAll('[data-chat-anchor-key]').length
    let attempts = 0
    const stop = timer.interval(() => {
      attempts += 1
      const after = scrollport.querySelectorAll('[data-chat-anchor-key]').length
      if (after > before || attempts >= 60) {
        stop()
        timer.timeout(onDone, 60)
      }
    }, 100)
  }

  function loadAllOlder(scrollport: HTMLElement): void {
    setScrollTop(scrollport, 0)
    const button = findLoadOlderButton(scrollport)
    if (!button) return
    if (button.disabled) {
      if (timer) timer.timeout(() => loadAllOlder(scrollport), 150)
      return
    }
    suppressScrollCount += 1
    button.click()
    pollLoadOlder(scrollport, () => {
      suppressScrollCount = Math.max(0, suppressScrollCount - 1)
      loadAllOlder(scrollport)
    })
  }

  function scrollToTop(): void {
    const scrollport = findScrollport()
    if (!scrollport) return
    loadAllOlder(scrollport)
  }

  function scrollToBottom(): void {
    const scrollport = findScrollport()
    if (scrollport) setScrollTop(scrollport, scrollport.scrollHeight)
  }

  function scrollToPreviousAfterLoad(scrollport: HTMLElement, priorOldestKey: string | null): void {
    const messages = ownMessages(scrollport)
    if (messages.length === 0) return
    let priorOldestIndex = 0
    if (priorOldestKey !== null) {
      const found = messages.findIndex((message) => message.dataset.chatAnchorKey === priorOldestKey)
      if (found >= 0) priorOldestIndex = found
    }
    const target = messages[Math.max(0, priorOldestIndex - 1)]
    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchorOf(scrollport)),
    )
  }

  function tryLoadOlder(scrollport: HTMLElement): boolean {
    const button = findLoadOlderButton(scrollport)
    if (!button || button.disabled) return false
    const priorOldestKey = ownMessages(scrollport)[0]?.dataset.chatAnchorKey ?? null
    setScrollTop(scrollport, 0)
    suppressScrollCount += 1
    button.click()
    pollLoadOlder(scrollport, () => {
      suppressScrollCount = Math.max(0, suppressScrollCount - 1)
      scrollToPreviousAfterLoad(scrollport, priorOldestKey)
    })
    return true
  }

  function scrollToPrevious(): void {
    const scrollport = findScrollport()
    if (!scrollport) return
    const messages = ownMessages(scrollport)
    if (messages.length === 0) return

    const anchor = anchorOf(scrollport)
    let target: HTMLElement | null = null
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].getBoundingClientRect().bottom < anchor - POSITION_EPSILON_PX) {
        target = messages[i]
        break
      }
    }

    if (target === null || target === messages[0]) {
      if (tryLoadOlder(scrollport)) return
      if (target === null) { setScrollTop(scrollport, 0); return }
    }

    setScrollTop(
      scrollport,
      Math.max(0, scrollport.scrollTop + target.getBoundingClientRect().top - anchor),
    )
  }

  function scrollToNext(): void {
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

  function NavigationRail(props: any): any {
    const current = props.useSessions ? props.useSessions((state: any) => state.current) : undefined
    const [visible, setVisible] = React.useState(false)
    const railRef = React.useRef<HTMLElement | null>(null)

    React.useLayoutEffect(() => {
      if (!current || !visible) return
      const scrollport = findScrollport()
      const rail = railRef.current
      if (scrollport && rail) positionRail(scrollport, rail)
    }, [current, visible])

    React.useEffect(() => {
      if (!current) return

      let attachedScrollport: HTMLElement | null = null
      let onScroll: (() => void) | null = null
      let lastTop = 0
      let previousTop = 0
      let previousTime = 0

      const tick = (): void => {
        const scrollport = findScrollport()
        if (!scrollport) return
        const rail = railRef.current

        if (attachedScrollport !== scrollport) {
          if (attachedScrollport && onScroll) attachedScrollport.removeEventListener('scroll', onScroll)
          attachedScrollport = scrollport
          lastTop = scrollport.scrollTop
          onScroll = () => {
            if (!attachedScrollport) return
            const top = attachedScrollport.scrollTop
            const delta = top - lastTop
            lastTop = top
            if (suppressScrollCount === 0 && delta > 0) setVisible(false)
          }
          scrollport.addEventListener('scroll', onScroll, { passive: true })
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
      if (!timer) return
      const stop = timer.interval(tick, POSITION_SAMPLE_MS)
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
    },
    React.createElement(NavButton, { title: '回到顶部', direction: 'up', double: true, onClick: scrollToTop }),
    React.createElement(NavButton, { title: '上一个', direction: 'up', double: false, onClick: scrollToPrevious }),
    React.createElement(NavButton, { title: '下一个', direction: 'down', double: false, onClick: scrollToNext }),
    React.createElement(NavButton, { title: '回到底部', direction: 'down', double: true, onClick: scrollToBottom }))
  }

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-conversation-nav', order: 0 },
    NavigationRail,
  ))
}
