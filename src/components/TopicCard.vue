<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import Avatar from './Avatar.vue'
import { highlightColor, highlightLarge, readableHighlight } from '@/core/color'
import { splitHighlight } from '@/core/highlight'
import { compactNumber, relativeTime } from '@/core/format'
import { openTopic } from '@/core/navigate'
import { useUiStore } from '@/stores/ui'
import type { Topic } from '@/core/types'

/**
 * 列表里的一条主题。首页、版块、搜索结果、用户主页共用。
 *
 * 标题上的高亮不允许直接绑服务端给的 style 串 —— 只从中取出一个十六进制颜色
 * 和一个「放大」布尔，而且颜色还要按当前主题判一次对比度，
 * 否则管理员挑的深红在深色模式下就是一行看不见的字。
 */
const props = withDefaults(
  defineProps<{
    topic: Topic
    /** 跨版块的列表（搜索、最新）要标出所属版块；版块内的列表不用 */
    showForum?: boolean
    /** 用户主页那种窄列表，隐去作者行 */
    hideAuthor?: boolean
    /** 搜索关键词。给了就把标题和摘要里命中的片段标出来 */
    keyword?: string
    /** 命中回复时的那层回复片段，搜索页按 field 决定给不给 */
    replyExcerpt?: string
  }>(),
  { showForum: false, hideAuthor: false, keyword: '', replyExcerpt: '' },
)

const ui = useUiStore()

const titleColor = computed(() => {
  const raw = highlightColor(props.topic.highlight_style)
  return raw ? readableHighlight(raw, ui.theme) : ''
})

const titleLarge = computed(() => highlightLarge(props.topic.highlight_style))

const titleStyle = computed(() => {
  const style: Record<string, string> = {}
  if (titleColor.value) style.color = titleColor.value
  if (titleLarge.value) style.fontSize = '17px'
  return style
})

/** 摘要里的换行会撑高卡片，压成一行空格。命中回复的片段同理。 */
const excerpt = computed(() => (props.topic.excerpt || '').replace(/\s+/g, ' ').trim())

const replyExcerpt = computed(() => (props.replyExcerpt || '').replace(/\s+/g, ' ').trim())

/**
 * 三段文字按关键词切开。切分放在这里、用嵌套 <text> 直接渲染，
 * 不走子组件 —— 小程序那边传给子组件的 class 会落在组件外壳上，
 * 两行截断就得指望微信把外壳当块级容器，不如就让这些样式留在本组件里。
 */
const keyword = computed(() => props.keyword.trim())

const titleParts = computed(() => splitHighlight(props.topic.title, keyword.value))

const excerptParts = computed(() => splitHighlight(excerpt.value, keyword.value))

const replyParts = computed(() => splitHighlight(replyExcerpt.value, keyword.value))

const hasHead = computed(() => props.showForum || props.topic.is_pinned)

/** 列表按最后回复排序，所以时间也跟最后回复走；没人回过才回落到发布时间。 */
const timeText = computed(() => relativeTime(props.topic.last_reply_at || props.topic.created_at))

function open(): void {
  openTopic(props.topic.id)
}
</script>

<template>
  <view class="topic" hover-class="topic-hover" :hover-stay-time="60" @click="open">
    <view v-if="hasHead" class="topic-head">
      <text v-if="showForum && topic.forum.name" class="tag tag-forum">{{ topic.forum.name }}</text>
      <text v-if="topic.is_pinned" class="tag tag-pin">置顶</text>
    </view>

    <text class="topic-title" :style="titleStyle">
      <text v-for="(part, index) in titleParts" :key="index" :class="{ 'hl-hit': part.hit }">{{ part.text }}</text>
    </text>

    <text v-if="excerpt" class="topic-excerpt">
      <text v-for="(part, index) in excerptParts" :key="index" :class="{ 'hl-hit': part.hit }">{{ part.text }}</text>
    </text>

    <view v-if="replyExcerpt" class="topic-match">
      <text class="topic-match-tag">命中回复</text>
      <text class="topic-match-text">
        <text v-for="(part, index) in replyParts" :key="index" :class="{ 'hl-hit': part.hit }">{{ part.text }}</text>
      </text>
    </view>

    <view class="topic-foot">
      <template v-if="!hideAuthor">
        <Avatar :src="topic.author.avatar_url" :name="topic.author.username" :seed="topic.author.id" :size="20" />
        <text class="topic-author">{{ topic.author.username }}</text>
      </template>
      <text class="topic-time" :class="{ 'is-solo': hideAuthor }">{{ timeText }}</text>

      <view class="grow" />

      <view class="stat">
        <AppIcon name="comment" :size="14" :weight="1.6" />
        <text class="stat-num">{{ compactNumber(topic.reply_count) }}</text>
      </view>
      <view class="stat">
        <AppIcon name="eye" :size="14" :weight="1.6" />
        <text class="stat-num">{{ compactNumber(topic.view_count) }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.topic {
  background: var(--surface);
  border-radius: $r-lg;
  padding: 14px 15px 12px;
  box-shadow: var(--shadow-card);
}

.topic-hover {
  background: var(--surface-2);
}

.topic-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-1 + 2px;
  margin-bottom: $sp-2;
}

.tag {
  display: inline-flex;
  align-items: center;
  height: 19px;
  padding: 0 6px;
  border-radius: 5px;
  font-size: $fs-xs;
  line-height: 1;
  flex: none;
}

.tag-forum {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.tag-pin {
  background: var(--surface-3);
  color: var(--warn);
  font-weight: 600;
}

.topic-title {
  display: block;
  font-size: $fs-md;
  font-weight: 600;
  line-height: 1.42;
  color: var(--ink);
  @include clamp-lines(2);
}

.topic-excerpt {
  display: block;
  margin-top: 5px;
  font-size: $fs-sm;
  line-height: 1.55;
  color: var(--muted);
  @include clamp-lines(2);
}

/* 命中回复：搜「回复」时才知道为什么这条会被搜出来，不然只看到一个标题 */
.topic-match {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
  margin-top: $sp-2;
  padding: 8px 10px;
  border-radius: $r-sm;
  background: var(--surface-2);
}

.topic-match-tag {
  flex: none;
  margin-top: 1px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: $fs-xs;
  line-height: 16px;
  color: var(--accent);
  background: var(--accent-soft);
}

.topic-match-text {
  flex: 1;
  min-width: 0;
  font-size: $fs-sm;
  line-height: 1.55;
  color: var(--ink-2);
  @include clamp-lines(2);
}

/* 搜索命中的片段。放在三段文字自己的规则后面，好让它盖住标题的自定义高亮色 ——
   用户是照着这个词搜的，命中的那几个字比管理员设的颜色更该跳出来。 */
.hl-hit {
  color: var(--accent);
  font-weight: 600;
}

.topic-foot {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 11px;
}

.topic-author {
  font-size: $fs-xs;
  color: var(--ink-2);
  max-width: 110px;
  @include ellipsis;
}

.topic-time {
  font-size: $fs-xs;
  color: var(--muted);

  &.is-solo {
    margin-top: 0;
  }
}

.stat {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 3px;
  margin-left: $sp-3;
}

.stat-num {
  font-size: $fs-xs;
  color: var(--muted);
  font-family: $font-mono;
}
</style>
