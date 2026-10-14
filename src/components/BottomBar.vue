<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import { routes, switchMain } from '@/core/navigate'
import type { MainRoute } from '@/core/navigate'
import { useNotificationStore } from '@/stores/notifications'
import { haptic } from '@/core/ui'

/**
 * 自绘底部栏。没用原生 tabBar：它的图标必须是图片文件，字号间距都改不了，
 * 也没法做未读角标。代价是切换要用 reLaunch，页面实例会被销毁 ——
 * 列表状态都缓存在 Pinia 里，所以切回来是立刻复原，不会重新请求。
 */
const props = defineProps<{ active: MainRoute }>()

const notifications = useNotificationStore()

const TABS: { key: MainRoute; label: string; icon: string }[] = [
  { key: routes.home, label: '首页', icon: 'home' },
  { key: routes.notifications, label: '消息', icon: 'bell' },
  { key: routes.profile, label: '我的', icon: 'user' },
]

const badge = computed(() => {
  const count = notifications.unread
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
})

function go(route: MainRoute): void {
  if (route === props.active) return
  haptic()
  switchMain(route)
}
</script>

<template>
  <view class="tabbar">
    <view class="tabbar-inner">
      <view
        v-for="tab in TABS"
        :key="tab.key"
        class="tabbar-item"
        :class="{ 'is-active': tab.key === active }"
        hover-class="tabbar-item-hover"
        :hover-stay-time="60"
        @click="go(tab.key)"
      >
        <view class="tabbar-icon">
          <AppIcon
            :name="tab.icon"
            :size="23"
            :color="tab.key === active ? 'accent' : 'muted'"
            :filled="tab.key === active"
            :weight="tab.key === active ? 1.9 : 1.7"
          />
          <text v-if="tab.key === routes.notifications && badge" class="tabbar-badge">{{ badge }}</text>
        </view>
        <text class="tabbar-label">{{ tab.label }}</text>
      </view>
    </view>
    <view class="tabbar-safe" />
  </view>
</template>

<style lang="scss" scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  background: var(--surface);

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

.tabbar-inner {
  display: flex;
  flex-direction: row;
  height: 52px;
}

.tabbar-safe {
  height: constant(safe-area-inset-bottom);
  height: env(safe-area-inset-bottom);
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.tabbar-item-hover {
  opacity: 0.7;
}

.tabbar-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabbar-label {
  font-size: $fs-xs;
  line-height: 1.2;
  color: var(--muted);
  transition: color 0.14s ease;
}

.is-active .tabbar-label {
  color: var(--accent);
  font-weight: 600;
}

.tabbar-badge {
  position: absolute;
  top: -5px;
  left: 50%;
  margin-left: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: $r-full;
  background: var(--danger);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  font-family: $font-mono;
}
</style>
