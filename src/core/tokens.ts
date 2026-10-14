import { ApiError, ErrCode } from './errors'
import { API_PREFIX, baseUrl } from './config'
import { readStore, removeStore, writeStore } from './storage'
import type { Account } from './types'

/**
 * 令牌与会话。
 *
 * 这里刻意不依赖 http.ts —— 换令牌这个请求本身不能被 401 拦截器再拦一次，
 * 否则续期失败会递归。所以它自己发一次裸请求，也顺手避开了两者互相 import 的环。
 *
 * 服务端是「刷新即轮换」：换新令牌时旧的一对立刻作废。因此同一次过期只能发一次续期请求，
 * 并发到达的请求必须排队等这一发的结果，否则后发的那次会把先发的那对新令牌顶掉。
 */

export interface TokenPair {
  accessToken: string
  refreshToken: string
  /** 毫秒时间戳 */
  expiresAt: number
  refreshExpiresAt: number
}

/**
 * 本地存的用户快照。就是接口给的账号对象本身 —— 另立一份窄类型只会慢慢和
 * 服务端的字段对不上，还要在每个赋值处做一次转换。
 */
export type SessionUser = Account

interface StoredSession {
  tokens: TokenPair
  user: SessionUser | null
}

const STORE_KEY = 'session'
/** 访问令牌剩余时间少于这个值就提前续期，避免请求卡在过期的边线上。 */
const REFRESH_AHEAD_MS = 60_000

let session: StoredSession | null = load()
let refreshing: Promise<boolean> | null = null

const listeners = new Set<() => void>()

function load(): StoredSession | null {
  const raw = readStore<StoredSession | null>(STORE_KEY, null)
  if (!raw || !raw.tokens || !raw.tokens.accessToken) return null
  return raw
}

function persist(): void {
  if (session) writeStore(STORE_KEY, session)
  else removeStore(STORE_KEY)
}

function notify(): void {
  listeners.forEach((fn) => {
    try {
      fn()
    } catch {
      // 单个订阅者出错不能影响其他订阅者
    }
  })
}

export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function currentUser(): SessionUser | null {
  return session ? session.user : null
}

export function accessToken(): string {
  return session ? session.tokens.accessToken : ''
}

function refreshToken(): string {
  return session ? session.tokens.refreshToken : ''
}

export function isLoggedIn(): boolean {
  return session !== null
}

export function saveSession(pair: TokenPair, user: SessionUser | null): void {
  session = { tokens: pair, user }
  persist()
  notify()
}

export function patchUser(user: SessionUser | null): void {
  if (!session) return
  session = { tokens: session.tokens, user }
  persist()
  notify()
}

export function clearSession(): void {
  session = null
  refreshing = null
  persist()
  notify()
}

/** 登录接口返回的字段转成带绝对时间的令牌对。 */
export function toTokenPair(data: {
  access_token: string
  refresh_token: string
  expires_in?: number
  refresh_expires_in?: number
}): TokenPair {
  const now = Date.now()
  return {
    accessToken: String(data.access_token || ''),
    refreshToken: String(data.refresh_token || ''),
    expiresAt: now + Number(data.expires_in || 7200) * 1000,
    refreshExpiresAt: now + Number(data.refresh_expires_in || 5184000) * 1000,
  }
}

function accessExpiringSoon(): boolean {
  if (!session) return false
  return session.tokens.expiresAt - Date.now() < REFRESH_AHEAD_MS
}

/**
 * 换一对新令牌。并发调用共享同一次请求，这就是「单飞」。
 * 返回 false 表示续期不了（令牌已作废或网络不通），调用方应引导重新登录。
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  const token = refreshToken()
  if (!token) {
    clearSession()
    return Promise.resolve(false)
  }
  refreshing = new Promise<boolean>((resolve) => {
    uni.request({
      url: baseUrl() + API_PREFIX + '/auth/refresh',
      method: 'POST',
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      data: { refresh_token: token },
      success: (res) => {
        const body = res.data as Record<string, unknown> | undefined
        const code = Number(body && body.code)
        if (code === ErrCode.OK && body && body.data) {
          const data = body.data as Record<string, unknown>
          const user = (data.user as SessionUser) || currentUser()
          saveSession(toTokenPair(data as never), user)
          resolve(true)
          return
        }
        // 续期被拒：令牌作废、账号被禁用或改过密码，都只能重新登录。
        clearSession()
        resolve(false)
      },
      fail: () => {
        // 网络问题不该把本地会话清掉，否则一断网就把用户登出了。
        resolve(false)
      },
      complete: () => {
        refreshing = null
      },
    })
  })
  return refreshing
}

/**
 * 每次带令牌的请求前调用：快过期就先换掉，省得请求打到服务端才吃到 40101。
 */
export async function ensureFreshToken(): Promise<void> {
  if (!session) return
  if (Date.now() >= session.tokens.refreshExpiresAt) {
    clearSession()
    return
  }
  if (accessExpiringSoon()) await refreshSession()
}
