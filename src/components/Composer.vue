<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { chooseImage } from '@/core/platform'
import { uploadFile } from '@/api/upload'
import { charCount } from '@/core/format'
import { toastError, withLoading } from '@/core/ui'

/**
 * 回复输入面板。
 *
 * 正文是 Markdown，所以图片插进去是 ![](url) 而不是 HTML 片段，
 * 和网页端编辑器产出的东西一致。
 *
 * 光标位置在小程序里拿不到，所以插入一律追加到末尾 —— 与其猜错位置，
 * 不如行为可预期。
 */
const props = withDefaults(
  defineProps<{
    visible: boolean
    placeholder?: string
    max?: number
    min?: number
    sending?: boolean
    uploadEnabled?: boolean
    maxMb?: number
  }>(),
  {
    placeholder: '写下你的回复…',
    max: 5000,
    min: 1,
    sending: false,
    uploadEnabled: false,
    maxMb: 0,
  },
)

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'submit', body: string): void
}>()

const draft = ref('')
const uploading = ref(false)

const count = computed(() => charCount(draft.value))
const overLimit = computed(() => count.value > props.max)
const tooShort = computed(() => count.value < props.min)
const canSend = computed(() => !props.sending && !uploading.value && !overLimit.value && !tooShort.value)

watch(
  () => props.visible,
  (open) => {
    if (!open) draft.value = ''
  },
)

function close(): void {
  if (props.sending) return
  emit('update:visible', false)
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
    draft.value = draft.value + (draft.value && !draft.value.endsWith('\n') ? '\n' : '') + '![](' + result.url + ')\n'
  } catch (error) {
    toastError(error, '上传失败')
  } finally {
    uploading.value = false
  }
}

function send(): void {
  if (!canSend.value) return
  emit('submit', draft.value.trim())
}
</script>

<template>
  <view v-if="visible" class="composer-layer">
    <view class="composer-mask" @click="close" />
    <view class="composer">
      <view class="composer-head">
        <text class="composer-title">写回复</text>
        <view class="composer-close" hover-class="composer-close-hover" @click="close">
          <AppIcon name="close" :size="17" color="muted" :weight="1.9" />
        </view>
      </view>

      <textarea
        v-model="draft"
        class="composer-input"
        :placeholder="placeholder"
        placeholder-class="composer-placeholder"
        :maxlength="max + 200"
        auto-height
        :focus="visible"
        :show-confirm-bar="false"
        :cursor-spacing="16"
        :disable-default-padding="true"
      />

      <view class="composer-tools">
        <view
          v-if="uploadEnabled"
          class="tool"
          :class="{ 'is-busy': uploading }"
          hover-class="tool-hover"
          @click="pickImage"
        >
          <AppIcon :name="uploading ? 'refresh' : 'image'" :size="19" color="ink2" :weight="1.7" />
          <text v-if="maxMb > 0" class="tool-hint">图片 ≤ {{ maxMb }}MB</text>
        </view>

        <view class="grow" />

        <text class="counter" :class="{ 'is-over': overLimit }">{{ count }}/{{ max }}</text>
        <view class="btn btn-primary send" :class="{ 'is-disabled': !canSend }" @click="send">
          <text class="send-text">{{ sending ? '发送中' : '发送' }}</text>
        </view>
      </view>
    </view>
    <view class="composer-safe" />
  </view>
</template>

<style lang="scss" scoped>
.composer-layer {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 200;
}

.composer-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(6, 10, 14, 0.42);
}

.composer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--surface);
  border-radius: $r-lg $r-lg 0 0;
  padding: $sp-3 $sp-4 0;
  animation: composer-up 0.2s ease both;
}

@keyframes composer-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

.composer-safe {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: constant(safe-area-inset-bottom);
  height: env(safe-area-inset-bottom);
  background: var(--surface);
  pointer-events: none;
}

.composer-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-bottom: $sp-2;
}

.composer-title {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--muted);
}

.composer-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-full;
}

.composer-close-hover {
  background: var(--surface-2);
}

.composer-input {
  width: 100%;
  min-height: 96px;
  max-height: 220px;
  font-size: $fs-base;
  line-height: 1.65;
  color: var(--ink);
  background: transparent;
}

.composer-placeholder {
  color: var(--muted);
}

.composer-tools {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-2;
  padding: $sp-2 0 $sp-3;
  border-top: 1px solid var(--line);
  margin-top: $sp-2;
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

.tool-hint {
  font-size: $fs-xs;
  color: var(--muted);
}

.counter {
  font-size: $fs-xs;
  color: var(--muted);
  font-family: $font-mono;

  &.is-over {
    color: var(--danger);
  }
}

.send {
  height: 34px;
  padding: 0 $sp-4;
  border-radius: $r-full;
}

.send-text {
  font-size: $fs-sm;
  font-weight: 600;
  color: var(--accent-ink);
}
</style>
