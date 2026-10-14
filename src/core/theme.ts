import { readStore, writeStore } from './storage'

/**
 * 主题。
 *
 * 三端统一由 JS 解出「当前到底是浅色还是深色」，然后在外壳上挂 .theme-light / .theme-dark。
 * 不完全依赖 CSS 的 prefers-color-scheme，原因有两个：
 *   1. 小程序要在 app.json 里开 darkmode 并配 theme.json 才会让媒体查询生效，链路长且容易漏配；
 *   2. 图标是烘焙进 SVG 里的（见 core/icon.ts），颜色必须由 JS 给，两套逻辑不如合成一套。
 * global.scss 里的媒体查询只作为 JS 跑起来之前的那一帧兜底，避免深色系统下白闪。
 */

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'theme'

function normalize(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system'
}

function systemTheme(): ResolvedTheme {
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  // #endif
  try {
    const info = uni.getSystemInfoSync() as unknown as { theme?: string }
    return info.theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

let mode: ThemeMode = normalize(readStore<string>(KEY, 'system'))
let system: ResolvedTheme = systemTheme()

const listeners = new Set<(theme: ResolvedTheme) => void>()

export function themeMode(): ThemeMode {
  return mode
}

export function resolvedTheme(): ResolvedTheme {
  return mode === 'system' ? system : mode
}

export function themeClass(): string {
  return resolvedTheme() === 'dark' ? 'theme-dark' : 'theme-light'
}

export function onThemeChange(fn: (theme: ResolvedTheme) => void): void {
  listeners.add(fn)
}

export function setThemeMode(next: ThemeMode): void {
  mode = normalize(next)
  writeStore(KEY, mode)
  notify()
}

/** 跟随系统时，主题在系统切换、App 从后台回来等时机都可能变，这里统一收口。 */
function notify(): void {
  const theme = resolvedTheme()
  listeners.forEach((fn) => fn(theme))
}

function applySystem(next: ResolvedTheme): void {
  if (system === next) return
  system = next
  notify()
}

// 系统主题变化的监听。H5 用 matchMedia，小程序与 App 用 uni.onThemeChange。
// #ifdef H5
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (event: MediaQueryListEvent) => applySystem(event.matches ? 'dark' : 'light')
  if (typeof query.addEventListener === 'function') query.addEventListener('change', handler)
  else if (typeof (query as unknown as { addListener?: unknown }).addListener === 'function') {
    ;(query as unknown as { addListener: (fn: unknown) => void }).addListener(handler)
  }
}
// #endif

// #ifndef H5
if (typeof uni.onThemeChange === 'function') {
  uni.onThemeChange((res) => applySystem(res.theme === 'dark' ? 'dark' : 'light'))
}
// #endif

/** 从后台切回前台时系统主题可能已经变了，uni 的事件不一定补发。 */
export function syncSystemTheme(): void {
  applySystem(systemTheme())
}
