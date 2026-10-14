import { get } from '@/core/http'
import type { Account } from '@/core/types'

/**
 * 别人的公开资料。服务端只回网页端本来就公开展示的那几项
 * （昵称、头像、用户组、积分、注册时间），没有签名和邮箱。
 */
export async function fetchUser(id: number): Promise<Account> {
  const data = await get<{ user: Account }>('/users/' + id)
  return data.user
}
