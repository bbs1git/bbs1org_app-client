import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchConfig, fetchForums } from '@/api/site'
import type { Forum, SiteConfig } from '@/core/types'

/** 站点配置与版块表。一次会话内基本不变，缓存住即可，别每个页面都拉一遍。 */
export const useSiteStore = defineStore('site', () => {
  const config = ref<SiteConfig | null>(null)
  const forums = ref<Forum[]>([])
  const configLoading = ref(false)
  const forumsLoading = ref(false)

  const siteName = computed(() => config.value?.site_name || '论坛')
  const announcement = computed(() => config.value?.announcement || '')
  const editableForums = computed(() => forums.value.filter((f) => f.can_post))

  async function ensureConfig(force = false): Promise<SiteConfig | null> {
    if (config.value && !force) return config.value
    if (configLoading.value) return config.value
    configLoading.value = true
    try {
      config.value = await fetchConfig()
      return config.value
    } catch {
      // 配置拿不到不该拦路，页面用默认值继续渲染
      return config.value
    } finally {
      configLoading.value = false
    }
  }

  async function ensureForums(force = false): Promise<Forum[]> {
    if (forums.value.length && !force) return forums.value
    if (forumsLoading.value) return forums.value
    forumsLoading.value = true
    try {
      forums.value = await fetchForums()
      return forums.value
    } catch {
      return forums.value
    } finally {
      forumsLoading.value = false
    }
  }

  function forumName(id: number): string {
    const found = forums.value.find((f) => f.id === id)
    return found ? found.name : ''
  }

  function reset(): void {
    config.value = null
    forums.value = []
  }

  return {
    config,
    forums,
    configLoading,
    forumsLoading,
    siteName,
    announcement,
    editableForums,
    ensureConfig,
    ensureForums,
    forumName,
    reset,
  }
})
