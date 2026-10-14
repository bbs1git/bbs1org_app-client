<script setup lang="ts">
import { computed } from 'vue'
import { prepareHtml, textToHtml } from '@/core/rich'
import { previewImage } from '@/core/platform'

/**
 * 帖子正文。服务端给了渲染好的 HTML 就直接用，没给就按纯文本排一下 ——
 * 退化的样子也比一片空白好。
 */
const props = defineProps<{
  html?: string
  text?: string
}>()

const nodes = computed(() => prepareHtml(props.html || '') || textToHtml(props.text || ''))

/** 小程序里 rich-text 内部的点击只能靠 itemclick 拿到节点，顺手把图片接上大图预览。 */
function onItemClick(event: unknown): void {
  const detail = (event as { detail?: { node?: { name?: string; attrs?: Record<string, string> } } }).detail
  const node = detail && detail.node
  if (!node || node.name !== 'img') return
  const src = node.attrs && node.attrs.src
  if (!src) return
  previewImage([src], src)
}
</script>

<template>
  <rich-text class="rich-text" :nodes="nodes" @itemclick="onItemClick" />
</template>
