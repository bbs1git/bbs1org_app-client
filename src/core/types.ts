/** 与服务端 app/plugins/app_api/plugin.php 的序列化结果一一对应。 */

export interface Author {
  id: number
  username: string
  avatar_url: string
}

export interface ForumRef {
  id: number
  name: string
}

export interface Forum extends ForumRef {
  description: string
  can_view: boolean
  can_post: boolean
  can_reply: boolean
  url: string
}

export interface Topic {
  id: number
  title: string
  /** 只有列表请求带 excerpt=1 时才有内容 */
  excerpt: string
  /** 搜索命中回复时才有：命中的那层回复的片段（见 app_api_endpoint_search） */
  matched_reply_excerpt?: string
  forum: ForumRef
  author: Author
  reply_count: number
  view_count: number
  is_pinned: boolean
  highlight_style: string
  created_at: string
  last_reply_at: string
  url: string
}

export interface TopicDetail extends Topic {
  body: string
  body_html: string
}

export interface Reply {
  id: number
  /** 楼层号，由服务端按时间顺序算出 */
  floor: number
  author: Author
  body: string
  body_html: string
  created_at: string
  updated_at: string
  url: string
}

export interface NotificationItem {
  id: number
  kind: string
  content: string
  topic_id: number
  reply_id: number
  is_read: boolean
  created_at: string
  sender: Author | null
}

export interface SiteConfig {
  api_version: string
  site_name: string
  site_url: string
  allow_register: boolean
  announcement: string
  login: { wechat: boolean; wechat_auto_register: boolean }
  upload: { enabled: boolean; max_mb: number }
  update: { min_app_version: string; url: string }
  limits: {
    topics_per_page: number
    replies_per_page: number
    title_max_length: number
    title_min_length: number
    topic_body_max_length: number
    topic_body_min_length: number
    reply_body_max_length: number
    reply_body_min_length: number
    /** 搜索的最短字数，由后台设定。用来提前禁用搜索按钮，别等提交了才报错 */
    search_min_chars: number
    post_interval_seconds: number
  }
}

export interface Account {
  id: number
  username: string
  avatar_url: string
  group: { id: number; name: string }
  points: number
  created_at: string
  url: string
  bio?: string
  email?: string
  unread_notifications?: number
  is_muted?: number
  permissions?: { can_speak: boolean; can_manage: boolean; can_admin: boolean }
}

/** 列表接口统一的分页返回。next_cursor 为空串或 null 都表示到底了。 */
export interface Paged<T, K extends string> {
  next_cursor: string | null
  has_more: boolean
}

export type TopicPage = Paged<Topic, 'topics'> & { topics: Topic[] }
export type ReplyPage = Paged<Reply, 'replies'> & { replies: Reply[] }

export interface TopicDetailPayload {
  topic: TopicDetail
  replies: Reply[]
  reply_order: 'asc' | 'desc'
  next_cursor: string | null
  has_more: boolean
}

export interface NotificationPage {
  items: NotificationItem[]
  unread: number
  next_cursor: string
}

export interface LoginPayload {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  refresh_expires_in: number
  user: Account
}

/** 微信号还没绑定账号时服务端返回的 40104 载荷。 */
export interface BindTicket {
  bind_ticket: string
  expires_in: number
}

export type TopicSort = 'comment' | 'post'
