<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * 列表底部。三种收尾状态各说各的话：还在加载、到底了、失败了可以重试。
 * 「到底了」只在列表不为空时显示，空列表由 EmptyState 负责，别两条提示叠在一起。
 */
withDefaults(
  defineProps<{
    loading?: boolean
    hasMore?: boolean
    error?: string
    /** 列表是否已有内容 */
    filled?: boolean
    emptyText?: string
    endText?: string
  }>(),
  {
    loading: false,
    hasMore: true,
    error: '',
    filled: false,
    emptyText: '',
    endText: '已经到底了',
  },
)

const emit = defineEmits<{ (event: 'retry'): void }>()
</script>

<template>
  <view class="loadmore">
    <view v-if="error && filled" class="loadmore-error" hover-class="loadmore-error-hover" @click="emit('retry')">
      <AppIcon name="refresh" :size="15" color="danger" />
      <text class="loadmore-error-text">{{ error }}，点击重试</text>
    </view>

    <view v-else-if="loading" class="loadmore-loading">
      <view class="loadmore-spinner" />
      <text class="loadmore-text">加载中</text>
    </view>

    <text v-else-if="!hasMore && filled" class="loadmore-text">{{ endText }}</text>

    <text v-else-if="!filled && emptyText" class="loadmore-text">{{ emptyText }}</text>
  </view>
</template>

<style lang="scss" scoped>
.loadmore {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: $sp-3 $sp-4 $sp-4;
}

.loadmore-text {
  font-size: $fs-xs;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.loadmore-loading {
  display: flex;
  align-items: center;
  gap: $sp-2;
}

.loadmore-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1.6px solid var(--line-strong);
  border-top-color: var(--accent);
  animation: loadmore-spin 0.7s linear infinite;
}

@keyframes loadmore-spin {
  to {
    transform: rotate(360deg);
  }
}

.loadmore-error {
  display: flex;
  align-items: center;
  gap: $sp-2;
  height: 32px;
  padding: 0 $sp-4;
  border-radius: $r-full;
  background: var(--surface-2);
}

.loadmore-error-hover {
  opacity: 0.7;
}

.loadmore-error-text {
  font-size: $fs-xs;
  color: var(--danger);
}
</style>
