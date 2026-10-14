import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { onThemeChange, resolvedTheme, setThemeMode, syncSystemTheme, themeMode } from '@/core/theme'
import type { ResolvedTheme, ThemeMode } from '@/core/theme'

/**
 * 界面外壳的状态：主题、状态栏与导航栏尺寸。
 *
 * 用了自定义导航栏，所以状态栏高度、微信胶囊按钮的位置都得自己算，
 * 否则标题会被刘海挡住，或者被右上角的胶囊压住。
 */

/** 导航栏内容区高度。和微信胶囊对齐是标准做法，其他端给一个 iOS 惯用的 44。 */
function navContentHeight(statusBarHeight: number): number {
  // #ifdef MP-WEIXIN
  try {
    const capsule = uni.getMenuButtonBoundingClientRect()
    if (capsule && capsule.height > 0) {
      const gap = capsule.top - statusBarHeight
      if (gap > 0) return gap * 2 + capsule.height
    }
  } catch {
    // 拿不到就退回默认值
  }
  // #endif
  return 44
}

/** 右上角胶囊的宽度，导航栏右侧要留出这么宽的空，否则按钮会被盖住。 */
function capsuleReserve(): number {
  // #ifdef MP-WEIXIN
  try {
    const capsule = uni.getMenuButtonBoundingClientRect()
    if (capsule && capsule.width > 0) {
      const sys = uni.getSystemInfoSync()
      const gap = Math.max(0, (sys.windowWidth || 375) - capsule.right)
      return capsule.width + gap * 2
    }
  } catch {
    // 同上
  }
  // #endif
  return 0
}

export const useUiStore = defineStore('ui', () => {
  const system = uni.getSystemInfoSync()
  const statusBarHeight = ref(Number(system.statusBarHeight) || 0)
  const navContent = ref(navContentHeight(statusBarHeight.value))
  const navHeight = computed(() => statusBarHeight.value + navContent.value)
  const capsuleWidth = ref(capsuleReserve())
  /** 可用视口高度。下拉面板这类「最多占多少」的高度要按它算，不能写死 px。 */
  const windowHeight = ref(Number(system.windowHeight) || 0)

  const mode = ref<ThemeMode>(themeMode())
  const theme = ref<ResolvedTheme>(resolvedTheme())
  const themeClass = computed(() => (theme.value === 'dark' ? 'theme-dark' : 'theme-light'))

  // core/theme 是模块级订阅，跟着整个应用的生命周期走，不需要在这里退订。
  onThemeChange((next) => {
    theme.value = next
  })

  function setMode(next: ThemeMode): void {
    setThemeMode(next)
    mode.value = next
    theme.value = resolvedTheme()
  }

  /** 从后台回到前台时调用：系统主题可能已经变了。 */
  function resync(): void {
    syncSystemTheme()
    mode.value = themeMode()
    theme.value = resolvedTheme()
  }

  return {
    statusBarHeight,
    navContent,
    navHeight,
    capsuleWidth,
    windowHeight,
    mode,
    theme,
    themeClass,
    isDark: computed(() => theme.value === 'dark'),
    setMode,
    resync,
  }
})
