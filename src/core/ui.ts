import { errorMessage } from './errors'

/** 界面反馈。统一在这里，页面里不直接散落 uni.showToast 的魔法字符串。 */

export function toast(message: string): void {
  uni.showToast({ title: message, icon: 'none', duration: 2200 })
}

export function toastSuccess(message: string): void {
  uni.showToast({ title: message, icon: 'success', duration: 1600 })
}

export function toastError(error: unknown, fallback?: string): void {
  // 用户主动取消的操作不该弹错误
  const message = errorMessage(error, fallback)
  if (/取消|已取消/.test(message)) return
  toast(message)
}

let loadingDepth = 0

function showLoading(title = '加载中'): void {
  loadingDepth += 1
  uni.showLoading({ title, mask: true })
}

function hideLoading(): void {
  loadingDepth = Math.max(0, loadingDepth - 1)
  if (loadingDepth === 0) uni.hideLoading()
}

/** 包一层加载态，throw 也会把 loading 收掉，不会卡住界面。 */
export async function withLoading<T>(task: () => Promise<T>, title = '加载中'): Promise<T> {
  showLoading(title)
  try {
    return await task()
  } finally {
    hideLoading()
  }
}

export function confirm(content: string, title = '确认'): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content,
      success: (res) => resolve(!!(res as { confirm?: boolean }).confirm),
      fail: () => resolve(false),
    })
  })
}

export function actionSheet(items: string[], title = ''): Promise<number> {
  return new Promise<number>((resolve) => {
    uni.showActionSheet({
      itemList: items,
      title,
      success: (res) => resolve(Number((res as { tapIndex?: number }).tapIndex)),
      fail: () => resolve(-1),
    })
  })
}

/** 触感反馈，只在 App 端有意义，其他端静默忽略。 */
export function haptic(): void {
  // #ifdef APP-PLUS
  uni.vibrateShort({})
  // #endif
}
