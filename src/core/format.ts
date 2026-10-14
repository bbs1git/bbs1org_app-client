/**
 * 时间与数字的展示。服务端给的是 ISO 8601 带时区的字符串（DATE_ATOM），
 * 这里不直接 new Date(str) —— 各端 JS 引擎对非标准格式的容忍度不一样，
 * 小程序和部分 iOS 版本会解析出 Invalid Date，所以自己拆。
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/

export function parseTime(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value)
  const matched = ISO.exec(value.trim())
  if (!matched) return null
  return new Date(
    Number(matched[1]),
    Number(matched[2]) - 1,
    Number(matched[3]),
    Number(matched[4]),
    Number(matched[5]),
    Number(matched[6]),
  )
}

function pad(value: number): string {
  return value < 10 ? '0' + value : String(value)
}

/** 列表里用的相对时间：一小时内按分钟，一天内按小时，一周内按天，再久就给日期。 */
export function relativeTime(value: string | null | undefined): string {
  const date = parseTime(value)
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return shortDate(date)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return Math.floor(diff / minute) + ' 分钟前'
  if (diff < day) return Math.floor(diff / hour) + ' 小时前'
  if (diff < 2 * day) return '昨天 ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
  if (diff < 7 * day) return Math.floor(diff / day) + ' 天前'
  return shortDate(date)
}

export function shortDate(date: Date): string {
  const now = new Date()
  if (date.getFullYear() === now.getFullYear()) {
    return date.getMonth() + 1 + '月' + date.getDate() + '日'
  }
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日'
}

/** 详情页用的完整时间 */
export function fullTime(value: string | null | undefined): string {
  const date = parseTime(value)
  if (!date) return ''
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  )
}

/** 大数字压缩：1.2万、3.4亿。中文语境下比 12k 更好读。 */
export function compactNumber(value: number): string {
  const n = Number(value) || 0
  if (n < 10000) return String(n)
  if (n < 100000000) {
    const w = n / 10000
    return (w >= 100 ? Math.round(w) : Math.round(w * 10) / 10) + '万'
  }
  return Math.round((n / 100000000) * 10) / 10 + '亿'
}

export function charCount(value: string): number {
  return Array.from(value || '').length
}
