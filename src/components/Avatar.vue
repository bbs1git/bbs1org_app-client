<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { letterColor } from '@/core/color'

/**
 * 头像。站内的头像地址可能是外链，加载失败或为空时退化成「首字母 + 稳定底色」，
 * 不让列表里出现一排空框。底色由用户 ID 推出来，同一个人每次都一样。
 */
const props = withDefaults(
  defineProps<{
    src?: string
    name?: string
    /** 用来推底色，一般传用户 id */
    seed?: number | string
    size?: number
    /** 圆角：默认圆形，方形用于列表小尺寸 */
    shape?: 'circle' | 'square'
  }>(),
  { src: '', name: '', seed: 0, size: 36, shape: 'circle' },
)

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const showImage = computed(() => !!props.src && !failed.value)
const letter = computed(() => {
  const text = (props.name || '').trim()
  return text ? Array.from(text)[0].toUpperCase() : '?'
})

const style = computed(() => {
  const size = props.size + 'px'
  const box: Record<string, string> = { width: size, height: size }
  if (!showImage.value) box.background = letterColor(props.seed || props.name || '?')
  return box
})

const radius = computed(() => (props.shape === 'square' ? Math.round(props.size * 0.28) + 'px' : '50%'))
</script>

<template>
  <view class="avatar" :style="{ ...style, borderRadius: radius }">
    <image
      v-if="showImage"
      class="avatar-img"
      :src="src"
      mode="aspectFill"
      :style="{ borderRadius: radius }"
      @error="failed = true"
    />
    <text v-else class="avatar-letter" :style="{ fontSize: Math.round(size * 0.42) + 'px' }">{{ letter }}</text>
  </view>
</template>

<style lang="scss" scoped>
.avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--surface-3);
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-letter {
  color: #fff;
  font-weight: 600;
  line-height: 1;
}
</style>
