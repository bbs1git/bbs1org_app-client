<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { useUiStore } from '@/stores/ui'
import type { Forum } from '@/core/types'

/**
 * 版块选择下拉。
 *
 * 原来是一行横向滚动的胶囊，版块一多就得左右划着找，还不知道划到头没有。
 * 改成下拉：点开是完整一列，当前项打勾，超长可滚。
 *
 * 面板和遮罩都用 position: fixed 挂在筛选条这个层叠上下文里（筛选条 z-index 55）——
 * 这样它们天然盖住页面内容，又不会盖住导航栏和底部栏。别把它们挪到筛选条外面去，
 * 那样就得和导航栏、底部栏的 z-index 抢高低，很容易一端一变就翻车。
 */

const props = defineProps<{
  /** 已经按可见性过滤过的版块，0 号「全部」由本组件补在最前面 */
  forums: Forum[]
  modelValue: number
  /** 面板顶边的位置（px）。由页面按自己的筛选条高度算好传进来 */
  top: number
}>()

const emit = defineEmits<{ (event: 'update:modelValue', id: number): void }>()

const ROW_HEIGHT = 46
const PANEL_PADDING = 6
/** 面板最多占视口的一半，剩下的留给页面本身，滚动才好滚 */
const VIEWPORT_RATIO = 0.5
const FALLBACK_CAP = 320

const ui = useUiStore()
const open = ref(false)

interface Row {
  id: number
  name: string
}

const rows = computed<Row[]>(() => [
  { id: 0, name: '全部版块' },
  ...props.forums.map((forum) => ({ id: forum.id, name: forum.name })),
])

const currentName = computed(() => {
  const hit = rows.value.find((row) => row.id === props.modelValue)
  return hit ? hit.name : '全部版块'
})

/**
 * 能整行放下几行。scroll-view 必须给确定高度才会滚，而面板上下还有内边距，
 * 所以要先把它扣掉再取整 —— 否则面板底边会切断半行，看着像渲染坏了，不像「还能滚」。
 */
const rowCount = computed(() => {
  const raw = ui.windowHeight > 0 ? Math.floor(ui.windowHeight * VIEWPORT_RATIO) : FALLBACK_CAP
  const capRows = Math.max(1, Math.floor((raw - PANEL_PADDING * 2) / ROW_HEIGHT))
  return Math.min(rows.value.length, capRows)
})

const listHeight = computed(() => rowCount.value * ROW_HEIGHT)

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function pick(id: number): void {
  open.value = false
  if (id !== props.modelValue) emit('update:modelValue', id)
}

// 页面在滚动、发帖返回等时机需要把它收起来
defineExpose({ close })
</script>

<template>
  <view class="picker">
    <view class="trigger" :class="{ 'is-open': open }" hover-class="trigger-hover" @click="toggle">
      <text class="trigger-text">{{ currentName }}</text>
      <view class="arrow" :class="{ 'is-open': open }">
        <AppIcon name="chevron-down" :size="13" color="muted" :weight="2.1" />
      </view>
    </view>

    <view v-if="open" class="mask" :style="{ top: top + 'px' }" @click="close" />

    <view v-if="open" class="panel" :style="{ top: top + 'px' }">
      <scroll-view class="panel-scroll" scroll-y :style="{ height: listHeight + 'px' }">
        <view
          v-for="row in rows"
          :key="row.id"
          class="row"
          :class="{ 'is-active': row.id === modelValue }"
          hover-class="row-hover"
          @click="pick(row.id)"
        >
          <text class="row-text">{{ row.name }}</text>
          <AppIcon v-if="row.id === modelValue" name="check" :size="16" color="accent" :weight="2.3" />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/* 行内排布，触发器按内容定宽 —— 不然作为块级元素会被拉满整行，
   筛选条右边那块留白就白留了。 */
.picker {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.trigger {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 3px;
  height: 30px;
  padding: 0 $sp-2 0 11px;
  border-radius: $r-full;
  // 这一行现在落在页面底色（灰）上，不再是白色筛选条里，所以填充要用卡片色 + 一点阴影
  // 才立得住；用 --surface-2 会和底色糊在一起，看着像没画出来的按钮。
  background: var(--surface);
  box-shadow: var(--shadow-card);
  max-width: 100%;
  transition: background 0.15s ease;

  &.is-open {
    background: var(--accent-soft);
  }
}

.trigger-hover {
  background: var(--surface-3);
}

.trigger-text {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--ink);
  max-width: 150px;
  @include ellipsis;
}

.trigger.is-open .trigger-text {
  color: var(--accent);
}

.arrow {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition: transform 0.18s ease;

  &.is-open {
    transform: rotate(180deg);
  }
}

/* 遮罩只在头部以下，头部和底部栏保持可用 —— 点它们不该被吞掉 */
.mask {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 54;
  background: rgba(16, 24, 32, 0.16);
  animation: picker-fade 0.16s ease;
}

.panel {
  position: fixed;
  left: $sp-3;
  right: $sp-3;
  z-index: 57;
  padding: $sp-1 + 2px 0;
  border-radius: $r-lg;
  background: var(--surface);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  animation: picker-drop 0.18s ease;
}

.panel-scroll {
  width: 100%;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: $sp-3;
  height: 46px;
  padding: 0 15px;
}

.row-hover {
  background: var(--surface-2);
}

.row-text {
  flex: 1;
  min-width: 0;
  font-size: $fs-base;
  color: var(--ink-2);
  @include ellipsis;
}

.row.is-active .row-text {
  color: var(--accent);
  font-weight: 600;
}

@keyframes picker-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes picker-drop {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
