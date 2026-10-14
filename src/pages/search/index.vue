<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad, onPageScroll, onReachBottom } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadMore from '@/components/LoadMore.vue'
import TopicCard from '@/components/TopicCard.vue'
import TopicSkeleton from '@/components/TopicSkeleton.vue'
import { search } from '@/api/search'
import type { SearchField } from '@/api/search'
import { usePageChrome } from '@/composables/usePageChrome'
import { errorMessage } from '@/core/errors'
import { back } from '@/core/navigate'
import { readStore, writeStore } from '@/core/storage'
import { confirm, toast } from '@/core/ui'
import { useSiteStore } from '@/stores/site'
import type { Topic } from '@/core/types'

/**
 * 搜索。
 *
 * 搜索框直接做在导航栏里，不另占一行 —— 进这个页面就是为了打字。
 * 历史记录只存本地：服务端没有搜索历史接口，本地存也避免把个人检索词传到服务器。
 */

const FIELDS: { key: SearchField; label: string }[] = [
  { key: 'title', label: '标题' },
  { key: 'body', label: '正文' },
  { key: 'reply', label: '回复' },
]

const HISTORY_MAX = 12
/** 拿不到站点配置时的兜底。后台可以在「搜索最短字数」里改这个值 */
const FALLBACK_MIN_CHARS = 2

const { ui, scrolled, onScroll, contentTop, scrollTo } = usePageChrome()
const site = useSiteStore()

const keyword = ref('')
const field = ref<SearchField>('title')
const results = ref<Topic[]>([])
const cursor = ref('')
const hasMore = ref(false)
const loading = ref(false)
const searched = ref(false)
const error = ref('')
const history = ref<string[]>(readStore<string[]>('searchHistory', []) || [])
const inputFocused = ref(false)

const minChars = computed(() => {
  const value = Number(site.config?.limits?.search_min_chars)
  return Number.isFinite(value) && value > 1 ? value : FALLBACK_MIN_CHARS
})

/** 按字符数算，不能用 .length —— 一个汉字、一个 emoji 都只是一个字。 */
const typedChars = computed(() => Array.from(keyword.value.trim()).length)

const canSearch = computed(() => typedChars.value >= minChars.value)

/** 搜「回复」时服务端会额外给命中的那层回复，其余范围没有 */
const showReplyMatch = computed(() => field.value === 'reply')

onLoad(async () => {
  // 最短字数存在站点配置里，先拿到再决定按钮怎么亮
  await site.ensureConfig()
  // 进页面就把光标放到输入框，省一次点击
  nextTick(() => {
    inputFocused.value = true
  })
})

onPageScroll(onScroll)

onReachBottom(() => {
  void loadMore()
})

async function run(term?: string): Promise<void> {
  // 连点两下搜索：第一次还在飞，第二次会把状态清空然后被 load() 的 loading 挡回去，
  // 结果是列表空了、searched 还是 false，界面卡在「搜点什么」。直接不吃第二次。
  if (loading.value) return
  const text = (term !== undefined ? term : keyword.value).trim()
  if (!text) {
    toast('请输入搜索内容')
    return
  }
  if (Array.from(text).length < minChars.value) {
    toast('搜索内容至少需要' + minChars.value + '个字符')
    return
  }
  const sameQuery = text === keyword.value.trim() && searched.value && results.value.length > 0
  keyword.value = text
  inputFocused.value = false
  cursor.value = ''
  hasMore.value = false
  results.value = []
  searched.value = false
  // 上次翻到很下面时，新结果要回到顶部看，否则一进来就是半空的一屏
  scrollTo(0)
  await load(true)
  // 同一个词重复提交不再顶到历史最前面，省得历史里全是同一个词
  if (searched.value && results.value.length > 0 && !sameQuery) remember(text)
}

async function load(first: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const page = await search({
      q: keyword.value.trim(),
      field: field.value,
      cursor: first ? undefined : cursor.value || undefined,
      excerpt: true,
    })
    results.value = first ? page.topics : results.value.concat(page.topics)
    cursor.value = page.next_cursor || ''
    hasMore.value = !!page.has_more && !!page.next_cursor
    searched.value = true
  } catch (error_) {
    error.value = errorMessage(error_)
    if (!first) toast(errorMessage(error_, '加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (loading.value || !hasMore.value || !searched.value) return
  await load(false)
}

function switchField(next: SearchField): void {
  if (next === field.value) return
  field.value = next
  if (canSearch.value) void run()
}

function remember(text: string): void {
  const next = [text].concat(history.value.filter((item) => item !== text)).slice(0, HISTORY_MAX)
  history.value = next
  writeStore('searchHistory', next)
}

async function forget(text: string): Promise<void> {
  if (!(await confirm('删掉「' + text + '」这条搜索记录？', '删除记录'))) return
  history.value = history.value.filter((item) => item !== text)
  writeStore('searchHistory', history.value)
}

async function clearHistory(): Promise<void> {
  if (!history.value.length) return
  if (!(await confirm('清空全部搜索记录？', '清空记录'))) return
  history.value = []
  writeStore('searchHistory', [])
}

function retry(): void {
  if (!searched.value) {
    void run()
    return
  }
  void load(true)
}

function goBack(): void {
  back()
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <view class="searchbar" :class="{ 'is-scrolled': scrolled }">
      <view class="searchbar-status" :style="{ height: ui.statusBarHeight + 'px' }" />
      <view class="searchbar-inner" :style="{ height: ui.navContent + 'px' }">
        <view class="back" hover-class="back-hover" @click="goBack">
          <AppIcon name="chevron-left" :size="22" color="ink" :weight="1.9" />
        </view>
        <view class="input-wrap">
          <AppIcon name="search" :size="16" color="muted" :weight="1.8" />
          <input
            v-model="keyword"
            class="input"
            type="text"
            placeholder="搜索主题"
            placeholder-class="input-placeholder"
            confirm-type="search"
            :focus="inputFocused"
            @confirm="run()"
          />
          <view v-if="keyword" class="clear" @click="keyword = ''">
            <AppIcon name="close" :size="13" color="muted" :weight="2" />
          </view>
        </view>
        <text class="action" :class="{ 'is-active': canSearch }" @click="run()">搜索</text>
      </view>

      <view class="fields">
        <view
          v-for="item in FIELDS"
          :key="item.key"
          class="field"
          :class="{ 'is-active': field === item.key }"
          @click="switchField(item.key)"
        >
          <text class="field-text">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="body" :style="{ paddingTop: contentTop(34) }">
      <!-- 分支顺序有讲究：加载态和错误都要排在「还没搜过」前面，
           否则第一次搜索失败时会被历史记录那一屏盖掉，用户只看到输入框发呆。 -->

      <!-- 首屏搜索：有骨架，不然点了搜索页面像是没反应 -->
      <TopicSkeleton v-if="loading && !results.length" :count="4" />

      <EmptyState
        v-else-if="error && !results.length"
        icon="wifi"
        title="搜索失败"
        :description="error"
        action="重试"
        @action="retry"
      />

      <template v-else-if="!searched">
        <view v-if="history.length" class="history">
          <view class="history-head">
            <text class="history-title">搜索历史</text>
            <view class="grow" />
            <text class="history-hint">长按可删</text>
            <view class="history-clear" hover-class="history-clear-hover" @click="clearHistory">
              <AppIcon name="trash" :size="15" color="muted" :weight="1.7" />
            </view>
          </view>
          <view class="chips">
            <view
              v-for="item in history"
              :key="item"
              class="chip-item"
              hover-class="chip-item-hover"
              @click="run(item)"
              @longpress="forget(item)"
            >
              <text class="chip-text">{{ item }}</text>
            </view>
          </view>
        </view>

        <EmptyState
          v-else
          icon="search"
          title="搜点什么"
          description="可以按标题、正文或回复内容检索，只会在你能看到的版块里找"
        />
      </template>

      <EmptyState
        v-else-if="!results.length"
        icon="search"
        title="没有找到相关内容"
        description="换个关键词，或者切到「正文」「回复」再试一次"
      />

      <view v-else class="list">
        <TopicCard
          v-for="topic in results"
          :key="topic.id"
          :topic="topic"
          :keyword="keyword.trim()"
          :reply-excerpt="showReplyMatch ? topic.matched_reply_excerpt || '' : ''"
          show-forum
        />
        <LoadMore
          :loading="loading"
          :has-more="hasMore"
          filled
          end-text="没有更多结果了"
          @retry="retry"
        />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.searchbar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 60;
  background: var(--surface);
  transition: box-shadow 0.18s ease;

  &.is-scrolled {
    box-shadow: var(--shadow-card);
  }
}

.searchbar-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
  padding: 0 $sp-3 0 6px;
}

.back {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-full;
  flex: none;
}

.back-hover {
  background: var(--surface-2);
}

.input-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border-radius: $r-full;
  background: var(--surface-2);
}

.input {
  flex: 1;
  min-width: 0;
  height: 34px;
  font-size: $fs-sm;
  color: var(--ink);
}

.input-placeholder {
  color: var(--muted);
}

.clear {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.action {
  flex: none;
  font-size: $fs-sm;
  color: var(--muted);
  padding: 0 4px;

  &.is-active {
    color: var(--accent);
    font-weight: 600;
  }
}

.fields {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
  padding: 0 $sp-3 8px;
}

.field {
  height: 26px;
  padding: 0 11px;
  border-radius: $r-full;
  background: var(--surface-2);
  display: flex;
  align-items: center;
}

.field.is-active {
  background: var(--accent);
}

.field-text {
  font-size: $fs-xs;
  color: var(--ink-2);
}

.field.is-active .field-text {
  color: var(--accent-ink);
  font-weight: 600;
}

.body {
  flex: 1;
  padding-bottom: 32px;
}

.list {
  padding: 0 $sp-3 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history {
  padding: 4px 15px 16px;
}

.history-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
}

.history-title {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--ink-2);
}

/* 长按删除没有可发现性，挂一句提示；面板高度固定，别再占一行 */
.history-hint {
  font-size: $fs-xs;
  color: var(--muted);
  margin-right: $sp-1;
}

.history-clear {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-full;
}

.history-clear-hover {
  background: var(--surface-2);
}

.chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: $sp-2;
}

.chip-item {
  max-width: 100%;
  height: 32px;
  padding: 0 13px;
  border-radius: $r-full;
  background: var(--surface);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
}

.chip-item-hover {
  background: var(--surface-2);
}

.chip-text {
  font-size: $fs-sm;
  color: var(--ink-2);
  @include ellipsis;
}
</style>
