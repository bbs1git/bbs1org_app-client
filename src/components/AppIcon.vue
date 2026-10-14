<script setup lang="ts">
import { computed } from 'vue'
import { iconUrl } from '@/core/icon'
import { useUiStore } from '@/stores/ui'

/**
 * 图标。颜色是烘焙进 SVG 的，所以必须读一下主题，主题一变就重新生成 data URI。
 * size 用 px 传，各端表现一致。
 */
const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    /** 令牌名（'ink'/'accent'/'muted'）或任意 CSS 颜色 */
    color?: string
    weight?: number
    /** 选中态的填充版，只有部分图标有 */
    filled?: boolean
  }>(),
  { size: 20, color: 'muted', weight: 1.7, filled: false },
)

const ui = useUiStore()

const src = computed(() => {
  // 依赖主题：深浅色下同一个图标是两个不同的 data URI
  void ui.theme
  return iconUrl(props.name, { color: props.color, weight: props.weight, filled: props.filled })
})

const style = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
}))
</script>

<template>
  <image v-if="src" class="app-icon" :src="src" :style="style" mode="aspectFit" />
</template>

<style lang="scss" scoped>
.app-icon {
  flex: none;
  display: block;
}
</style>
