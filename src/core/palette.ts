import type { ResolvedTheme } from './theme'

/**
 * 调色板的 JS 副本，只服务于「必须由 JS 给出颜色」的地方 —— 目前就是图标
 * （颜色烘焙进 SVG，没法用 CSS 变量）。
 * 值和 styles/global.scss 里的令牌一一对应，改一处要改两处，别只改一边。
 */

interface Palette {
  bg: string
  surface: string
  surface2: string
  ink: string
  ink2: string
  muted: string
  line: string
  accent: string
  accentInk: string
  danger: string
  warn: string
  white: string
}

const PALETTES: Record<ResolvedTheme, Palette> = {
  light: {
    bg: '#f1f3f5',
    surface: '#ffffff',
    surface2: '#f7f8fa',
    ink: '#12181f',
    ink2: '#3c4650',
    muted: '#6b7684',
    line: '#e3e7ec',
    accent: '#0e7c86',
    accentInk: '#ffffff',
    danger: '#c0392b',
    warn: '#b45309',
    white: '#ffffff',
  },
  dark: {
    bg: '#0c1013',
    surface: '#141a1e',
    surface2: '#1b2228',
    ink: '#e8edf1',
    ink2: '#b8c2cb',
    muted: '#8a96a1',
    line: '#232c33',
    accent: '#45c8d0',
    accentInk: '#05272a',
    danger: '#f0837a',
    warn: '#e5a45c',
    white: '#ffffff',
  },
}

/** 传令牌名（'accent'）或任意 CSS 颜色（'#fff'、'rgba(...)'）都行。 */
export function resolveColor(value: string, theme: ResolvedTheme): string {
  const palette = PALETTES[theme] as unknown as Record<string, string>
  return Object.prototype.hasOwnProperty.call(palette, value) ? palette[value] : value
}
