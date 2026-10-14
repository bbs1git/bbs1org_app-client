import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as tokens from '@/core/tokens'
import { fetchMe, login as apiLogin, logout as apiLogout } from '@/api/auth'
import type { Account } from '@/core/types'

/**
 * 登录态。令牌本身住在 core/tokens（纯模块，不依赖 Pinia），这里只做界面要用的那份投影。
 * 两边的同步靠 onSessionChange 订阅，别处（比如续期）改了会话，这里会自动跟上。
 */
export const useSessionStore = defineStore('session', () => {
  const user = ref<Account | null>(tokens.currentUser())
  const ready = ref(false)

  tokens.onSessionChange(() => {
    user.value = tokens.currentUser()
  })

  const loggedIn = computed(() => user.value !== null)
  const unread = computed(() => Number(user.value?.unread_notifications || 0))
  const canSpeak = computed(() => !!user.value?.permissions?.can_speak)
  const isMuted = computed(() => Number(user.value?.is_muted || 0) === 1)

  function setUser(next: Account | null): void {
    if (next) tokens.patchUser(next)
    else tokens.clearSession()
    user.value = next
  }

  /** 启动时调一次：本地有会话就去核对一遍，顺带把权限和未读数刷新。 */
  async function restore(): Promise<void> {
    if (ready.value) return
    if (!tokens.isLoggedIn()) {
      ready.value = true
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      // 拿不到就按未登录处理，可能只是断网，所以不清本地会话——下次启动再试。
    } finally {
      ready.value = true
    }
  }

  async function login(username: string, password: string): Promise<Account> {
    const account = await apiLogin(username, password)
    user.value = account
    return account
  }

  async function logout(): Promise<void> {
    await apiLogout()
    user.value = null
  }

  function setUnread(count: number): void {
    if (!user.value) return
    user.value = { ...user.value, unread_notifications: Math.max(0, count) }
    tokens.patchUser(user.value)
  }

  /** 个人资料改过之后（比如换了头像）局部更新，省一次请求。 */
  function patch(partial: Partial<Account>): void {
    if (!user.value) return
    user.value = { ...user.value, ...partial }
    tokens.patchUser(user.value)
  }

  return {
    user,
    ready,
    loggedIn,
    unread,
    canSpeak,
    isMuted,
    restore,
    login,
    logout,
    setUser,
    setUnread,
    patch,
  }
})
