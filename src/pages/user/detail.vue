<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import Avatar from '@/components/Avatar.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadMore from '@/components/LoadMore.vue'
import NavBar from '@/components/NavBar.vue'
import TopicCard from '@/components/TopicCard.vue'
import { fetchTopics } from '@/api/topics'
import { fetchUser } from '@/api/users'
import { usePageChrome } from '@/composables/usePageChrome'
import { compactNumber, parseTime, shortDate } from '@/core/format'
import { pageQuery } from '@/core/navigate'
import { toastError } from '@/core/ui'
import { useSessionStore } from '@/stores/session'
import type { Account, Topic } from '@/core/types'

/**
 * 用户主页：资料头 + TA 的主题。
 *
 * 主题用的是带 user_id 的列表接口，版块可见性仍然先生效，
 * 所以看到的是「TA 在你也能看的版块里发的主题」，不会因为翻主页绕过权限。
 */

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const session = useSessionStore()

const userId = ref(0)
const user = ref<Account | null>(null)
const topics = ref<Topic[]>([])
const cursor = ref('')
const hasMore = ref(true)
const loading = ref(false)
const error = ref('')
const profileError = ref('')

const isSelf = computed(() => !!user.value && !!session.user && user.value.id === session.user.id)

const joined = computed(() => {
  if (!user.value) return ''
  const date = parseTime(user.value.created_at)
  return date ? shortDate(date) + '加入' : ''
})

onLoad(async (options: Record<string, string> | undefined) => {
  const query = options || pageQuery<{ id?: string }>()
  userId.value = Number(query.id || 0)
  if (userId.value < 1) {
    profileError.value = '用户不存在'
    return
  }
  await Promise.all([loadProfile(), loadTopics(true)])
})

onPageScroll(onScroll)

onReachBottom(() => {
  if (hasMore.value && !loading.value) void loadTopics(false)
})

onPullDownRefresh(async () => {
  try {
    await Promise.all([loadProfile(), loadTopics(true)])
  } finally {
    uni.stopPullDownRefresh()
  }
})

async function loadProfile(): Promise<void> {
  try {
    user.value = await fetchUser(userId.value)
  } catch (error_) {
    profileError.value = error_ instanceof Error ? error_.message : '加载失败'
  }
}

async function loadTopics(first: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  if (first) error.value = ''
  try {
    const page = await fetchTopics({
      user_id: userId.value,
      sort: 'post',
      cursor: first ? undefined : cursor.value || undefined,
      excerpt: true,
    })
    topics.value = first ? page.topics : topics.value.concat(page.topics)
    cursor.value = page.next_cursor || ''
    hasMore.value = !!page.has_more && !!page.next_cursor
  } catch (error_) {
    if (first) error.value = error_ instanceof Error ? error_.message : '加载失败'
    else toastError(error_)
  } finally {
    loading.value = false
  }
}

function retry(): void {
  void loadTopics(true)
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" :title="user ? user.username : '用户'" />

    <view class="body" :style="{ paddingTop: contentTop() }">
      <EmptyState
        v-if="profileError && !user"
        icon="user"
        title="找不到这个用户"
        :description="profileError"
      />

      <template v-else>
        <view class="head">
          <Avatar
            :src="user?.avatar_url"
            :name="user?.username"
            :seed="userId"
            :size="66"
          />
          <view class="head-main">
            <view class="head-name-row">
              <text class="head-name">{{ user?.username || '加载中' }}</text>
              <text v-if="isSelf" class="head-self">我</text>
            </view>
            <view class="head-meta">
              <text v-if="user?.group && user.group.name" class="head-group">{{ user.group.name }}</text>
              <text v-if="user" class="head-points mono">积分 {{ compactNumber(user.points || 0) }}</text>
              <text v-if="joined" class="head-joined">{{ joined }}</text>
            </view>
          </view>
        </view>

        <view class="section-head">
          <AppIcon name="list" :size="16" color="ink2" :weight="1.8" />
          <text class="section-title">{{ isSelf ? '我的主题' : 'TA 的主题' }}</text>
        </view>

        <EmptyState
          v-if="error && !topics.length"
          icon="wifi"
          title="没能加载主题"
          :description="error"
          action="重试"
          @action="retry"
        />

        <EmptyState
          v-else-if="!loading && !topics.length"
          compact
          icon="comment"
          title="还没有发过主题"
          description="你在能看到的版块里没有找到 TA 的帖子"
        />

        <view v-else class="list">
          <TopicCard v-for="topic in topics" :key="topic.id" :topic="topic" show-forum hide-author />
          <LoadMore
            :loading="loading && topics.length > 0"
            :has-more="hasMore"
            :error="error"
            filled
            @retry="retry"
          />
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding-bottom: 32px;
}

.head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  padding: 18px 15px;
  background: var(--surface);
}

.head-main {
  flex: 1;
  min-width: 0;
}

.head-name-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
}

.head-name {
  font-size: $fs-xl;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
  max-width: 170px;
  @include ellipsis;
}

.head-self {
  display: inline-flex;
  align-items: center;
  height: 19px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: $fs-xs;
  font-weight: 600;
  line-height: 1;
}

.head-meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: $sp-2;
  margin-top: 5px;
}

.head-group {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: $fs-xs;
  font-weight: 600;
  line-height: 1;
}

.head-points,
.head-joined {
  font-size: $fs-xs;
  color: var(--muted);
}

.section-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 18px 15px 8px;
}

.section-title {
  font-size: $fs-base;
  font-weight: 700;
  color: var(--ink);
}

.list {
  padding: 0 $sp-3;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
