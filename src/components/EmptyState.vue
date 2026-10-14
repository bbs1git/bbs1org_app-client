<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/**
 * 空状态。列表空、搜索无结果、未登录都要用，统一尺寸与语气，
 * 免得每页各写一套。带一个可选的操作按钮，比只放一句「暂无数据」有用。
 */
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    action?: string
    compact?: boolean
  }>(),
  { icon: 'info', description: '', action: '', compact: false },
)

const emit = defineEmits<{ (event: 'action'): void }>()
</script>

<template>
  <view class="empty" :class="{ 'is-compact': compact }">
    <view class="empty-badge">
      <AppIcon :name="icon" :size="30" color="muted" :weight="1.5" />
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="description" class="empty-desc">{{ description }}</text>
    <view v-if="action" class="empty-action" hover-class="empty-action-hover" @click="emit('action')">
      <text class="empty-action-text">{{ action }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72px $sp-6 64px;
}

.empty.is-compact {
  padding: 40px $sp-6 32px;
}

.empty-badge {
  width: 68px;
  height: 68px;
  border-radius: $r-full;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $sp-4;
}

.empty-title {
  font-size: $fs-base;
  font-weight: 600;
  color: var(--ink-2);
  text-align: center;
}

.empty-desc {
  margin-top: $sp-2;
  font-size: $fs-sm;
  color: var(--muted);
  text-align: center;
  line-height: 1.6;
  max-width: 280px;
}

.empty-action {
  margin-top: $sp-5;
  height: 38px;
  padding: 0 $sp-5;
  border-radius: $r-full;
  border: 1px solid var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-action-hover {
  background: var(--surface-2);
}

.empty-action-text {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--ink);
}
</style>
