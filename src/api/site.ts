import { get } from '@/core/http'
import type { Forum, SiteConfig } from '@/core/types'

export async function fetchConfig(): Promise<SiteConfig> {
  return get<SiteConfig>('/config', undefined, { auth: false })
}

export async function fetchForums(): Promise<Forum[]> {
  const data = await get<{ forums: Forum[] }>('/forums')
  return data.forums || []
}
