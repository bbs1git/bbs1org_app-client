import { get, post } from '@/core/http'
import type { NotificationPage } from '@/core/types'

export async function fetchNotifications(cursor = '', limit = 20): Promise<NotificationPage> {
  return get<NotificationPage>('/notifications', { cursor, limit })
}

/** 不传 ids 就是全部标记已读；返回新的未读数。 */
export async function markRead(ids: number[] = []): Promise<number> {
  const data = await post<{ unread: number }>('/notifications/read', ids.length ? { ids } : {})
  return Number(data.unread) || 0
}
