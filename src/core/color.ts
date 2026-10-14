import type { ResolvedTheme } from './theme'

/**
 * 主题高亮样式的解析。
 *
 * 服务端给的是内核存下来的原始 CSS 片段（`color:#c00;font-size:1.2em`），
 * 由管理员在后台从色板里选出来。App 端只取其中两样：一个六位十六进制颜色、
 * 一个「是否放大」的布尔，绝不把整串当 style 绑上去 —— 那等于让库里的字符串
 * 直接变成样式表。
 */

const COLOR = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6})(?:\s*;|$)/
const LARGE = /(?:^|;)\s*font-size\s*:\s*1\.2em(?:\s*;|$)/i

export function highlightColor(style: string | null | undefined): string {
  const matched = COLOR.exec(style || '')
  return matched ? matched[1] : ''
}

export function highlightLarge(style: string | null | undefined): boolean {
  return LARGE.test(style || '')
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** 相对亮度，0 黑 1 白。 */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * 高亮色直接用会出事：管理员挑的深红、深蓝在深色模式下几乎看不见。
 * 所以按当前主题判一次对比度，太贴近背景就退回正文色，宁可不高亮也不要读不清。
 */
export function readableHighlight(hex: string, theme: ResolvedTheme): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return ''
  const light = luminance(hex)
  if (theme === 'dark' && light < 0.22) return ''
  if (theme === 'light' && light > 0.82) return ''
  return hex
}

/** 字母头像的底色。都在中等明度上，配白字在深浅两种底色里都站得住。 */
const LETTER_COLORS = [
  '#0e7c86',
  '#7c4dbc',
  '#a4530a',
  '#1e6fbf',
  '#b03060',
  '#3f7a2e',
  '#8a5a2b',
  '#4a5568',
]

export function letterColor(seed: number | string): string {
  const text = String(seed)
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 100003
  return LETTER_COLORS[hash % LETTER_COLORS.length]
}
