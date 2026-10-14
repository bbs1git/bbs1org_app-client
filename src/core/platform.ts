import { ApiError, ErrCode } from './errors'

/**
 * 平台差异都收在这里。业务代码只调这些函数，条件编译不往页面里散。
 */

export function isWeixinMiniProgram(): boolean {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  // eslint-disable-next-line no-unreachable
  return false
}

/** 当前运行端的名字，只用于设置页展示。 */
export function platformName(): string {
  // #ifdef MP-WEIXIN
  return '微信小程序'
  // #endif
  // #ifdef APP-PLUS
  // eslint-disable-next-line no-unreachable
  return '手机 App'
  // #endif
  // #ifdef H5
  // eslint-disable-next-line no-unreachable
  return '网页'
  // #endif
  // eslint-disable-next-line no-unreachable
  return '未知'
}

/**
 * 拿微信登录凭证。只有小程序端能拿到 code，其他端会直接抛错，
 * 页面应先看 config.login.wechat 再决定要不要给这个按钮。
 */
export function wechatLogin(): Promise<string> {
  // #ifdef MP-WEIXIN
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        const code = (res as { code?: string }).code || ''
        if (code) resolve(code)
        else reject(new ApiError(ErrCode.UNAUTHORIZED, '没有拿到微信登录凭证'))
      },
      fail: () => reject(new ApiError(ErrCode.UNAUTHORIZED, '微信授权已取消')),
    })
  })
  // #endif
  // eslint-disable-next-line no-unreachable
  return Promise.reject(new ApiError(ErrCode.FORBIDDEN, '当前端不支持微信登录'))
}

/** 选图。小程序和 App 走 uni 的相册/相机，H5 会退化成文件选择。 */
export function chooseImage(count = 1): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    uni.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const list = (res as { tempFilePaths?: string[] }).tempFilePaths || []
        resolve(list)
      },
      fail: () => reject(new ApiError(ErrCode.PARAM, '已取消选择')),
    })
  })
}

/** 复制文本。三端的接口一致，失败时返回 false 由界面提示手动复制。 */
export function copyText(text: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    uni.setClipboardData({
      data: text,
      success: () => resolve(true),
      fail: () => resolve(false),
    })
  })
}

/** 预览图片，帖子里的图点开看大图。 */
export function previewImage(urls: string[], current: string): void {
  uni.previewImage({ urls, current })
}
