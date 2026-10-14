import { readStore, writeStore } from './storage'

/**
 * 站点地址。App 与小程序都要连一个具体的域名：
 * 小程序还要求该域名已在微信后台配成 request 合法域名（HTTPS + 已备案），
 * 开发阶段可以在「我的 → 站点设置」里改成本地调试地址。
 *
 * 三个来源，优先级从高到低：
 *   1. 运行时设置（存在本地存储里，改完重启到首页）
 *   2. 编译期环境变量 VITE_API_BASE_URL
 *   3. 下面这个默认值
 * 本地调试用第 2 个，不用改这个文件，打正式包也不会把本地地址带进去：
 *   VITE_API_BASE_URL=http://127.0.0.1:8099 npm run dev:h5
 */

const DEFAULT_BASE_URL = 'https://bbs1.org'

/** 编译期注入的站点地址。没设就是空串，会被下面的 || 跳过。 */
const BUILD_BASE_URL = normalize(import.meta.env.VITE_API_BASE_URL || '')

/**
 * 客户端版本。发版时改这里，同时把 manifest.json 里的 versionName 改成一样的值 ——
 * 站点可以配 min_app_version，低于它的客户端会被接口拒绝（ErrCode.VERSION）。
 */
export const APP_VERSION = '1.0.0'

let cached: string | null = null

export const API_PREFIX = '/api/v1'

export function baseUrl(): string {
  if (cached !== null) return cached
  const stored = readStore<string>('baseUrl', '')
  cached = normalize(stored) || BUILD_BASE_URL || DEFAULT_BASE_URL
  return cached
}

export function setBaseUrl(url: string): string {
  const next = normalize(url) || BUILD_BASE_URL || DEFAULT_BASE_URL
  cached = next
  writeStore('baseUrl', next)
  return next
}

function normalize(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '')
  if (trimmed === '') return ''
  if (!/^https?:\/\//i.test(trimmed)) return ''
  return trimmed
}

/** 把接口路径拼成完整地址。小程序端必须是绝对地址，H5 端用绝对地址也能走通跨域。 */
export function apiUrl(path: string, query?: Record<string, unknown>): string {
  const url = baseUrl() + API_PREFIX + (path.startsWith('/') ? path : '/' + path)
  const qs = buildQuery(query)
  return qs ? url + '?' + qs : url
}

/** 接口返回的是绝对地址，但站点地址被改到别处时以当前配置为准。 */
export function absoluteUrl(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return baseUrl() + (url.startsWith('/') ? url : '/' + url)
}

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  const parts: string[] = []
  Object.keys(query).forEach((name) => {
    const value = query[name]
    if (value === undefined || value === null || value === '') return
    parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(String(value)))
  })
  return parts.join('&')
}
