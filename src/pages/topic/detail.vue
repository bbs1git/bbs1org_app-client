<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import Avatar from '@/components/Avatar.vue'
import Composer from '@/components/Composer.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadMore from '@/components/LoadMore.vue'
import NavBar from '@/components/NavBar.vue'
import RichContent from '@/components/RichContent.vue'
import { createReply, fetchTopic } from '@/api/topics'
import { usePageChrome } from '@/composables/usePageChrome'
import { highlightColor, highlightLarge, readableHighlight } from '@/core/color'
import { compactNumber, fullTime, relativeTime } from '@/core/format'
import { openLogin, openUser, pageQuery } from '@/core/navigate'
import { copyText } from '@/core/platform'
import { toast, toastError, toastSuccess } from '@/core/ui'
import { useSessionStore } from '@/stores/session'
import { useSiteStore } from '@/stores/site'
import type { Reply, TopicDetail } from '@/core/types'

/**
 * 主题详情。
 *
 * 浏览量是「每请求一次详情 +1」，所以只在 onLoad 拉一次，onShow 不重拉 ——
 * 否则每次从回复页返回都会多算一次浏览。
 */

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const session = useSessionStore()
const site = useSiteStore()

const topicId = ref(0)
const topic = ref<TopicDetail | null>(null)
const replies = ref<Reply[]>([])
const order = ref<'asc' | 'desc'>('asc')
const cursor = ref('')
const hasMore = ref(false)
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const loaded = ref(false)
const composerOpen = ref(false)
const sending = ref(false)

const titleStyle = computed(() => {
  if (!topic.value) return {}
  const raw = highlightColor(topic.value.highlight_style)
  const color = raw ? readableHighlight(raw, ui.theme) : ''
  const style: Record<string, string> = {}
  if (color) style.color = color
  if (highlightLarge(topic.value.highlight_style)) style.fontSize = '22px'
  return style
})

const canReply = computed(() => {
  if (!session.loggedIn) return false
  const permissions = session.user?.permissions
  return !!(permissions && permissions.can_speak) && !session.isMuted
})

const replyHint = computed(() => {
  if (!session.loggedIn) return '登录后回复'
  if (session.isMuted) return '你目前处于禁言状态'
  if (!canReply.value) return '当前用户组不能回复'
  return '写下你的回复…'
})

const maxReply = computed(() => site.config?.limits.reply_body_max_length || 5000)
const minReply = computed(() => site.config?.limits.reply_body_min_length || 1)
const uploadEnabled = computed(() => !!site.config?.upload.enabled)
const uploadMaxMb = computed(() => Number(site.config?.upload.max_mb) || 0)

onLoad(async (options: Record<string, string> | undefined) => {
  const query = options || pageQuery<{ id?: string }>()
  topicId.value = Number(query.id || 0)
  if (topicId.value < 1) {
    error.value = '主题不存在'
    loaded.value = true
    return
  }
  await site.ensureConfig()
  await load(true)
})

onPageScroll(onScroll)

onReachBottom(() => {
  if (hasMore.value && !loading.value && !refreshing.value) void load(false)
})

onPullDownRefresh(async () => {
  try {
    await reload()
  } finally {
    uni.stopPullDownRefresh()
  }
})

async function load(first: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  if (first) error.value = ''
  try {
    const payload = await fetchTopic(topicId.value, {
      cursor: first ? undefined : cursor.value || undefined,
      order: order.value,
    })
    topic.value = payload.topic
    replies.value = first ? payload.replies : replies.value.concat(payload.replies)
    order.value = payload.reply_order
    cursor.value = payload.next_cursor || ''
    hasMore.value = !!payload.has_more && !!payload.next_cursor
    loaded.value = true
  } catch (error_) {
    if (first) error.value = error_ instanceof Error ? error_.message : '加载失败'
    else toastError(error_)
  } finally {
    loading.value = false
  }
}

/** 换排序、发完回复都走这里：清空重来，避免新旧顺序的数据混在一起。 */
async function reload(): Promise<void> {
  refreshing.value = true
  cursor.value = ''
  hasMore.value = false
  replies.value = []
  try {
    await load(true)
  } finally {
    refreshing.value = false
  }
}

function toggleOrder(): void {
  order.value = order.value === 'asc' ? 'desc' : 'asc'
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  void reload()
}

function openComposer(): void {
  if (!session.loggedIn) {
    openLogin()
    return
  }
  if (!canReply.value) {
    toast(replyHint.value)
    return
  }
  composerOpen.value = true
}

async function submit(body: string): Promise<void> {
  if (sending.value) return
  if (!body) {
    toast('回复内容不能为空')
    return
  }
  sending.value = true
  try {
    await createReply(topicId.value, body)
    composerOpen.value = false
    toastSuccess('回复成功')
    // 新回复的楼层要服务端算过才准，所以整页重拉而不是本地插一条
    await reload()
    // 倒序时新回复在最上面，正序时要跳到底部去看
    if (order.value === 'asc') {
      setTimeout(() => uni.pageScrollTo({ scrollTop: 999999, duration: 220 }), 120)
    }
  } catch (error) {
    toastError(error, '回复失败')
  } finally {
    sending.value = false
  }
}

async function share(): Promise<void> {
  if (!topic.value) return
  const ok = await copyText(topic.value.url)
  toast(ok ? '链接已复制' : '复制失败，请手动复制地址栏')
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" :title="topic ? topic.forum.name : '主题'">
      <template #right>
        <view class="icon-btn" hover-class="icon-btn-hover" @click="share">
          <AppIcon name="share" :size="19" color="ink" :weight="1.8" />
        </view>
      </template>
    </NavBar>

    <view class="body" :style="{ paddingTop: contentTop() }">
      <view v-if="!topic && !loaded" class="loading-block">
        <view class="skeleton" style="height: 20px; width: 70%" />
        <view class="skeleton" style="height: 13px; width: 40%; margin-top: 12px" />
        <view class="skeleton" style="height: 13px; width: 100%; margin-top: 20px" />
        <view class="skeleton" style="height: 13px; width: 92%; margin-top: 8px" />
      </view>

      <EmptyState
        v-else-if="!topic"
        icon="alert"
        title="打不开这个主题"
        :description="error || '它可能已经被删除，或者你没有查看权限'"
      />

      <template v-else>
        <view class="head">
          <view v-if="topic.is_pinned || topic.forum.name" class="head-tags">
            <text class="tag tag-forum">{{ topic.forum.name }}</text>
            <text v-if="topic.is_pinned" class="tag tag-pin">置顶</text>
          </view>

          <text class="head-title" :style="titleStyle">{{ topic.title }}</text>

          <view class="head-author" @click="openUser(topic.author.id)">
            <Avatar
              :src="topic.author.avatar_url"
              :name="topic.author.username"
              :seed="topic.author.id"
              :size="38"
            />
            <view class="head-author-main">
              <text class="head-name">{{ topic.author.username }}</text>
              <text class="head-meta">
                {{ fullTime(topic.created_at) }} · {{ compactNumber(topic.view_count) }} 次浏览
              </text>
            </view>
          </view>

          <view class="head-content">
            <RichContent :html="topic.body_html" :text="topic.body" />
          </view>
        </view>

        <view class="replies-head">
          <text class="replies-title">全部回复</text>
          <text class="replies-count">{{ compactNumber(topic.reply_count) }}</text>
          <view class="grow" />
          <view class="order-btn" hover-class="order-btn-hover" @click="toggleOrder">
            <AppIcon name="list" :size="15" color="ink2" :weight="1.8" />
            <text class="order-text">{{ order === 'asc' ? '正序' : '倒序' }}</text>
          </view>
        </view>

        <EmptyState
          v-if="!replies.length && !loading"
          compact
          icon="comment"
          title="还没有人回复"
          description="来抢第一个沙发"
          :action="canReply || !session.loggedIn ? '写回复' : ''"
          @action="openComposer"
        />

        <view v-else class="replies">
          <view v-for="reply in replies" :key="reply.id" class="reply">
            <view @click="openUser(reply.author.id)">
              <Avatar
                :src="reply.author.avatar_url"
                :name="reply.author.username"
                :seed="reply.author.id"
                :size="34"
              />
            </view>
            <view class="reply-main">
              <view class="reply-head">
                <text class="reply-name" @click="openUser(reply.author.id)">{{ reply.author.username }}</text>
                <text class="reply-floor mono">#{{ reply.floor }}</text>
                <view class="grow" />
                <text class="reply-time">{{ relativeTime(reply.created_at) }}</text>
              </view>
              <view class="reply-body">
                <RichContent :html="reply.body_html" :text="reply.body" />
              </view>
            </view>
          </view>
        </view>

        <LoadMore
          v-if="replies.length"
          :loading="loading && replies.length > 0"
          :has-more="hasMore"
          filled
          end-text="没有更多回复了"
          @retry="reload"
        />
      </template>
    </view>

    <view class="reply-bar">
      <view class="reply-entry" hover-class="reply-entry-hover" @click="openComposer">
        <AppIcon :name="canReply ? 'edit' : 'lock'" :size="17" color="muted" :weight="1.7" />
        <text class="reply-entry-text">{{ replyHint }}</text>
      </view>
    </view>

    <Composer
      v-model:visible="composerOpen"
      :sending="sending"
      :max="maxReply"
      :min="minReply"
      :upload-enabled="uploadEnabled"
      :max-mb="uploadMaxMb"
      placeholder="写下你的回复…支持 Markdown"
      @submit="submit"
    />
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding-bottom: 72px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-full;
}

.icon-btn-hover {
  background: var(--surface-2);
}

.loading-block {
  padding: 22px $sp-4;
}

/* --------------------------------------------------------------- 主题 */

.head {
  background: var(--surface);
  padding: 16px 15px 18px;
}

.head-tags {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin-bottom: $sp-2;
}

.tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  font-size: $fs-xs;
  line-height: 1;
}

.tag-forum {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.tag-pin {
  background: var(--surface-3);
  color: var(--warn);
  font-weight: 600;
}

.head-title {
  display: block;
  font-size: $fs-xl;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
  letter-spacing: -0.01em;
}

.head-author {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.head-author-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.head-name {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--ink);
}

.head-meta {
  font-size: $fs-xs;
  color: var(--muted);
  margin-top: 1px;
}

.head-content {
  margin-top: 16px;
}

/* --------------------------------------------------------------- 回复 */

.replies-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 18px 15px 10px;
}

.replies-title {
  font-size: $fs-base;
  font-weight: 700;
  color: var(--ink);
}

.replies-count {
  font-size: $fs-sm;
  color: var(--muted);
  font-family: $font-mono;
}

.order-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: $r-full;
  background: var(--surface-2);
}

.order-btn-hover {
  opacity: 0.7;
}

.order-text {
  font-size: $fs-xs;
  color: var(--ink-2);
}

.replies {
  background: var(--surface);
}

.reply {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 15px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 59px;
    right: 15px;
    bottom: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
  }

  &:last-child::after {
    display: none;
  }
}

.reply-main {
  flex: 1;
  min-width: 0;
}

.reply-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.reply-name {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--ink-2);
  max-width: 130px;
  @include ellipsis;
}

.reply-floor {
  font-size: $fs-xs;
  color: var(--muted);
}

.reply-time {
  font-size: $fs-xs;
  color: var(--muted);
}

.reply-body {
  margin-top: 7px;
  font-size: $fs-base;
}

/* ----------------------------------------------------------- 回复入口 */

.reply-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  background: var(--surface);
  padding: $sp-2 $sp-3;
  padding-bottom: calc(#{$sp-2} + constant(safe-area-inset-bottom));
  padding-bottom: calc(#{$sp-2} + env(safe-area-inset-bottom));

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
  }
}

.reply-entry {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
  height: 40px;
  padding: 0 14px;
  border-radius: $r-full;
  background: var(--surface-2);
  border: 1px solid var(--line);
}

.reply-entry-hover {
  opacity: 0.75;
}

.reply-entry-text {
  font-size: $fs-sm;
  color: var(--muted);
}
</style>
