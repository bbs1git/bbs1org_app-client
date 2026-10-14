<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import NavBar from '@/components/NavBar.vue'
import { createTopic } from '@/api/topics'
import { uploadFile } from '@/api/upload'
import { usePageChrome } from '@/composables/usePageChrome'
import { charCount } from '@/core/format'
import { pageQuery, routes } from '@/core/navigate'
import { chooseImage } from '@/core/platform'
import { actionSheet, toast, toastError, toastSuccess, withLoading } from '@/core/ui'
import { useFeedStore } from '@/stores/feed'
import { useSessionStore } from '@/stores/session'
import { useSiteStore } from '@/stores/site'

/**
 * 发布主题。
 *
 * 正文是 Markdown，图片上传后插入的是 ![](url)。校验分成两层：
 * 这层先用站点配置里的长度限制挡住明显不合规的输入，服务端的校验仍然是最终权威
 * （字数按码点算，最短长度、发帖间隔这些也都在服务端再判一次）。
 */

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const site = useSiteStore()
const session = useSessionStore()
const feed = useFeedStore()

const forumId = ref(0)
const title = ref('')
const body = ref('')
const submitting = ref(false)
const uploading = ref(false)

const forums = computed(() => site.editableForums)

const forumName = computed(() => {
  const found = forums.value.find((forum) => forum.id === forumId.value)
  return found ? found.name : ''
})

const limits = computed(() => site.config?.limits)
const titleMax = computed(() => Number(limits.value?.title_max_length) || 80)
const titleMin = computed(() => Number(limits.value?.title_min_length) || 4)
const bodyMax = computed(() => Number(limits.value?.topic_body_max_length) || 20000)
const bodyMin = computed(() => Number(limits.value?.topic_body_min_length) || 4)

const titleCount = computed(() => charCount(title.value))
const bodyCount = computed(() => charCount(body.value))

const uploadEnabled = computed(() => !!site.config?.upload.enabled)
const uploadMaxMb = computed(() => Number(site.config?.upload.max_mb) || 0)

const titleOver = computed(() => titleCount.value > titleMax.value)
const bodyOver = computed(() => bodyCount.value > bodyMax.value)

const canSubmit = computed(
  () =>
    !submitting.value &&
    !uploading.value &&
    forumId.value > 0 &&
    titleCount.value >= titleMin.value &&
    !titleOver.value &&
    bodyCount.value >= bodyMin.value &&
    !bodyOver.value,
)

/** 按钮不亮的时候要让用户知道差在哪，而不是点不动又没解释。 */
const blockReason = computed(() => {
  if (forumId.value < 1) return '先选一个版块'
  if (titleCount.value < titleMin.value) return `标题至少 ${titleMin.value} 个字`
  if (titleOver.value) return `标题最多 ${titleMax.value} 个字`
  if (bodyCount.value < bodyMin.value) return `正文至少 ${bodyMin.value} 个字`
  if (bodyOver.value) return `正文最多 ${bodyMax.value} 个字`
  return ''
})

onLoad(async (options: Record<string, string> | undefined) => {
  await Promise.all([site.ensureConfig(), site.ensureForums(true)])
  const query = options || pageQuery<{ forum_id?: string }>()
  const requested = Number(query.forum_id || 0)
  if (requested > 0 && forums.value.some((forum) => forum.id === requested)) {
    forumId.value = requested
  } else if (forums.value.length === 1) {
    // 只有一个可发版块时别让用户白点一次
    forumId.value = forums.value[0].id
  }
})

onPageScroll(onScroll)

async function pickForum(): Promise<void> {
  if (forums.value.length === 0) {
    toast('你所在的用户组暂时没有可发帖的版块')
    return
  }
  if (forums.value.length === 1) {
    forumId.value = forums.value[0].id
    return
  }
  const index = await actionSheet(
    forums.value.map((forum) => forum.name),
    '选择版块',
  )
  if (index >= 0 && index < forums.value.length) forumId.value = forums.value[index].id
}

async function pickImage(): Promise<void> {
  if (uploading.value) return
  let paths: string[]
  try {
    paths = await chooseImage(1)
  } catch {
    return
  }
  if (!paths.length) return

  uploading.value = true
  try {
    const result = await withLoading(() => uploadFile(paths[0]), '上传中')
    body.value = body.value + (body.value && !body.value.endsWith('\n') ? '\n' : '') + '![](' + result.url + ')\n'
  } catch (error) {
    toastError(error, '上传失败')
  } finally {
    uploading.value = false
  }
}

async function submit(): Promise<void> {
  if (submitting.value) return
  if (!canSubmit.value) {
    toast(blockReason.value || '还不能发布')
    return
  }
  submitting.value = true
  try {
    const result = await createTopic({
      forum_id: forumId.value,
      title: title.value.trim(),
      body: body.value.trim(),
    })
    // 本地缓存的列表里没有这一条，标成未加载，回首页会重新拉
    feed.invalidate()
    toastSuccess('发布成功')
    // 用 redirectTo 而不是 navigateTo：发完不该还能「返回」到空白的编辑页
    setTimeout(() => {
      uni.redirectTo({ url: routes.topic + '?id=' + result.topic_id })
    }, 320)
  } catch (error) {
    toastError(error, '发布失败')
    submitting.value = false
  }
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" title="发布主题">
      <template #right>
        <view class="publish" :class="{ 'is-disabled': !canSubmit }" hover-class="publish-hover" @click="submit">
          <text class="publish-text">{{ submitting ? '发布中' : '发布' }}</text>
        </view>
      </template>
    </NavBar>

    <view class="body" :style="{ paddingTop: contentTop() }">
      <view v-if="!session.loggedIn" class="guard">
        <text class="guard-text">请先登录后再发布主题</text>
      </view>

      <template v-else>
        <view class="form">
          <view class="field" hover-class="field-hover" @click="pickForum">
            <text class="field-label">版块</text>
            <text class="field-value" :class="{ 'is-empty': !forumName }">
              {{ forumName || '请选择版块' }}
            </text>
            <AppIcon name="chevron-right" :size="16" color="muted" :weight="1.8" />
          </view>

          <view class="divider" />

          <view class="title-row">
            <input
              v-model="title"
              class="title-input"
              type="text"
              placeholder="标题"
              placeholder-class="input-placeholder"
              :maxlength="titleMax + 20"
              :confirm-type="'next'"
            />
            <text class="counter" :class="{ 'is-over': titleOver }">{{ titleCount }}/{{ titleMax }}</text>
          </view>

          <view class="divider" />

          <textarea
            v-model="body"
            class="body-input"
            placeholder="正文，支持 Markdown：**加粗**、> 引用、![](图片地址)"
            placeholder-class="input-placeholder"
            :maxlength="bodyMax + 200"
            :cursor-spacing="20"
            :disable-default-padding="true"
          />

          <view class="tools">
            <view
              v-if="uploadEnabled"
              class="tool"
              :class="{ 'is-busy': uploading }"
              hover-class="tool-hover"
              @click="pickImage"
            >
              <AppIcon :name="uploading ? 'refresh' : 'image'" :size="18" color="ink2" :weight="1.7" />
              <text class="tool-text">插入图片</text>
            </view>
            <view class="grow" />
            <text class="counter" :class="{ 'is-over': bodyOver }">{{ bodyCount }}/{{ bodyMax }}</text>
          </view>
        </view>

        <view v-if="blockReason" class="hint">
          <AppIcon name="info" :size="14" color="muted" :weight="1.7" />
          <text class="hint-text">{{ blockReason }}</text>
        </view>

        <view v-if="uploadMaxMb > 0" class="hint">
          <AppIcon name="upload" :size="14" color="muted" :weight="1.7" />
          <text class="hint-text">单张图片不超过 {{ uploadMaxMb }}MB</text>
        </view>

        <view class="submit-wrap">
          <view class="btn btn-primary" :class="{ 'is-disabled': !canSubmit }" @click="submit">
            <text class="btn-text">{{ submitting ? '发布中…' : '发布主题' }}</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding-bottom: 40px;
}

.publish {
  height: 30px;
  padding: 0 14px;
  border-radius: $r-full;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-disabled {
    opacity: 0.4;
  }
}

.publish-hover {
  opacity: 0.8;
}

.publish-text {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--accent-ink);
}

.guard {
  padding: 60px $sp-6;
  display: flex;
  justify-content: center;
}

.guard-text {
  font-size: $fs-sm;
  color: var(--muted);
}

.form {
  background: var(--surface);
  padding: 0 15px;
}

.field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-3;
  height: 52px;
}

.field-hover {
  opacity: 0.7;
}

.field-label {
  font-size: $fs-sm;
  color: var(--muted);
  flex: none;
}

.field-value {
  flex: 1;
  min-width: 0;
  font-size: $fs-base;
  font-weight: 600;
  color: var(--ink);
  @include ellipsis;

  &.is-empty {
    color: var(--muted);
    font-weight: 400;
  }
}

.divider {
  height: 1px;
  background: var(--line);
  transform: scaleY(0.5);
  transform-origin: 0 50%;
}

.title-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-3;
  height: 54px;
}

.title-input {
  flex: 1;
  min-width: 0;
  font-size: $fs-lg;
  font-weight: 600;
  color: var(--ink);
}

.input-placeholder {
  color: var(--muted);
  font-weight: 400;
}

.body-input {
  width: 100%;
  min-height: 220px;
  padding: $sp-3 0;
  font-size: $fs-base;
  line-height: 1.7;
  color: var(--ink);
  background: transparent;
}

.tools {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
  padding: $sp-2 0 $sp-3;
  border-top: 1px solid var(--line);
}

.tool {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 $sp-3;
  border-radius: $r-full;
  background: var(--surface-2);

  &.is-busy {
    opacity: 0.6;
  }
}

.tool-hover {
  opacity: 0.75;
}

.tool-text {
  font-size: $fs-sm;
  color: var(--ink-2);
}

.counter {
  font-size: $fs-xs;
  color: var(--muted);
  font-family: $font-mono;
  flex: none;

  &.is-over {
    color: var(--danger);
  }
}

.hint {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 12px 15px 0;
}

.hint-text {
  font-size: $fs-xs;
  color: var(--muted);
}

.submit-wrap {
  padding: $sp-6 15px 0;
}

.btn-text {
  font-size: $fs-md;
  font-weight: 600;
  color: var(--accent-ink);
}
</style>
