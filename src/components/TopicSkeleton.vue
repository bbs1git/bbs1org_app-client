<script setup lang="ts">
/**
 * 首屏骨架。只在「一次都没加载成功过」时出现 —— 之后再进入都有 Pinia 缓存，
 * 直接渲染内容，不会闪骨架。
 */
withDefaults(defineProps<{ count?: number }>(), { count: 5 })
</script>

<template>
  <view class="skeleton-list">
    <view v-for="n in count" :key="n" class="skeleton-card">
      <view class="skeleton skeleton-title" />
      <view class="skeleton skeleton-line" style="width: 92%" />
      <view class="skeleton skeleton-line" style="width: 64%" />
      <view class="skeleton-foot">
        <view class="skeleton skeleton-avatar" />
        <view class="skeleton skeleton-meta" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.skeleton-list {
  padding: 0 $sp-3;
}

.skeleton-card {
  background: var(--surface);
  border-radius: $r-lg;
  padding: 16px 15px 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-card);
}

.skeleton-title {
  height: 17px;
  width: 78%;
  margin-bottom: 11px;
}

.skeleton-line {
  height: 12px;
  margin-bottom: 7px;
}

.skeleton-foot {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
  margin-top: 14px;
}

.skeleton-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.skeleton-meta {
  height: 11px;
  width: 84px;
}
</style>
