import { resolveColor } from './palette'
import { resolvedTheme } from './theme'

/**
 * 图标。
 *
 * 不引图标字体，也不放图片文件 —— 字体在小程序上要额外下载、图片则要凑齐
 * 普通/选中/深色好几套，都是二进制资产，改个颜色要重新导一遍。
 * 这里直接把 24×24 的描边 SVG 拼成 data URI 交给 <image>，
 * 颜色在生成时烘焙进去，所以深浅色和选中态都是同一套几何。
 *
 * 缓存住：同一组 (名字, 颜色, 线宽) 只拼一次。
 */

const VIEW_BOX = 24

/** 描边路径。几何统一按 24×24、线宽 1.7 设计，改单个别只改一半。 */
const PATHS: Record<string, string> = {
  home: 'M3.8 10.4 12 4l8.2 6.4V19a1.8 1.8 0 0 1-1.8 1.8h-3.9v-5.6H9.5v5.6H5.6A1.8 1.8 0 0 1 3.8 19Z',
  bell: 'M18.2 15.4V10.9a6.2 6.2 0 1 0-12.4 0v4.5L4.2 17.6h15.6ZM9.9 20.3a2.3 2.3 0 0 0 4.2 0',
  user: 'M12 11.9a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM4.9 20.6a7.1 7.1 0 0 1 14.2 0',
  search: 'M10.8 17.1a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6ZM15.4 15.4l4.2 4.2',
  plus: 'M12 5.2v13.6M5.2 12h13.6',
  minus: 'M5.2 12h13.6',
  'chevron-left': 'M14.6 5.6 8 12l6.6 6.4',
  'chevron-right': 'M9.4 5.6 16 12l-6.6 6.4',
  'chevron-down': 'M5.6 9.4 12 16l6.4-6.6',
  'arrow-left': 'M20 12H4.4M10.6 5.8 4.4 12l6.2 6.2',
  close: 'M6 6l12 12M18 6 6 18',
  comment:
    'M20 12.1c0 3.9-3.6 7.1-8 7.1a9.2 9.2 0 0 1-2.6-.4l-4.8 1.5 1.2-3.6A6.8 6.8 0 0 1 4 12.1C4 8.2 7.6 5 12 5s8 3.2 8 7.1Z',
  eye: 'M2.9 12S6.6 5.9 12 5.9 21.1 12 21.1 12 17.4 18.1 12 18.1 2.9 12 2.9 12ZM14.9 12a2.9 2.9 0 1 1-5.8 0 2.9 2.9 0 0 1 5.8 0Z',
  clock: 'M12 20.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4ZM12 7.2V12l3.2 2',
  settings:
    'M4 7.6h9M17.2 7.6H20M4 16.4h3M11.2 16.4H20M15.1 7.6a2.1 2.1 0 1 0 4.2 0 2.1 2.1 0 0 0-4.2 0ZM7.7 16.4a2.1 2.1 0 1 0 4.2 0 2.1 2.1 0 0 0-4.2 0Z',
  sliders:
    'M4 7.6h9M17.2 7.6H20M4 16.4h3M11.2 16.4H20M15.1 7.6a2.1 2.1 0 1 0 4.2 0 2.1 2.1 0 0 0-4.2 0ZM7.7 16.4a2.1 2.1 0 1 0 4.2 0 2.1 2.1 0 0 0-4.2 0Z',
  image:
    'M5.9 5h12.2A2.4 2.4 0 0 1 20.5 7.4v9.2a2.4 2.4 0 0 1-2.4 2.4H5.9a2.4 2.4 0 0 1-2.4-2.4V7.4A2.4 2.4 0 0 1 5.9 5ZM10.4 11.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM4.4 17.6l4.6-4.4 3.4 3.2 3-2.8 4.6 4.4',
  send: 'M20.8 3.2 10.2 13.8M20.8 3.2l-6.4 17.6-4.2-7.4-7.4-4.2Z',
  check: 'M5 12.8 9.6 17.4 19 7.4',
  alert: 'M12 20.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4ZM12 7.7v5M12 15.9h.01',
  info: 'M12 20.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4ZM12 11.1v4.5M12 8.1h.01',
  wechat:
    'M8.9 4.1C5.2 4.1 2.2 6.5 2.2 9.5c0 1.8 1 3.3 2.6 4.4l-.7 2.1 2.4-1.2c.7.2 1.5.3 2.3.3M15.4 8.5c3.4 0 6.2 2.2 6.2 4.9 0 2.7-2.8 4.9-6.2 4.9-.8 0-1.5-.1-2.2-.3l-2.2 1.2.6-2c-1.4-.9-2.3-2.3-2.3-3.8 0-2.7 2.7-4.9 6.1-4.9Z',
  logout:
    'M14.6 5.6H6.4A1.6 1.6 0 0 0 4.8 7.2v9.6a1.6 1.6 0 0 0 1.6 1.6h8.2M13.4 12h7.4M17.8 8.8 21 12l-3.2 3.2',
  edit: 'M4 20h4L18.6 9.4a2.13 2.13 0 0 0-3-3L5 17v3ZM14.4 6.6l3 3',
  refresh: 'M20.2 12a8.2 8.2 0 1 1-2.6-6M20.5 3.9v4.7h-4.7',
  share:
    'M17.5 3.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2ZM6.5 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2ZM17.5 15.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2ZM8.9 10.7l6.2-3.3M8.9 13.3l6.2 3.3',
  trash:
    'M4.6 6.9h14.8M9.6 6.9V4.9h4.8v2M6.7 6.9l.9 12a1.7 1.7 0 0 0 1.7 1.6h5.4a1.7 1.7 0 0 0 1.7-1.6l.9-12',
  flame:
    'M12 3.6s5.6 4.2 5.6 9a5.6 5.6 0 1 1-11.2 0c0-1.6.8-3.1 1.7-4.2.3 1.4 1.2 2.3 2.2 2.3 0-2.4 1.7-5 1.7-7.1Z',
  list: 'M4 6.6h16M4 12h11M4 17.4h7',
  shield: 'M12 3.7 5.4 6.4v5.3c0 3.9 2.7 7.2 6.6 8.6 3.9-1.4 6.6-4.7 6.6-8.6V6.4ZM9.4 12l1.9 1.9 3.5-3.7',
  link: 'M10.6 13.4a4 4 0 0 0 5.6 0l2.6-2.6a4 4 0 1 0-5.6-5.6l-1.3 1.3M13.4 10.6a4 4 0 0 0-5.6 0l-2.6 2.6a4 4 0 1 0 5.6 5.6l1.3-1.3',
  mail: 'M5.6 5.6h12.8a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2V7.6a2 2 0 0 1 2-2ZM3.9 7.4l8.1 5.4 8.1-5.4',
  lock: 'M6.6 10.6h10.8a1.6 1.6 0 0 1 1.6 1.6v6.2a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 18.4v-6.2a1.6 1.6 0 0 1 1.6-1.6ZM8.4 10.6V7.9a3.6 3.6 0 1 1 7.2 0v2.7',
  upload: 'M12 16.4V4.6M7.4 9.2 12 4.6l4.6 4.6M4.6 19.4h14.8',
  bookmark: 'M6.6 4.6h10.8a1.6 1.6 0 0 1 1.6 1.6v13.4l-7-4.2-7 4.2V6.2a1.6 1.6 0 0 1 1.6-1.6Z',
  fire: 'M12 3.6s5.6 4.2 5.6 9a5.6 5.6 0 1 1-11.2 0c0-1.6.8-3.1 1.7-4.2.3 1.4 1.2 2.3 2.2 2.3 0-2.4 1.7-5 1.7-7.1Z',
  grid: 'M4.6 4.6h6v6h-6zM13.4 4.6h6v6h-6zM4.6 13.4h6v6h-6zM13.4 13.4h6v6h-6z',
  tag: 'M4.4 11V5.6A1.2 1.2 0 0 1 5.6 4.4H11l8.6 8.6a1.2 1.2 0 0 1 0 1.7l-5.3 5.3a1.2 1.2 0 0 1-1.7 0ZM8.1 8.1h.01',
  wifi: 'M12 18.4h.01M4.8 11.4a10.2 10.2 0 0 1 14.4 0M8.2 14.8a5.4 5.4 0 0 1 7.6 0',
}

/** 选中态用填充版本，形状不变，只是把描边填满 —— 比换一套图形克制，也更像原生。 */
const FILLABLE = new Set(['home', 'bell', 'user', 'comment', 'bookmark', 'flame', 'fire'])

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 自己实现是因为小程序里没有 btoa，而 Buffer 只有 Node 端有。输入全是 ASCII。 */
function base64(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i += 3) {
    const c1 = input.charCodeAt(i)
    const c2 = input.charCodeAt(i + 1)
    const c3 = input.charCodeAt(i + 2)
    const has2 = !Number.isNaN(c2)
    const has3 = !Number.isNaN(c3)
    out += B64[c1 >> 2]
    out += B64[((c1 & 3) << 4) | (has2 ? c2 >> 4 : 0)]
    out += has2 ? B64[((c2 & 15) << 2) | (has3 ? c3 >> 6 : 0)] : '='
    out += has3 ? B64[c3 & 63] : '='
  }
  return out
}

const cache = new Map<string, string>()

export interface IconOptions {
  /** 令牌名（'accent'）或任意 CSS 颜色 */
  color?: string
  /** 线宽，默认 1.7 */
  weight?: number
  /** 填充版（仅部分图标有），用于底部栏选中态 */
  filled?: boolean
}

/** 生成可直接塞进 <image src> 的 data URI。未知名字返回空串，界面自己决定不显示。 */
export function iconUrl(name: string, options: IconOptions = {}): string {
  const path = PATHS[name]
  if (!path) return ''
  const color = resolveColor(options.color || 'muted', resolvedTheme())
  const weight = options.weight || 1.7
  const filled = !!(options.filled && FILLABLE.has(name))
  const key = name + '|' + color + '|' + weight + '|' + (filled ? 1 : 0)
  const hit = cache.get(key)
  if (hit) return hit

  const body = filled
    ? '<g fill="' + color + '" stroke="' + color + '" stroke-width="' + weight + '">' +
      '<path d="' + path + '"/></g>'
    : '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="' + weight +
      '" stroke-linecap="round" stroke-linejoin="round"/>'
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    VIEW_BOX +
    ' ' +
    VIEW_BOX +
    '" width="' +
    VIEW_BOX +
    '" height="' +
    VIEW_BOX +
    '">' +
    body +
    '</svg>'

  const url = 'data:image/svg+xml;base64,' + base64(svg)
  cache.set(key, url)
  return url
}

