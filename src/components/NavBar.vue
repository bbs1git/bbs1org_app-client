<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import { useUiStore } from '@/stores/ui'
import { back, routes } from '@/core/navigate'

/**
 * 自定义导航栏。用了 navigationStyle: custom，所以状态栏高度、微信胶囊的占位
 * 都要自己处理（见 stores/ui）。标题绝对居中，两侧是自然的 flex，
 * 这样左边有返回、右边没按钮时标题也不会偏。
 */
const props = withDefaults(
  defineProps<{
    title?: string
    /** 不传就按页面栈自动判断：只有一层时说明是主页面，不给返回 */
    showBack?: boolean
    /** 页面滚动过之后加分割线和阴影，让导航栏从内容里「浮」出来 */
    scrolled?: boolean
    /** 返回时没有上一页要去的地方 */
    fallback?: string
  }>(),
  { title: '', showBack: undefined, scrolled: false, fallback: routes.home },
)

const ui = useUiStore()

const canBack = computed(() => {
  if (props.showBack !== undefined) return props.showBack
  return getCurrentPages().length > 1
})

const rightPad = computed(() => (ui.capsuleWidth > 0 ? ui.capsuleWidth + 'px' : '12px'))

function onBack(): void {
  if (getCurrentPages().length > 1) {
    back()
    return
  }
  uni.reLaunch({ url: props.fallback })
}
</script>

<template>
  <view class="navbar" :class="{ 'is-scrolled': scrolled }">
    <view class="navbar-status" :style="{ height: ui.statusBarHeight + 'px' }" />
    <view
      class="navbar-inner"
      :style="{ height: ui.navContent + 'px', paddingRight: rightPad, paddingLeft: '12px' }"
    >
      <view class="navbar-left">
        <view v-if="canBack" class="navbar-btn" hover-class="navbar-btn-hover" @click="onBack">
          <AppIcon name="chevron-left" :size="22" color="ink" :weight="1.9" />
        </view>
        <slot name="left" />
      </view>

      <view class="navbar-title">
        <slot>
          <text class="navbar-title-text">{{ title }}</text>
        </slot>
      </view>

      <view class="navbar-right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  background: var(--surface);
  transition: box-shadow 0.18s ease;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
    opacity: 0;
    transition: opacity 0.18s ease;
  }

  &.is-scrolled {
    box-shadow: var(--shadow-card);
    &::after {
      opacity: 1;
    }
  }
}

.navbar-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-left,
.navbar-right {
  display: flex;
  align-items: center;
  gap: $sp-2;
  z-index: 1;
}

.navbar-right {
  justify-content: flex-end;
}

// 标题绝对居中：左右两侧按钮数量不一致时也不会偏
.navbar-title {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 84px;
  pointer-events: none;
}

.navbar-title-text {
  font-size: $fs-md;
  font-weight: 600;
  color: var(--ink);
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.navbar-btn {
  width: 34px;
  height: 34px;
  margin-left: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-full;
}

.navbar-btn-hover {
  background: var(--surface-2);
}
</style>
