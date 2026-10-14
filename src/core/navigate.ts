/**
 * 页面路径与跳转。
 *
 * 没有用原生 tabBar：它的图标必须是图片文件，字号和间距也不可改，还压不住小程序默认样式。
 * 这里改成自绘的底部栏，三端表现一致，也不需要任何二进制资源。
 * 代价是切换主页面要用 reLaunch（页面实例会被销毁），所以列表数据都放在 Pinia 里缓存，
 * 切回来是直接渲染缓存，不会重新请求也不会白屏。
 */

export const routes = {
  home: '/pages/index/index',
  notifications: '/pages/notifications/index',
  profile: '/pages/user/profile',
  topic: '/pages/topic/detail',
  create: '/pages/topic/create',
  search: '/pages/search/index',
  login: '/pages/user/login',
  user: '/pages/user/detail',
  site: '/pages/settings/site',
} as const

export type MainRoute = typeof routes.home | typeof routes.notifications | typeof routes.profile

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value === undefined || value === '') return
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
  })
  return parts.length ? '?' + parts.join('&') : ''
}

/** 主页面之间切换：用 reLaunch 清栈，避免从「我的」一路返回回到首页再返回的错乱。 */
export function switchMain(route: MainRoute): void {
  const pages = getCurrentPages()
  const current = pages.length ? '/' + (pages[pages.length - 1] as { route?: string }).route : ''
  if (current === route) return
  uni.reLaunch({ url: route })
}

export function openTopic(id: number): void {
  uni.navigateTo({ url: routes.topic + query({ id }) })
}

export function openUser(id: number): void {
  if (id <= 0) return
  uni.navigateTo({ url: routes.user + query({ id }) })
}

export function openCreate(forumId?: number): void {
  uni.navigateTo({ url: routes.create + query({ forum_id: forumId }) })
}

export function openSearch(): void {
  uni.navigateTo({ url: routes.search })
}

export function openSiteSettings(): void {
  uni.navigateTo({ url: routes.site })
}

export interface LoginQuery {
  /** 登录成功后要去的页面，登录页据此回跳 */
  redirect?: string
}

export function openLogin(options: LoginQuery = {}): void {
  uni.navigateTo({ url: routes.login + query({ redirect: options.redirect }) })
}

export function back(fallback = 1): void {
  const pages = getCurrentPages()
  if (pages.length > fallback) {
    uni.navigateBack({ delta: fallback })
    return
  }
  uni.reLaunch({ url: routes.home })
}

/** 读当前页面的查询参数。 */
export function pageQuery<T extends Record<string, string>>(): T {
  const pages = getCurrentPages()
  const page = pages.length ? (pages[pages.length - 1] as { options?: Record<string, string> }) : null
  return ((page && page.options) || {}) as T
}
