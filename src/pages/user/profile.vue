<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import Avatar from '@/components/Avatar.vue'
import BottomBar from '@/components/BottomBar.vue'
import NavBar from '@/components/NavBar.vue'
import { usePageChrome } from '@/composables/usePageChrome'
import { APP_VERSION, baseUrl } from '@/core/config'
import { compactNumber, fullTime } from '@/core/format'
import { openLogin, openSiteSettings, openUser, routes, switchMain } from '@/core/navigate'
import { confirm, toast, toastError } from '@/core/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useSessionStore } from '@/stores/session'
import { useSiteStore } from '@/stores/site'

/**
 * 我的。未登录时整页退化成一张引导卡，不显示空壳菜单。
 */

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const session = useSessionStore()
const site = useSiteStore()
const notifications = useNotificationStore()

const busy = ref(false)

const user = computed(() => session.user)
const unread = computed(() => notifications.unread || session.unread)

const needUpdate = computed(() => {
  const min = site.config?.update.min_app_version || ''
  if (!min) return false
  return compareVersion(APP_VERSION, min) < 0
})

/** 只比较数字段，够用且不会有语义化版本的边角情况。 */
function compareVersion(current: string, required: string): number {
  const left = current.split('.').map((part) => parseInt(part, 10) || 0)
  const right = required.split('.').map((part) => parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const a = left[i] || 0
    const b = right[i] || 0
    if (a !== b) return a > b ? 1 : -1
  }
  return 0
}

onShow(() => {
  if (!session.loggedIn) return
  void session.restore()
  void notifications.refreshBadge()
})

onPageScroll(onScroll)

function goNotifications(): void {
  switchMain(routes.notifications)
}

function showAbout(): void {
  uni.showModal({
    title: '关于',
    content:
      site.siteName +
      '\n客户端 v' +
      APP_VERSION +
      '\n接口地址 ' +
      baseUrl() +
      '\n\n内容版权归原作者所有。',
    showCancel: false,
    confirmText: '知道了',
  })
}

async function logout(): Promise<void> {
  if (busy.value) return
  if (!(await confirm('确定要退出登录吗？', '退出登录'))) return
  busy.value = true
  try {
    await session.logout()
    notifications.reset()
    toast('已退出登录')
  } catch (error) {
    toastError(error, '退出失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" title="我的">
      <template #right>
        <view class="icon-btn" hover-class="icon-btn-hover" @click="openSiteSettings()">
          <AppIcon name="settings" :size="20" color="ink" :weight="1.8" />
        </view>
      </template>
    </NavBar>

    <view class="body" :style="{ paddingTop: contentTop() }">
      <!-- 已登录：资料卡 -->
      <view v-if="user" class="profile" hover-class="profile-hover" @click="openUser(user.id)">
        <Avatar :src="user.avatar_url" :name="user.username" :seed="user.id" :size="62" />
        <view class="profile-main">
          <view class="profile-name-row">
            <text class="profile-name">{{ user.username }}</text>
            <text v-if="user.group && user.group.name" class="profile-group">{{ user.group.name }}</text>
          </view>
          <text v-if="user.bio" class="profile-bio">{{ user.bio }}</text>
          <view class="profile-stats">
            <view class="stat">
              <text class="stat-num mono">{{ compactNumber(user.points || 0) }}</text>
              <text class="stat-label">积分</text>
            </view>
            <view class="stat-divider" />
            <view class="stat">
              <text class="stat-num mono">{{ compactNumber(unread) }}</text>
              <text class="stat-label">未读</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 未登录：引导卡 -->
      <view v-else class="guest">
        <view class="guest-mark">
          <AppIcon name="user" :size="30" color="accent" :weight="1.6" />
        </view>
        <text class="guest-title">还没有登录</text>
        <text class="guest-desc">登录后可以发帖、回复、收到提醒并把草稿同步到账号</text>
        <view class="btn btn-primary guest-btn" @click="openLogin()">
          <text class="btn-text">登录 / 注册</text>
        </view>
      </view>

      <view v-if="needUpdate" class="banner">
        <AppIcon name="alert" :size="16" color="warn" :weight="1.8" />
        <text class="banner-text">
          当前版本 v{{ APP_VERSION }} 低于站点要求的 v{{ site.config?.update.min_app_version }}，部分功能可能不可用
        </text>
      </view>

      <view v-if="session.isMuted" class="banner banner-danger">
        <AppIcon name="alert" :size="16" color="danger" :weight="1.8" />
        <text class="banner-text">你目前处于禁言状态，暂时不能发帖和回复</text>
      </view>

      <view v-if="user" class="menu">
        <view class="menu-item" hover-class="menu-item-hover" @click="goNotifications">
          <AppIcon name="bell" :size="19" color="ink2" :weight="1.75" />
          <text class="menu-label">我的消息</text>
          <view class="grow" />
          <text v-if="unread > 0" class="menu-badge">{{ unread > 99 ? '99+' : unread }}</text>
          <AppIcon name="chevron-right" :size="15" color="muted" :weight="1.8" />
        </view>
      </view>

      <view class="menu">
        <view class="menu-item" hover-class="menu-item-hover" @click="openSiteSettings()">
          <AppIcon name="sliders" :size="19" color="ink2" :weight="1.75" />
          <text class="menu-label">设置</text>
          <view class="grow" />
          <text class="menu-value">{{ ui.isDark ? '深色' : '浅色' }}</text>
          <AppIcon name="chevron-right" :size="15" color="muted" :weight="1.8" />
        </view>

        <view class="menu-item" hover-class="menu-item-hover" @click="showAbout">
          <AppIcon name="info" :size="19" color="ink2" :weight="1.75" />
          <text class="menu-label">关于</text>
          <view class="grow" />
          <text class="menu-value mono">v{{ APP_VERSION }}</text>
          <AppIcon name="chevron-right" :size="15" color="muted" :weight="1.8" />
        </view>
      </view>

      <view v-if="user" class="menu">
        <view class="menu-item" :class="{ 'is-busy': busy }" hover-class="menu-item-hover" @click="logout">
          <AppIcon name="logout" :size="19" color="danger" :weight="1.75" />
          <text class="menu-label menu-label-danger">退出登录</text>
        </view>
      </view>

      <view v-if="user" class="foot">
        <text class="foot-text">注册于 {{ fullTime(user.created_at) }}</text>
        <text class="foot-text">{{ site.config?.site_url || baseUrl() }}</text>
      </view>
    </view>

    <BottomBar :active="routes.profile" />
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding: 0 15px 68px;
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

/* ------------------------------------------------------------ 资料卡 */

.profile {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: $r-lg;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.profile-hover {
  opacity: 0.9;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.profile-name-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
}

.profile-name {
  font-size: $fs-lg;
  font-weight: 700;
  color: var(--ink);
  max-width: 150px;
  @include ellipsis;
}

.profile-group {
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
  flex: none;
}

.profile-bio {
  display: block;
  margin-top: 3px;
  font-size: $fs-xs;
  color: var(--muted);
  @include ellipsis;
}

.profile-stats {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-3;
  margin-top: 8px;
}

.stat {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 4px;
}

.stat-num {
  font-size: $fs-sm;
  font-weight: 700;
  color: var(--ink);
}

.stat-label {
  font-size: $fs-xs;
  color: var(--muted);
}

.stat-divider {
  width: 1px;
  height: 11px;
  background: var(--line-strong);
}

/* ------------------------------------------------------------ 未登录 */

.guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px 26px;
  border-radius: $r-lg;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.guest-mark {
  width: 60px;
  height: 60px;
  border-radius: $r-full;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.guest-title {
  margin-top: 14px;
  font-size: $fs-lg;
  font-weight: 700;
  color: var(--ink);
}

.guest-desc {
  margin-top: 6px;
  font-size: $fs-sm;
  color: var(--muted);
  text-align: center;
  line-height: 1.6;
  max-width: 280px;
}

.guest-btn {
  margin-top: $sp-5;
  width: 200px;
}

.btn-text {
  font-size: $fs-md;
  font-weight: 600;
  color: var(--accent-ink);
}

/* ------------------------------------------------------------ 提示条 */

.banner {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: $r-md;
  background: var(--surface-2);
}

.banner-danger {
  background: transparent;
  border: 1px solid var(--line);
}

.banner-text {
  flex: 1;
  font-size: $fs-xs;
  line-height: 1.6;
  color: var(--ink-2);
}

/* -------------------------------------------------------------- 菜单 */

.menu {
  margin-top: 12px;
  border-radius: $r-lg;
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.menu-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 11px;
  height: 50px;
  padding: 0 15px;
  position: relative;

  & + .menu-item::before {
    content: '';
    position: absolute;
    left: 45px;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
  }

  &.is-busy {
    opacity: 0.5;
  }
}

.menu-item-hover {
  background: var(--surface-2);
}

.menu-label {
  font-size: $fs-base;
  color: var(--ink);
}

.menu-label-danger {
  color: var(--danger);
}

.menu-value {
  font-size: $fs-sm;
  color: var(--muted);
}

.menu-badge {
  min-width: 19px;
  height: 19px;
  padding: 0 6px;
  border-radius: $r-full;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 19px;
  text-align: center;
  font-family: $font-mono;
}

.foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 26px 0 10px;
}

.foot-text {
  font-size: $fs-xs;
  color: var(--muted);
}
</style>
