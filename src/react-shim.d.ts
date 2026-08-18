declare module 'react' {
  export function createElement(type: any, props: any, ...children: any[]): any
  export function useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void]
  export function useRef<T>(initial: T): { current: T }
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
}
