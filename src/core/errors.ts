/**
 * 接口错误码。与服务端 app/plugins/app_api/plugin.php 里的 APP_API_ERR_* 一一对应，
 * 客户端只对其中几个做分支处理，其余一律当普通错误提示。
 */
export const ErrCode = {
  OK: 0,
  PARAM: 40001,
  UPLOAD: 40003,
  /** 没带令牌 —— 去登录 */
  UNAUTHORIZED: 40100,
  /** 访问令牌过期 —— 去续期 */
  TOKEN_EXPIRED: 40101,
  /** 令牌作废（改密码、被禁用、设备被挤下线）—— 去重新登录 */
  TOKEN_INVALID: 40102,
  /** 网页端还有一道验证没走完 */
  NEED_VERIFY: 40103,
  /** 微信号尚未绑定账号，data 里带 bind_ticket */
  NEED_BIND: 40104,
  FORBIDDEN: 40300,
  BANNED: 40301,
  MUTED: 40302,
  NOT_FOUND: 40400,
  VERSION: 40401,
  METHOD: 40500,
  TOO_LARGE: 41300,
  THROTTLED: 42900,
  SERVER: 50000,
  /** 客户端本地错误：断网、超时、响应无法解析 */
  NETWORK: -1,
} as const

export class ApiError extends Error {
  readonly code: number
  readonly status: number
  readonly data: unknown

  constructor(code: number, message: string, status = 0, data: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.data = data
  }

  /** 需要重新登录：令牌没了或已作废。 */
  get needsLogin(): boolean {
    return this.code === ErrCode.UNAUTHORIZED || this.code === ErrCode.TOKEN_INVALID
  }

  /** 只需要换一次令牌就能继续。 */
  get needsRefresh(): boolean {
    return this.code === ErrCode.TOKEN_EXPIRED
  }

  get isNetwork(): boolean {
    return this.code === ErrCode.NETWORK
  }
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** 统一把任意异常转成可直接展示的文案。 */
export function errorMessage(error: unknown, fallback = '操作失败，请稍后再试'): string {
  if (isApiError(error)) {
    if (error.isNetwork) return '网络不可用，请检查连接后重试'
    return error.message || fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
