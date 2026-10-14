<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { onAuthLost, onTip } from '@/core/http'
import { toast } from '@/core/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useSessionStore } from '@/stores/session'
import { useSiteStore } from '@/stores/site'
import { useUiStore } from '@/stores/ui'

/**
 * 应用入口。App.vue 不写视图（小程序端也不会渲染它），只做三件全局的事：
 *   1. 拉起会话：本地有令牌就去核对一遍，顺带刷新权限和未读数
 *   2. 把请求层的两类广播接到界面上
 *   3. 从后台回来时重新对一次系统主题
 * 页面各自负责自己的主题外壳和布局。
 */

const session = useSessionStore()
const site = useSiteStore()
const notifications = useNotificationStore()
const ui = useUiStore()

// 服务端透传的轻提示（比如积分变动）直接弹出来
onTip((message) => {
  toast(message)
})

// 令牌彻底失效：本地清掉，各页面自己的未登录态会接管。
// 不强行跳登录页 —— 用户可能正在读一篇帖子，把他弹走比留在原地更烦人。
onAuthLost(() => {
  session.setUser(null)
  notifications.reset()
  toast('登录已过期，请重新登录')
})

onLaunch(() => {
  void site.ensureConfig()
  void session.restore().then(() => {
    if (session.loggedIn) void notifications.refreshBadge()
  })
})

onShow(() => {
  // 系统深浅色可能已经变了，uni 的主题事件在部分端不补发
  ui.resync()
  if (session.loggedIn) void notifications.refreshBadge()
})
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
