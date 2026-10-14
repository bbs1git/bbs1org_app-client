/**
 * 跨端存储。小程序、App、H5 的本地存储 API 各不相同，这里统一走 uni 的同步接口，
 * 并且全部包在 try/catch 里：隐私模式、存储被禁用、配额写满都会直接抛，
 * 那种情况下页面必须还能正常渲染，不能让一个读缓存的动作把首屏打挂。
 */

const PREFIX = 'bbs1:'

function key(name: string): string {
  return PREFIX + name
}

export function readStore<T>(name: string, fallback: T): T {
  try {
    const raw = uni.getStorageSync(key(name))
    if (raw === '' || raw === null || raw === undefined) return fallback
    return typeof raw === 'string' ? (JSON.parse(raw) as T) : (raw as T)
  } catch {
    return fallback
  }
}

export function writeStore(name: string, value: unknown): void {
  try {
    uni.setStorageSync(key(name), JSON.stringify(value))
  } catch {
    // 存不下就算了，内存里的状态仍然可用，下次启动重新登录即可。
  }
}

export function removeStore(name: string): void {
  try {
    uni.removeStorageSync(key(name))
  } catch {
    // 同上
  }
}
