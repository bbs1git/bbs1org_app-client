import { get, post } from '@/core/http'
import { clearSession, saveSession, toTokenPair } from '@/core/tokens'
import { deviceInfo } from '@/core/device'
import type { Account, BindTicket, LoginPayload } from '@/core/types'

/** 登录成功就把会话落到本地，调用方不用自己处理令牌。 */
function adopt(data: LoginPayload): Account {
  saveSession(toTokenPair(data), data.user)
  return data.user
}

export async function login(username: string, password: string): Promise<Account> {
  const data = await post<LoginPayload>(
    '/auth/login',
    { username, password, ...deviceInfo() },
    { auth: false },
  )
  return adopt(data)
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  password_confirm: string
}

export async function register(form: RegisterForm): Promise<Account> {
  const data = await post<LoginPayload>('/auth/register', { ...form, ...deviceInfo() }, { auth: false })
  return adopt(data)
}

export async function logout(): Promise<void> {
  try {
    await post('/auth/logout')
  } finally {
    // 服务端失败也要把本地会话清掉，否则用户会卡在「看着像登录着但什么都做不了」。
    clearSession()
  }
}

export async function fetchMe(): Promise<Account> {
  const data = await get<{ user: Account }>('/me')
  return data.user
}

/**
 * 微信登录。凭据没绑过账号时服务端返回 40104，data 里带 bind_ticket，
 * 调用方接住这个异常去走绑定表单；其他错误照常抛。
 */
export async function wechatLogin(code: string): Promise<Account> {
  const data = await post<LoginPayload | BindTicket>(
    '/auth/wechat',
    { code, ...deviceInfo() },
    { auth: false },
  )
  return adopt(data as LoginPayload)
}

export interface WechatBindForm {
  bind_ticket: string
  username?: string
  password?: string
}

/** 已登录时只传 bind_ticket；未登录时再带上账号密码。 */
export async function wechatBind(form: WechatBindForm): Promise<Account> {
  const data = await post<LoginPayload>('/auth/wechat/bind', { ...form, ...deviceInfo() })
  return adopt(data)
}
