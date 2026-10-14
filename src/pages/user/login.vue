<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import NavBar from '@/components/NavBar.vue'
import { register, wechatBind, wechatLogin } from '@/api/auth'
import { usePageChrome } from '@/composables/usePageChrome'
import { ApiError, ErrCode } from '@/core/errors'
import { routes } from '@/core/navigate'
import { isWeixinMiniProgram, wechatLogin as requestWechatCode } from '@/core/platform'
import { toast, toastError } from '@/core/ui'
import { useSessionStore } from '@/stores/session'
import { useSiteStore } from '@/stores/site'
import type { BindTicket } from '@/core/types'

/**
 * 登录 / 注册 / 微信绑定三合一。
 *
 * 微信授权回来但没绑过账号时，服务端返回 40104 并带上 bind_ticket，
 * 页面切到绑定表单；票根十分钟有效，中途输错密码不会被作废（服务端只在绑定成功后才消费）。
 */

type Mode = 'login' | 'register' | 'bind'

const { ui, scrolled, onScroll, contentTop } = usePageChrome()
const session = useSessionStore()
const site = useSiteStore()

const mode = ref<Mode>('login')
const username = ref('')
const password = ref('')
const confirm = ref('')
const email = ref('')
const redirect = ref('')
const busy = ref(false)
const bindTicket = ref('')

const allowRegister = computed(() => !!site.config?.allow_register)
const wechatAvailable = computed(() => isWeixinMiniProgram() && !!site.config?.login.wechat)
const wechatAutoRegister = computed(() => !!site.config?.login.wechat_auto_register)

const title = computed(() => {
  if (mode.value === 'register') return '注册账号'
  if (mode.value === 'bind') return '绑定已有账号'
  return '登录'
})

const primaryText = computed(() => {
  if (busy.value) return '请稍候…'
  if (mode.value === 'register') return '注册并登录'
  if (mode.value === 'bind') return '绑定并登录'
  return '登录'
})

/** 客户端只挡明显填漏的，长度和字符合法性由服务端判 —— 两边规则不同步会互相打架。 */
const canSubmit = computed(() => {
  if (busy.value) return false
  if (username.value.trim() === '' || password.value === '') return false
  if (mode.value === 'register' && email.value.trim() === '') return false
  if (mode.value === 'register' && confirm.value === '') return false
  return true
})

onLoad(async (options: Record<string, string> | undefined) => {
  await site.ensureConfig()
  const query = options || {}
  if (query.redirect) redirect.value = query.redirect
  if (query.mode === 'register' && allowRegister.value) mode.value = 'register'
})

onPageScroll(onScroll)

function switchMode(next: Mode): void {
  if (busy.value) return
  mode.value = next
  confirm.value = ''
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    toast('请把信息填写完整')
    return
  }
  if (mode.value === 'register' && password.value !== confirm.value) {
    toast('两次输入的密码不一致')
    return
  }
  busy.value = true
  try {
    if (mode.value === 'register') {
      await register({
        username: username.value.trim(),
        email: email.value.trim(),
        password: password.value,
        password_confirm: confirm.value,
      })
    } else if (mode.value === 'bind') {
      await wechatBind({
        bind_ticket: bindTicket.value,
        username: username.value.trim(),
        password: password.value,
      })
    } else {
      await session.login(username.value.trim(), password.value)
    }
    finish()
  } catch (error) {
    toastError(error, '操作失败')
  } finally {
    busy.value = false
  }
}

/** 密码框的回车只在登录模式下直接提交；注册模式下面还有一个确认框。 */
function onPasswordConfirm(): void {
  if (mode.value === 'login') void submit()
}

async function onWechat(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const code = await requestWechatCode()
    await wechatLogin(code)
    finish()
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrCode.NEED_BIND) {
      const ticket = (error.data || {}) as BindTicket
      bindTicket.value = String(ticket.bind_ticket || '')
      if (!bindTicket.value) {
        toast('微信授权信息已失效，请重新授权')
        return
      }
      mode.value = 'bind'
      confirm.value = ''
      password.value = ''
      return
    }
    toastError(error, '微信登录失败')
  } finally {
    busy.value = false
  }
}

function finish(): void {
  toast('登录成功')
  const target = redirect.value
  if (target && target.startsWith('/pages/')) {
    setTimeout(() => uni.redirectTo({ url: target }), 260)
    return
  }
  setTimeout(() => {
    const pages = getCurrentPages()
    if (pages.length > 1) uni.navigateBack()
    else uni.reLaunch({ url: routes.home })
  }, 260)
}
</script>

<template>
  <view class="page-shell" :class="ui.themeClass">
    <NavBar :scrolled="scrolled" :title="title" />

    <view class="body" :style="{ paddingTop: contentTop() }">
      <view class="brand">
        <view class="brand-mark">
          <text class="brand-letter">{{ (site.siteName || '论').slice(0, 1) }}</text>
        </view>
        <text class="brand-name">{{ site.siteName }}</text>
        <text class="brand-sub">
          {{ mode === 'bind' ? '这个微信号还没绑定账号，用已有账号登录一次即可完成绑定' : '登录后即可发帖、回复和收到提醒' }}
        </text>
      </view>

      <view class="form">
        <view class="field">
          <AppIcon name="user" :size="18" color="muted" :weight="1.7" />
          <input
            v-model="username"
            class="input"
            type="text"
            placeholder="用户名"
            placeholder-class="input-placeholder"
            :disabled="busy"
            :confirm-type="'next'"
          />
        </view>

        <view v-if="mode === 'register'" class="field">
          <AppIcon name="mail" :size="18" color="muted" :weight="1.7" />
          <input
            v-model="email"
            class="input"
            type="text"
            placeholder="邮箱"
            placeholder-class="input-placeholder"
            :disabled="busy"
            :confirm-type="'next'"
          />
        </view>

        <view class="field">
          <AppIcon name="lock" :size="18" color="muted" :weight="1.7" />
          <input
            v-model="password"
            class="input"
            password
            placeholder="密码"
            placeholder-class="input-placeholder"
            :disabled="busy"
            :confirm-type="mode === 'login' ? 'done' : 'next'"
            @confirm="onPasswordConfirm"
          />
        </view>

        <view v-if="mode !== 'login'" class="field">
          <AppIcon name="lock" :size="18" color="muted" :weight="1.7" />
          <input
            v-model="confirm"
            class="input"
            password
            placeholder="确认密码"
            placeholder-class="input-placeholder"
            :disabled="busy"
            confirm-type="done"
            @confirm="submit"
          />
        </view>
      </view>

      <view class="actions">
        <view class="btn btn-primary" :class="{ 'is-disabled': !canSubmit }" @click="submit">
          <text class="btn-text">{{ primaryText }}</text>
        </view>

        <view v-if="wechatAvailable && mode !== 'bind'" class="wechat" hover-class="wechat-hover" @click="onWechat">
          <AppIcon name="wechat" :size="20" color="accent" :weight="1.6" />
          <text class="wechat-text">微信一键登录</text>
        </view>

        <view v-if="mode === 'login' && allowRegister" class="switch" @click="switchMode('register')">
          <text class="switch-text">还没有账号？<text class="switch-link">注册一个</text></text>
        </view>

        <view v-if="mode !== 'login'" class="switch" @click="switchMode('login')">
          <text class="switch-text">已经有账号了？<text class="switch-link">去登录</text></text>
        </view>
      </view>

      <view v-if="mode === 'bind' && !wechatAutoRegister" class="tip">
        <AppIcon name="info" :size="14" color="muted" :weight="1.7" />
        <text class="tip-text">绑定后，用微信或账号密码都能登进同一个账号</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.body {
  flex: 1;
  padding-bottom: 40px;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  // 真正的顶部间距由 contentTop() 给，这里只留品牌块内部的气口
  padding: 22px $sp-6 26px;
}

.brand-mark {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(14, 124, 134, 0.24);
  margin-bottom: 14px;
}

.brand-letter {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent-ink);
  line-height: 1;
}

.brand-name {
  font-size: $fs-2xl;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.02em;
}

.brand-sub {
  margin-top: 6px;
  font-size: $fs-sm;
  color: var(--muted);
  text-align: center;
  line-height: 1.55;
  max-width: 300px;
}

.form {
  background: var(--surface);
  border-radius: $r-lg;
  margin: 0 15px;
  padding: 0 15px;
  box-shadow: var(--shadow-card);
}

.field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $sp-3;
  height: 56px;
  position: relative;

  & + .field::before {
    content: '';
    position: absolute;
    left: 30px;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--line);
    transform: scaleY(0.5);
  }
}

.input {
  flex: 1;
  min-width: 0;
  height: 56px;
  font-size: $fs-base;
  color: var(--ink);
}

.input-placeholder {
  color: var(--muted);
}

.actions {
  padding: $sp-5 15px 0;
  display: flex;
  flex-direction: column;
  gap: $sp-3;
}

.btn-text {
  font-size: $fs-md;
  font-weight: 600;
  color: var(--accent-ink);
}

.wechat {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: $sp-2;
  height: 46px;
  border-radius: $r-md;
  background: var(--surface);
  border: 1px solid var(--line);
}

.wechat-hover {
  background: var(--surface-2);
}

.wechat-text {
  font-size: $fs-md;
  font-weight: 600;
  color: var(--ink);
}

.switch {
  display: flex;
  justify-content: center;
  padding: $sp-2 0;
}

.switch-text {
  font-size: $fs-sm;
  color: var(--muted);
}

.switch-link {
  color: var(--accent);
  font-weight: 600;
}

.tip {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
  padding: $sp-4 20px 0;
}

.tip-text {
  flex: 1;
  font-size: $fs-xs;
  color: var(--muted);
  line-height: 1.6;
}
</style>
