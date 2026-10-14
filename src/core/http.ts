import { ApiError, ErrCode } from './errors'
import { absoluteUrl, apiUrl } from './config'
import { accessToken, clearSession, ensureFreshToken, refreshSession } from './tokens'

/**
 * 请求层。三件事必须在这一层做掉，不给页面留负担：
 *
 * 1. 信封归一。服务端统一返回 {code,message,data}，但内核里那些 err()/go() 会自己 exit
 *    并输出 {ok:0,message} 或一整页 HTML。服务端已经用输出缓冲改写过一遍，这里再兜一层，
 *    保证上层拿到的永远是同一个形状。
 * 2. 令牌续期。40101 时只发一次续期（单飞在 tokens.ts 里），成功后原请求重试一次。
 * 3. 会话失效上报。40100/40102 说明本地令牌已经没用了，清掉并广播出去，由界面决定怎么引导登录。
 */

interface Envelope<T> {
  code: number
  message?: string
  data?: T
  tip?: string
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  query?: Record<string, unknown>
  body?: unknown
  /** 默认 true；登录、注册、续期这类请求要显式传 false，否则 40100 会把会话清掉。 */
  auth?: boolean
  timeout?: number
}

export interface UploadResult {
  url: string
  is_image: boolean
  size: number
  ext: string
}

type TipHandler = (tip: string) => void
type AuthLostHandler = () => void

let tipHandler: TipHandler | null = null
let authLostHandler: AuthLostHandler | null = null

/** 服务端透传的积分提示等轻提示，由界面决定怎么展示。 */
export function onTip(fn: TipHandler | null): void {
  tipHandler = fn
}

/** 本地令牌彻底失效时触发，界面据此跳登录页。 */
export function onAuthLost(fn: AuthLostHandler | null): void {
  authLostHandler = fn
}

function emitTip(tip: string): void {
  if (tip && tipHandler) tipHandler(tip)
}

function emitAuthLost(): void {
  if (authLostHandler) authLostHandler()
}

function parseEnvelope<T>(status: number, raw: unknown): Envelope<T> {
  let body: unknown = raw
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      throw new ApiError(ErrCode.SERVER, '服务器返回了无法解析的内容', status)
    }
  }
  if (!body || typeof body !== 'object') {
    throw new ApiError(ErrCode.SERVER, '服务器返回了无法识别的响应', status)
  }
  const record = body as Record<string, unknown>
  if (typeof record.code === 'number') return record as unknown as Envelope<T>
  // 兜底：万一是内核的 {ok:0,message} 漏了出来，也别把这种形状传给上层。
  if ('ok' in record) {
    const message = String(record.message || '请求被拒绝')
    throw new ApiError(record.ok ? ErrCode.SERVER : ErrCode.PARAM, message, status)
  }
  throw new ApiError(ErrCode.SERVER, '服务器返回了无法识别的响应', status)
}

function send(
  url: string,
  options: RequestOptions,
  authorized: boolean,
): Promise<{ statusCode: number; data: unknown }> {
  const header: Record<string, string> = {
    // 带上它，站点内其他插件在出错时会退化成 JSON，而不是吐一整页网页。
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (authorized) header.Authorization = 'Bearer ' + accessToken()
  if (options.method === 'POST') header['Content-Type'] = 'application/json'

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: options.method || 'GET',
      header,
      // GET 的查询串在 apiUrl 里已经拼好，这里只给 POST 传体，避免两处各拼一遍。
      data: options.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
      timeout: options.timeout || 15000,
      success: (res: { statusCode: number; data: unknown }) => resolve({ statusCode: res.statusCode, data: res.data }),
      fail: (err: { errMsg?: string }) => reject(new ApiError(ErrCode.NETWORK, (err && err.errMsg) || '网络请求失败')),
    } as never)
  })
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const authorized = options.auth !== false

  if (authorized) await ensureFreshToken()

  const res = await send(apiUrl(path, options.query), options, authorized)
  let env: Envelope<T>
  try {
    env = parseEnvelope<T>(res.statusCode, res.data)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(ErrCode.SERVER, '服务器返回了无法识别的响应', res.statusCode)
  }

  if (env.code === ErrCode.OK) {
    if (env.tip) emitTip(env.tip)
    return env.data as T
  }

  // 过期：换一次令牌再原样重试。只重试一次，避免令牌有问题时打成死循环。
  if (env.code === ErrCode.TOKEN_EXPIRED && authorized && !retried) {
    const renewed = await refreshSession()
    if (renewed) return request<T>(path, options, true)
    emitAuthLost()
    throw new ApiError(ErrCode.TOKEN_INVALID, env.message || '登录已过期，请重新登录', res.statusCode)
  }

  if ((env.code === ErrCode.UNAUTHORIZED || env.code === ErrCode.TOKEN_INVALID) && authorized) {
    clearSession()
    emitAuthLost()
  }

  throw new ApiError(env.code, env.message || '请求失败', res.statusCode, env.data ?? null)
}

export function get<T>(path: string, query?: Record<string, unknown>, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'GET', query })
}

export function post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'POST', body })
}

/** 上传走 uni.uploadFile：小程序与 App 只能用它，H5 端它也会退化成表单上传。 */
export function uploadFile(filePath: string, formName = 'file'): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: apiUrl('/upload'),
      filePath,
      name: formName,
      header: {
        Authorization: 'Bearer ' + accessToken(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 60000,
      success: (res: { statusCode: number; data: string }) => {
        try {
          const env = parseEnvelope<UploadResult>(res.statusCode, res.data)
          if (env.code !== ErrCode.OK) {
            reject(new ApiError(env.code, env.message || '上传失败', res.statusCode, env.data ?? null))
            return
          }
          const data = env.data as UploadResult
          resolve({ ...data, url: absoluteUrl(data.url) })
        } catch (error) {
          reject(error instanceof ApiError ? error : new ApiError(ErrCode.SERVER, '上传失败'))
        }
      },
      fail: (err: { errMsg?: string }) => reject(new ApiError(ErrCode.NETWORK, (err && err.errMsg) || '上传失败')),
    } as never)
  })
}
