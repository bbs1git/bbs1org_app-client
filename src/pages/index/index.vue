<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  onHide,
  onLoad,
  onPageScroll,
  onPullDownRefresh,
  onReachBottom,
  onShow,
  onUnload,
} from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import BottomBar from '@/components/BottomBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import ForumPicker from '@/components/ForumPicker.vue'
import LoadMore from '@/components/LoadMore.vue'
import NavBar from '@/components/NavBar.vue'
import TopicCard from '@/components/TopicCard.vue'
import TopicSkeleton from '@/components/TopicSkeleton.vue'
import { CONTENT_GAP, usePageChrome } from '@/composables/usePageChrome'
import { openCreate, openLogin, openSearch, routes } from '@/core/navigate'
import { readStore, writeStore } from '@/core/storage'
import { toastError } from '@/core/ui'
import { useFeedStore } from '@/stores/feed'
import { useNotificationStore } from '@/stores/notifications'
import { useSiteStore } from '@/stores/site'
import { useSessionStore } from '@/stores/session'
import type { TopicSort } from '@/core/types'

/**
 * 首页。
 *
 * 用原生页面滚动而不是 scroll-view：翻页靠 onReachBottom、回顶部靠 uni.pageScrollTo，
 * 这两件事在三个端的表现最一致，滚动位置的恢复也简单（切回首页时不会白屏重来）。
 * 代价是下拉刷新的原生指示器会被自定义导航栏盖住，所以刷新时额外浮一个自己的指示器。
 */

/** 版块/排序那一行的高度：30px 的胶囊 + 12px 下边距。下拉面板要贴着它的下沿展开。 */
const FILTER_ROW_HEIGHT = 42

const { ui, scrolled, onScroll, headerHeight, contentTop, scrollTo } = usePageChrome()
const feed = useFeedStore()
const site = useSiteStore()
const session = useSessionStore()
const notifications = useNotificationStore()

const forumId = ref(0)
const sort = ref<TopicSort>('comment')
const lastScrollTop = ref(0)
const announcementClosed = ref(false)
/** 版块下拉。滚动时要收起来，所以留个引用。 */
const picker = ref<InstanceType<typeof ForumPicker> | null>(null)

const SORTS: { key: TopicSort; label: string }[] = [
  { key: 'comment', label: '最新回复' },
  { key: 'post', label: '最新发表' },
]

// 先把当前分桶建出来再定义下面的 computed：分桶的建立是一次写入，
// 不能发生在 computed 求值过程中，否则 computed 会在自己求值时被自己失效。
feed.touch(forumId.value, sort.value)

const state = computed(() => feed.stateOf(forumId.value, sort.value))

const forums = computed(() => site.forums.filter((forum) => forum.can_view))

const announcement = computed(() => {
  if (announcementClosed.value) return ''
  return site.announcement
})

/** 刷新中且已经有内容时才浮指示器 —— 首屏是骨架，不需要两个加载态。 */
const showRefreshTip = computed(() => state.value.refreshing && state.value.topics.length > 0)

const showSkeleton = computed(() => !state.value.loaded && state.value.loading && !state.value.error)

/**
 * 下拉面板在视口里的上沿。
 *
 * 版块行跟着内容滚，所以它的视口位置要减掉滚动距离。降级得很好用：
 * 滚动超过 4px 就会把面板收起来（见 onPageScroll），所以它真开着的时候
 * scrollTop 基本就是 0，这个减法只在几像素的范围内活动。
 */
const panelTop = computed(() => ui.navHeight + CONTENT_GAP + FILTER_ROW_HEIGHT - lastScrollTop.value)

const isEmpty = computed(() => state.value.loaded && state.value.topics.length === 0 && !state.value.error)

onLoad(async (options: Record<string, string> | undefined) => {
  const requested = Number((options && options.forum_id) || 0)
  if (requested > 0) forumId.value = requested
  await Promise.all([site.ensureConfig(), site.ensureForums()])
  // 深链带来的版块可能不可见（比如已经改了权限）。不可见就退回「全部」，
  // 否则下拉里显示的是「全部版块」，列表却在按那个版块筛，对不上。
  if (forumId.value > 0 && !forums.value.some((forum) => forum.id === forumId.value)) forumId.value = 0
  // 公告的关闭状态按内容记：换了新公告就再露一次，同一条不再打扰
  announcementClosed.value = !!site.announcement && readStore<string>('announcementClosed', '') === site.announcement
  await feed.ensure(forumId.value, sort.value)
})

onShow(() => {
  // 未读角标可能已经在别处标过了，回来对一次
  notifications.refreshBadge()
  // 有缓存的列表就恢复滚动位置，没有就停在顶部
  const cached = state.value.loaded ? state.value.scrollTop : 0
  if (cached > 0) setTimeout(() => scrollTo(cached), 30)
})

onHide(() => saveScroll())
onUnload(() => saveScroll())

onPageScroll((event) => {
  lastScrollTop.value = event.scrollTop
  onScroll(event)
  // 下拉开着的时候划页面，收起来，别让它挂在半空
  if (event.scrollTop > 4) picker.value?.close()
})

onReachBottom(() => {
  if (state.value.hasMore && !state.value.loading) feed.loadMore(forumId.value, sort.value)
})

onPullDownRefresh(async () => {
  picker.value?.close()
  try {
    await Promise.all([feed.refresh(forumId.value, sort.value), site.ensureForums(true)])
  } finally {
    uni.stopPullDownRefresh()
  }
})

/** 记滚动位置。切版块/切排序时当前分桶已经换了，所以要把旧的那对显式传进来。 */
function saveScroll(id = forumId.value, order: TopicSort = sort.value): void {
  // 只有真的加载过才记位置；没加载过的分桶不该因为一次 onHide 就被凭空建出来
  if (!feed.stateOf(id, order).loaded) return
  feed.touch(id, order).scrollTop = lastScrollTop.value
}

/** 切分桶的公共动作：先把旧的滚动位置存下，再复位、加载新的。 */
function switchFeed(id: number, order: TopicSort): void {
  saveScroll()
  forumId.value = id
  sort.value = order
  lastScrollTop.value = 0
  scrollTo(0)
  feed.ensure(id, order)
}

function selectForum(id: number): void {
  if (id === forumId.value) return
  switchFeed(id, sort.value)
}

function selectSort(next: TopicSort): void {
  if (next === sort.value) return
  switchFeed(forumId.value, next)
}

function closeAnnouncement(): void {
  announcementClosed.value = true
  writeStore('announcementClosed', site.announcement)
}

function compose(): void {
  if (!session.loggedIn) {
    openLogin({ redirect: routes.create })
    return
  }
  openCreate(forumId.value > 0 ? forumId.value : undefined)
}

async function refresh(): Promise<void> {
  try {
    await feed.refresh(forumId.value, sort.value)
  } catch (error) {
    toastError(error)
  }
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled">
      <template #left>
        <text class="brand">{{ site.siteName }}</text>
      </template>
      <template #right>
        <view class="icon-btn" hover-class="icon-btn-hover" @click="openSearch()">
          <AppIcon name="search" :size="21" color="ink" :weight="1.85" />
        </view>
        <view class="icon-btn" hover-class="icon-btn-hover" @click="compose">
          <AppIcon name="edit" :size="20" color="ink" :weight="1.85" />
        </view>
      </template>
    </NavBar>

    <!-- 原生下拉刷新的指示器会被自定义导航栏盖住，所以自己浮一个 -->
    <view class="refresh-tip" :class="{ 'is-visible': showRefreshTip }" :style="{ top: headerHeight(8) }">
      <view class="refresh-spinner" />
      <text class="refresh-text">正在刷新</text>
    </view>

    <view class="body" :style="{ paddingTop: contentTop() }">
      <!-- 版块与排序不是导航栏的一部分，跟着内容一起滚。代价是滚下去之后
           要改版块得先滚回顶部 —— 换来的是内容多出一整行的高度。 -->
      <view class="filter-row">
        <ForumPicker
          ref="picker"
          class="picker-slot"
          :forums="forums"
          :model-value="forumId"
          :top="panelTop"
          @update:model-value="selectForum"
        />

        <view class="sort">
          <view
            v-for="item in SORTS"
            :key="item.key"
            class="sort-item"
            :class="{ 'is-active': sort === item.key }"
            @click="selectSort(item.key)"
          >
            <text class="sort-text">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="announcement" class="notice">
        <AppIcon name="info" :size="16" color="accent" :weight="1.7" />
        <text class="notice-text">{{ announcement }}</text>
        <view class="notice-close" hover-class="notice-close-hover" @click="closeAnnouncement">
          <AppIcon name="close" :size="14" color="muted" :weight="1.9" />
        </view>
      </view>

      <TopicSkeleton v-if="showSkeleton" :count="5" />

      <EmptyState
        v-else-if="isEmpty"
        icon="comment"
        title="这里还没有主题"
        :description="forumId === 0 ? '整站都还没人发帖，来开第一帖吧' : '这个版块还空着，来开第一帖吧'"
        action="发新主题"
        @action="compose"
      />

      <EmptyState
        v-else-if="state.error && state.topics.length === 0"
        icon="wifi"
        title="没能连上服务器"
        :description="state.error"
        action="重试"
        @action="refresh"
      />

      <view v-else class="feed">
        <TopicCard
          v-for="topic in state.topics"
          :key="topic.id"
          :topic="topic"
          :show-forum="forumId === 0"
        />
        <LoadMore
          :loading="state.loading && state.topics.length > 0"
          :has-more="state.hasMore"
          :error="state.error"
          filled
          @retry="refresh"
        />
      </view>
    </view>

    <BottomBar :active="routes.home" />
  </view>
</template>

<style lang="scss" scoped>
.brand {
  font-size: $fs-lg;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
  max-width: 180px;
  @include ellipsis;
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

/* ------------------------------------------------------------ 版块与排序 */

.filter-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 $sp-3 12px;
}

.picker-slot {
  flex: 1;
  min-width: 0;
}

.sort {
  flex: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 2px;
  border-radius: $r-full;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.sort-item {
  height: 26px;
  padding: 0 9px;
  border-radius: $r-full;
  display: flex;
  align-items: center;
}

/* 容器已经是白的了，选中项不能再靠白色区分，改用一层浅灰底 */
.sort-item.is-active {
  background: var(--surface-3);
}

.sort-text {
  font-size: $fs-xs;
  color: var(--muted);
}

.sort-item.is-active .sort-text {
  color: var(--ink);
  font-weight: 600;
}

/* ------------------------------------------------------------ 刷新提示 */

.refresh-tip {
  position: fixed;
  left: 50%;
  z-index: 58;
  transform: translate(-50%, -14px);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 $sp-3;
  border-radius: $r-full;
  background: var(--surface);
  box-shadow: var(--shadow-float);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;

  &.is-visible {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.refresh-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1.6px solid var(--line-strong);
  border-top-color: var(--accent);
  animation: home-spin 0.7s linear infinite;
}

@keyframes home-spin {
  to {
    transform: rotate(360deg);
  }
}

.refresh-text {
  font-size: $fs-xs;
  color: var(--ink-2);
}

/* --------------------------------------------------------------- 内容 */

.body {
  flex: 1;
  padding-bottom: 68px;
}

.notice {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: $sp-2;
  // 顶部间距由 contentTop() 统一给，这里只留公告与列表之间的气口
  margin: 0 $sp-3 10px;
  padding: 11px 12px;
  border-radius: $r-md;
  background: var(--accent-soft);
}

.notice-text {
  flex: 1;
  min-width: 0;
  font-size: $fs-sm;
  line-height: 1.5;
  color: var(--ink);
}

.notice-close {
  width: 20px;
  height: 20px;
  margin-top: -1px;
  margin-right: -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-full;
  flex: none;
}

.notice-close-hover {
  background: var(--surface-3);
}

.feed {
  padding: 0 $sp-3 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
