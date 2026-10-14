import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * 页面外壳的公共部分：自定义导航栏要的状态栏高度、滚动状态，
 * 以及固定头部占位的高度计算。
 *
 * 页面自己接 onPageScroll 把事件喂进 onScroll：
 *   const { ui, scrolled, onScroll, contentTop } = usePageChrome()
 *   onPageScroll(onScroll)
 *
 * 内容区一律用 contentTop()，别用 headerHeight() —— 后者是纯几何量（浮层定位要它），
 * 两者差一个统一呼吸间距，混用会让某些页面贴上头部、某些页面又空一大块。
 */

/** 固定头部与内容之间的统一间距。所有页面都从这里取，改一处全站生效。 */
export const CONTENT_GAP = 12

export function usePageChrome() {
  const ui = useUiStore()
  const scrolled = ref(false)

  function onScroll(event: { scrollTop: number }): void {
    const next = event.scrollTop > 4
    // 每帧都赋值会让导航栏的 transition 反复重排
    if (scrolled.value !== next) scrolled.value = next
  }

  /** 固定头部的底边位置，不含呼吸间距。浮层要贴着头部展开时用它。 */
  function headerHeight(extra = 0): string {
    return ui.navHeight + extra + 'px'
  }

  /** 内容区该留的上边距 = 头部高度 + 呼吸间距。 */
  function contentTop(extra = 0): string {
    return ui.navHeight + extra + CONTENT_GAP + 'px'
  }

  /** 复位到顶部。切回主页面时用，duration 0 让它是瞬时的，不要动画。 */
  function scrollTo(top: number): void {
    uni.pageScrollTo({ scrollTop: top, duration: 0 })
  }

  return { ui, scrolled, onScroll, headerHeight, contentTop, scrollTo }
}
