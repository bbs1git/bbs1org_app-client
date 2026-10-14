import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { fetchTopics } from '@/api/topics'
import { errorMessage } from '@/core/errors'
import type { Topic, TopicSort } from '@/core/types'

/**
 * 主题流的缓存。
 *
 * 主页面之间是 reLaunch 切换的（页面实例会被销毁），所以列表状态不能只放在页面里，
 * 否则从「我的」切回首页会白屏重来。这里按「版块 + 排序」分桶缓存，
 * 包括滚动位置，切回来是立刻复原而不是重新请求。
 */

export interface FeedState {
  topics: Topic[]
  cursor: string
  hasMore: boolean
  /** 是否已经成功加载过至少一次 */
  loaded: boolean
  loading: boolean
  refreshing: boolean
  error: string
  scrollTop: number
}

export type FeedKey = string

function feedKey(forumId: number, sort: TopicSort): FeedKey {
  return (forumId > 0 ? forumId : 0) + ':' + sort
}

function emptyState(): FeedState {
  return {
    topics: [],
    cursor: '',
    hasMore: true,
    loaded: false,
    loading: false,
    refreshing: false,
    error: '',
    scrollTop: 0,
  }
}

/** 分桶不存在时给一个共享的空状态。它是只读的，绝不能在上面写。 */
const EMPTY: FeedState = emptyState()

export const useFeedStore = defineStore('feed', () => {
  const feeds = reactive<Record<FeedKey, FeedState>>({})

  /**
   * 只读。分桶不存在就返回空状态，不在读取路径上建桶 ——
   * 页面是在 computed 里读它的，而 computed 求值过程中去写 reactive 对象
   * 会让它自己失效，多绕一圈还可能触发递归更新告警。
   */
  function stateOf(forumId: number, sort: TopicSort): FeedState {
    return feeds[feedKey(forumId, sort)] || EMPTY
  }

  /** 建桶。只在事件处理函数里同步调用，保证渲染前分桶已经存在。 */
  function touch(forumId: number, sort: TopicSort): FeedState {
    const key = feedKey(forumId, sort)
    if (!feeds[key]) feeds[key] = emptyState()
    return feeds[key]
  }

  /** 首屏：没有缓存就加载，有缓存直接返回（下拉刷新请用 refresh）。 */
  async function ensure(forumId: number, sort: TopicSort): Promise<void> {
    const state = touch(forumId, sort)
    if (state.loaded || state.loading) return
    await load(forumId, sort, '')
  }

  async function refresh(forumId: number, sort: TopicSort): Promise<void> {
    const state = touch(forumId, sort)
    state.refreshing = true
    try {
      await load(forumId, sort, '')
    } finally {
      state.refreshing = false
    }
  }

  async function loadMore(forumId: number, sort: TopicSort): Promise<void> {
    const state = touch(forumId, sort)
    if (state.loading || state.refreshing || !state.hasMore) return
    await load(forumId, sort, state.cursor)
  }

  async function load(forumId: number, sort: TopicSort, cursor: string): Promise<void> {
    const state = touch(forumId, sort)
    const first = cursor === ''
    state.loading = true
    state.error = ''
    try {
      const page = await fetchTopics({
        forum_id: forumId > 0 ? forumId : undefined,
        sort,
        cursor: cursor || undefined,
        excerpt: true,
      })
      state.topics = first ? page.topics : state.topics.concat(page.topics)
      state.cursor = page.next_cursor || ''
      state.hasMore = !!page.has_more && !!page.next_cursor
      state.loaded = true
    } catch (error) {
      state.error = errorMessage(error)
      // 首屏失败要让用户能重试；翻页失败只提示，保留已有内容。
      if (!first) state.hasMore = true
    } finally {
      state.loading = false
    }
  }

  /** 发主题或删主题之后，本地列表就不可信了，标记成未加载，下次进入会重新拉。 */
  function invalidate(): void {
    Object.keys(feeds).forEach((key) => {
      feeds[key].loaded = false
      feeds[key].cursor = ''
      feeds[key].hasMore = true
    })
  }

  function reset(): void {
    Object.keys(feeds).forEach((key) => delete feeds[key])
  }

  return { feeds, stateOf, touch, ensure, refresh, loadMore, invalidate, reset }
})
