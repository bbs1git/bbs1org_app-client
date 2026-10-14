import { get, post } from '@/core/http'
import type { Topic, TopicDetailPayload, TopicPage, TopicSort } from '@/core/types'

export interface TopicQuery {
  forum_id?: number
  /** 只看某个人发的主题 */
  user_id?: number
  sort?: TopicSort
  cursor?: string
  limit?: number
  /** 列表默认不带正文摘要，需要时打开 */
  excerpt?: boolean
}

export async function fetchTopics(query: TopicQuery = {}): Promise<TopicPage> {
  const data = await get<{ topics: Topic[]; next_cursor: string | null; has_more: boolean }>('/topics', {
    forum_id: query.forum_id,
    user_id: query.user_id,
    sort: query.sort,
    cursor: query.cursor,
    limit: query.limit,
    excerpt: query.excerpt ? 1 : undefined,
  })
  return { topics: data.topics || [], next_cursor: data.next_cursor, has_more: !!data.has_more }
}

export interface TopicDetailQuery {
  cursor?: string
  limit?: number
  order?: 'asc' | 'desc'
}

export async function fetchTopic(id: number, query: TopicDetailQuery = {}): Promise<TopicDetailPayload> {
  return get<TopicDetailPayload>('/topics/' + id, {
    cursor: query.cursor,
    limit: query.limit,
    order: query.order,
  })
}

export interface CreateTopicForm {
  forum_id: number
  title: string
  body: string
}

/** 服务端只回 ID 和地址，不回整个主题：省一次序列化，列表刷新由调用方决定。 */
export interface CreateTopicResult {
  topic_id: number
  url: string
}

export async function createTopic(form: CreateTopicForm): Promise<CreateTopicResult> {
  return post<CreateTopicResult>('/topics', form)
}

export interface CreateReplyResult {
  reply_id: number
  floor: number
  url: string
}

export async function createReply(topicId: number, body: string): Promise<CreateReplyResult> {
  return post<CreateReplyResult>('/topics/' + topicId + '/replies', { body })
}
