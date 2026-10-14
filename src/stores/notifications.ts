import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchNotifications, markRead } from '@/api/notifications'
import { errorMessage } from '@/core/errors'
import { useSessionStore } from './session'
import type { NotificationItem } from '@/core/types'

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([])
  const unread = ref(0)
  const cursor = ref('')
  const hasMore = ref(true)
  const loaded = ref(false)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref('')

  const session = useSessionStore()

  const hasUnread = computed(() => unread.value > 0)

  async function ensure(): Promise<void> {
    if (loaded.value || loading.value) return
    await load('')
  }

  async function refresh(): Promise<void> {
    refreshing.value = true
    try {
      await load('')
    } finally {
      refreshing.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || refreshing.value || !hasMore.value) return
    await load(cursor.value)
  }

  async function load(from: string): Promise<void> {
    const first = from === ''
    loading.value = true
    error.value = ''
    try {
      const page = await fetchNotifications(from, 20)
      items.value = first ? page.items : items.value.concat(page.items)
      cursor.value = page.next_cursor || ''
      hasMore.value = !!page.next_cursor
      setUnread(page.unread)
      loaded.value = true
    } catch (error_) {
      error.value = errorMessage(error_)
    } finally {
      loading.value = false
    }
  }

  function setUnread(count: number): void {
    unread.value = Math.max(0, Number(count) || 0)
    session.setUnread(unread.value)
  }

  /** 只更新角标，不拉列表。启动时和从后台切回来时用。 */
  async function refreshBadge(): Promise<void> {
    if (!session.loggedIn) return
    try {
      const page = await fetchNotifications('', 1)
      setUnread(page.unread)
    } catch {
      // 角标拉不到就算了，不打扰用户
    }
  }

  async function markAllRead(): Promise<void> {
    if (!hasUnread.value) return
    const before = unread.value
    // 先本地清掉，界面立刻响应；失败再回滚。
    items.value = items.value.map((item) => ({ ...item, is_read: true }))
    setUnread(0)
    try {
      setUnread(await markRead())
    } catch {
      setUnread(before)
      throw new Error('标记已读失败')
    }
  }

  async function markItemRead(id: number): Promise<void> {
    const target = items.value.find((item) => item.id === id)
    if (!target || target.is_read) return
    target.is_read = true
    setUnread(Math.max(0, unread.value - 1))
    try {
      setUnread(await markRead([id]))
    } catch {
      target.is_read = false
      setUnread(unread.value + 1)
    }
  }

  function reset(): void {
    items.value = []
    cursor.value = ''
    hasMore.value = true
    loaded.value = false
    unread.value = 0
    error.value = ''
  }

  return {
    items,
    unread,
    cursor,
    hasMore,
    loaded,
    loading,
    refreshing,
    error,
    hasUnread,
    ensure,
    refresh,
    loadMore,
    refreshBadge,
    markAllRead,
    markItemRead,
    reset,
  }
})
