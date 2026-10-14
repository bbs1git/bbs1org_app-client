import { get } from '@/core/http'
import type { Topic, TopicPage } from '@/core/types'

/** 检索范围：标题 / 正文 / 回复。和内核的 field 参数一一对应。 */
export type SearchField = 'title' | 'body' | 'reply'

export interface SearchQuery {
  q: string
  field?: SearchField
  cursor?: string
  limit?: number
  excerpt?: boolean
}

/**
 * 搜索主题与回复。服务端只会在当前身份可见的版块范围内检索，
 * 命中回复时返回的是该回复所属的主题。
 */
export async function search(query: SearchQuery): Promise<TopicPage> {
  const data = await get<{ topics: Topic[]; next_cursor: string | null; has_more: boolean }>('/search', {
    q: query.q,
    field: query.field,
    cursor: query.cursor,
    limit: query.limit,
    excerpt: query.excerpt ? 1 : undefined,
  })
  return { topics: data.topics || [], next_cursor: data.next_cursor, has_more: !!data.has_more }
}
