<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPageScroll } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import NavBar from '@/components/NavBar.vue'
import { fetchConfig } from '@/api/site'
import { usePageChrome } from '@/composables/usePageChrome'
import { APP_VERSION, baseUrl, defaultBaseUrl, setBaseUrl } from '@/core/config'
import { routes } from '@/core/navigate'
import { platformName } from '@/core/platform'
import { confirm, toast, toastError, withLoading } from '@/core/ui'
import type { ThemeMode } from '@/core/theme'
import { useFeedStore } from '@/stores/feed'
import { useNotificationStore } from '@/stores/notifications'
import { useSessionStore } from '@/stores/session'
import { useSiteStore } from '@/stores/site'
import { useUiStore } from '@/stores/ui'

/**
 * 设置。
 *
 * 站点地址可以改：自建站、内网调试、或者站点换域名都用得上。
 * 改完之后必须清掉所有缓存并重启到首页 —— 列表、配置、会话都是按旧域名拉的，
 * 留着只会显示上一个站点的内容。
 */

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const site = useSiteStore()
const feed = useFeedStore()
const notifications = useNotificationStore()
const session = useSessionStore()

/**
 * 输入框里的草稿，以及**已经生效**的地址。两个分开存是因为 baseUrl() 是个普通函数
 * （模块级缓存，不是响应式），拿它做 computed 的依赖不会跟着变 —— 应用完地址依赖不刷新，
 * 「应用」按钮和「恢复默认」那一行就会停在旧状态上。
 */
const hostDraft = ref(baseUrl())
const applied = ref(baseUrl())
const checking = ref(false)

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
]

const hostChanged = computed(() => hostDraft.value.trim().replace(/\/+$/, '') !== applied.value)

/** 兜底地址。当前不是它的时候才露出「恢复默认」——点了也是原地打转就没必要占一行。 */
const defaultHost = computed(() => defaultBaseUrl())
const canRestore = computed(() => applied.value !== defaultHost.value)

/**
 * 上传上限只在登录后才由服务端给出 —— 未登录时 max_mb 是 0（故意的，不向游客透露）。
 * 直接拼出来会显示成「≤0MB」，像坏了，所以拿不到具体数字就只说开没开。
 */
const uploadText = computed(() => {
  const upload = site.config?.upload
  if (!upload || !upload.enabled) return '未开启'
  return upload.max_mb > 0 ? `已开启（≤${upload.max_mb}MB）` : '已开启'
})

onPageScroll(onScroll)

function pickTheme(mode: ThemeMode): void {
  ui.setMode(mode)
}

async function checkConnection(): Promise<void> {
  if (checking.value) return
  checking.value = true
  try {
    const config = await withLoading(() => fetchConfig(), '连接中')
    toast('连接正常：' + (config.site_name || '站点'))
  } catch (error) {
    toastError(error, '连接失败')
  } finally {
    checking.value = false
  }
}

/**
 * 换站点之后的善后。地址已经写进本地存储，剩下的都是清场：列表、配置、会话
 * 全是按旧地址拉的，留着只会显示上一个站点的内容，所以一并丢掉并重启到首页。
 */
function switchTo(next: string): void {
  setBaseUrl(next)
  applied.value = baseUrl()
  hostDraft.value = applied.value
  site.reset()
  feed.reset()
  notifications.reset()
  session.setUser(null)
  setTimeout(() => uni.reLaunch({ url: routes.home }), 400)
}

async function applyHost(): Promise<void> {
  const next = hostDraft.value.trim()
  if (!/^https?:\/\//i.test(next)) {
    toast('地址要以 http:// 或 https:// 开头')
    return
  }
  if (!(await confirm('切换站点后需要重新登录，确定吗？', '切换站点'))) return

  switchTo(next)
  toast('已切换站点')
}

/**
 * 回到兜底地址。地址填错了这是唯一的出路 —— 输入框清空会被当成格式错误拒绝，
 * 而存下来的地址又盖着编译期注入的那个，所以只能从这儿回去。
 */
async function restoreHost(): Promise<void> {
  const target = defaultHost.value
  if (target === applied.value) return
  if (!(await confirm(`把站点地址改回 ${target}？切换站点后需要重新登录。`, '恢复默认'))) return

  switchTo(target)
  toast('已恢复默认地址')
}

async function clearCache(): Promise<void> {
  if (!(await confirm('会清掉本地的列表缓存和搜索历史，不影响登录状态。', '清除缓存'))) return
  feed.reset()
  try {
    uni.removeStorageSync('searchHistory')
    uni.removeStorageSync('announcementClosed')
  } catch {
    // 清不掉也不影响使用
  }
  toast('缓存已清除')
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" title="设置" />

    <view class="body" :style="{ paddingTop: contentTop() }">
      <view class="group-title">外观</view>
      <view class="card">
        <view class="theme">
          <view
            v-for="item in THEMES"
            :key="item.key"
            class="theme-item"
            :class="{ 'is-active': ui.mode === item.key }"
            @click="pickTheme(item.key)"
          >
            <AppIcon
              :name="item.key === 'system' ? 'settings' : item.key === 'light' ? 'eye' : 'flame'"
              :size="17"
              :color="ui.mode === item.key ? 'accent' : 'muted'"
              :weight="1.75"
            />
            <text class="theme-text">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="group-title">站点</view>
      <view class="card">
        <view class="row">
          <AppIcon name="link" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">站点地址</text>
          <input
            v-model="hostDraft"
            class="row-input"
            type="text"
            placeholder="https://example.com"
            placeholder-class="input-placeholder"
            :confirm-type="'done'"
            @confirm="applyHost"
          />
          <view v-if="hostChanged" class="row-action" hover-class="row-action-hover" @click="applyHost">
            <text class="row-action-text">应用</text>
          </view>
        </view>

        <view v-if="canRestore" class="row" hover-class="row-hover" @click="restoreHost">
          <AppIcon name="refresh" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">恢复默认</text>
          <view class="grow" />
          <text class="row-value">{{ defaultHost }}</text>
          <AppIcon name="chevron-right" :size="15" color="muted" :weight="1.8" />
        </view>

        <view class="row" hover-class="row-hover" @click="checkConnection">
          <AppIcon name="wifi" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">测试连接</text>
          <view class="grow" />
          <text class="row-value">{{ checking ? '连接中…' : '点击检测' }}</text>
          <AppIcon name="chevron-right" :size="15" color="muted" :weight="1.8" />
        </view>
      </view>

      <view class="group-title">本站</view>
      <view class="card">
        <view class="row">
          <AppIcon name="info" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">站点名称</text>
          <view class="grow" />
          <text class="row-value">{{ site.siteName }}</text>
        </view>
        <view class="row">
          <AppIcon name="tag" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">接口版本</text>
          <view class="grow" />
          <text class="row-value mono">{{ site.config?.api_version || '—' }}</text>
        </view>
        <view class="row">
          <AppIcon name="alert" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">注册</text>
          <view class="grow" />
          <text class="row-value">{{ site.config?.allow_register ? '开放' : '已关闭' }}</text>
        </view>
        <view class="row">
          <AppIcon name="upload" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">附件上传</text>
          <view class="grow" />
          <text class="row-value">{{ uploadText }}</text>
        </view>
      </view>

      <view class="group-title">本地</view>
      <view class="card">
        <view class="row" hover-class="row-hover" @click="clearCache">
          <AppIcon name="trash" :size="19" color="ink2" :weight="1.75" />
          <text class="row-label">清除缓存</text>
          <view class="grow" />
          <AppIcon name="chevron-right" :size="15" color="muted" :weight="1.8" />
        </view>
      </view>

      <view class="foot">
        <text class="foot-text">客户端 v{{ APP_VERSION }} · {{ platformName() }}</text>
        <text class="foot-text">接口地址 {{ baseUrl() }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding: 0 15px 40px;
}

.group-title {
  font-size: $fs-xs;
  color: var(--muted);
  padding: 18px 4px 8px;
  letter-spacing: 0.02em;
}

.card {
  border-radius: $r-lg;
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.theme {
  display: flex;
  flex-direction: row;
  padding: 6px;
  gap: 4px;
}

.theme-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 62px;
  border-radius: $r-md;
  border: 1px solid transparent;
}

.theme-item.is-active {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.theme-text {
  font-size: $fs-xs;
  color: var(--ink-2);
}

.theme-item.is-active .theme-text {
  color: var(--accent);
  font-weight: 600;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 11px;
  min-height: 50px;
  padding: 0 15px;
  position: relative;

  & + .row::before {
    content: '';
    position: absolute;
    left: 45px;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
  }
}

.row-hover {
  background: var(--surface-2);
}

.row-label {
  font-size: $fs-base;
  color: var(--ink);
  flex: none;
}

.row-value {
  font-size: $fs-sm;
  color: var(--muted);
  max-width: 180px;
  @include ellipsis;
}

.row-input {
  flex: 1;
  min-width: 0;
  height: 50px;
  font-size: $fs-sm;
  color: var(--ink-2);
  text-align: right;
}

.input-placeholder {
  color: var(--muted);
}

.row-action {
  flex: none;
  height: 28px;
  padding: 0 12px;
  border-radius: $r-full;
  background: var(--accent);
  display: flex;
  align-items: center;
}

.row-action-hover {
  opacity: 0.8;
}

.row-action-text {
  font-size: $fs-xs;
  font-weight: 600;
  color: var(--accent-ink);
}

.foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 30px 0 10px;
}

.foot-text {
  font-size: $fs-xs;
  color: var(--muted);
}
</style>
