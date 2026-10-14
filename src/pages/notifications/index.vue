<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import Avatar from '@/components/Avatar.vue'
import BottomBar from '@/components/BottomBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadMore from '@/components/LoadMore.vue'
import NavBar from '@/components/NavBar.vue'
import { usePageChrome } from '@/composables/usePageChrome'
import { relativeTime } from '@/core/format'
import { openLogin, openTopic, routes } from '@/core/navigate'
import { toast, toastError } from '@/core/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useSessionStore } from '@/stores/session'
import type { NotificationItem } from '@/core/types'

/**
 * 消息中心。
 *
 * 通知的 kind 是内核和插件自由填的字符串（'direct'、'points'、'award'……），
 * 列举不完，所以只认几个常见的给个像样的图标，其余统一走默认，
 * 显示上不会因为多了个新 kind 就变成空白。
 */

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const notifications = useNotificationStore()
const session = useSessionStore()

const KIND_ICON: Record<string, string> = {
  direct: 'comment',
  topic: 'comment',
  reply: 'comment',
  points: 'tag',
  award: 'tag',
  reserve: 'tag',
  ban: 'alert',
  reject: 'alert',
  abort: 'alert',
  admin: 'shield',
}

const items = computed(() => notifications.items)
const unread = computed(() => notifications.unread)

const headerTitle = computed(() => (unread.value > 0 ? `消息 · ${unread.value} 条未读` : '消息'))

const canMarkAll = computed(() => unread.value > 0 && !notifications.loading)

onLoad(() => {
  if (!session.loggedIn) return
  void notifications.ensure()
})

onShow(() => {
  if (session.loggedIn) void notifications.refreshBadge()
})

onPageScroll(onScroll)

onReachBottom(() => {
  void notifications.loadMore()
})

onPullDownRefresh(async () => {
  try {
    if (session.loggedIn) await notifications.refresh()
  } finally {
    uni.stopPullDownRefresh()
  }
})

function iconOf(item: NotificationItem): string {
  return KIND_ICON[item.kind] || 'bell'
}

async function open(item: NotificationItem): Promise<void> {
  void notifications.markItemRead(item.id)
  if (item.topic_id > 0) {
    openTopic(item.topic_id)
    return
  }
  toast(item.content)
}

async function markAll(): Promise<void> {
  if (!canMarkAll.value) return
  try {
    await notifications.markAllRead()
    toast('已全部标为已读')
  } catch (error) {
    toastError(error, '操作失败')
  }
}

function refresh(): void {
  void notifications.refresh()
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" :title="headerTitle">
      <template #right>
        <view v-if="canMarkAll" class="mark" hover-class="mark-hover" @click="markAll">
          <text class="mark-text">全部已读</text>
        </view>
      </template>
    </NavBar>

    <view class="body" :style="{ paddingTop: contentTop() }">
      <EmptyState
        v-if="!session.loggedIn"
        icon="lock"
        title="还没有登录"
        description="登录后才能查看回复和私信提醒"
        action="去登录"
        @action="openLogin()"
      />

      <template v-else>
        <EmptyState
          v-if="notifications.loaded && !items.length"
          icon="bell"
          title="暂时没有消息"
          description="有人回复你、@你或者给你发私信时会出现在这里"
        />

        <EmptyState
          v-else-if="notifications.error && !items.length"
          icon="wifi"
          title="没能加载消息"
          :description="notifications.error"
          action="重试"
          @action="refresh"
        />

        <view v-else class="list">
          <view
            v-for="item in items"
            :key="item.id"
            class="row"
            :class="{ 'is-unread': !item.is_read }"
            hover-class="row-hover"
            @click="open(item)"
          >
            <view class="row-avatar">
              <Avatar
                v-if="item.sender"
                :src="item.sender.avatar_url"
                :name="item.sender.username"
                :seed="item.sender.id"
                :size="38"
              />
              <view v-else class="row-icon">
                <AppIcon :name="iconOf(item)" :size="18" color="muted" :weight="1.7" />
              </view>
              <text v-if="!item.is_read" class="row-dot" />
            </view>

            <view class="row-main">
              <view class="row-head">
                <text class="row-name">{{ item.sender ? item.sender.username : '系统通知' }}</text>
                <view class="grow" />
                <text class="row-time">{{ relativeTime(item.created_at) }}</text>
              </view>
              <text class="row-content">{{ item.content }}</text>
            </view>
          </view>

          <LoadMore
            :loading="notifications.loading && items.length > 0"
            :has-more="notifications.hasMore"
            :error="notifications.error"
            filled
            @retry="refresh"
          />
        </view>
      </template>
    </view>

    <BottomBar :active="routes.notifications" />
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding-bottom: 68px;
}

.mark {
  height: 28px;
  padding: 0 12px;
  border-radius: $r-full;
  background: var(--surface-2);
  display: flex;
  align-items: center;
}

.mark-hover {
  opacity: 0.7;
}

.mark-text {
  font-size: $fs-xs;
  color: var(--ink-2);
  font-weight: 600;
}

.list {
  background: var(--surface);
}

.row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 15px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 64px;
    right: 15px;
    bottom: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
  }
}

.row-hover {
  background: var(--surface-2);
}

// 未读整行用极浅的强调底色，比只点一个小红点更容易扫到
.row.is-unread {
  background: var(--accent-soft);
}

.row-avatar {
  position: relative;
  flex: none;
}

.row-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--danger);
  border: 1.5px solid var(--surface);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
}

.row-name {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--ink);
  max-width: 140px;
  @include ellipsis;
}

.row-time {
  font-size: $fs-xs;
  color: var(--muted);
  flex: none;
}

.row-content {
  display: block;
  margin-top: 3px;
  font-size: $fs-sm;
  line-height: 1.55;
  color: var(--ink-2);
  @include clamp-lines(3);
}
</style>
