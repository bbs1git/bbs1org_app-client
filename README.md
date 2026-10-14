# bbs1 客户端

一套 Vue 3 + uni-app 代码，编译出**网页 / 微信小程序 / 安卓 / iOS** 四个端。
后端是站点的 `app_api` 插件（`app/plugins/app_api/`），纯 JSON 接口 + Bearer 令牌，
和网页端共用同一个数据库、同一套权限判定。

```
npm install
npm run dev:h5           # 浏览器里调试，改完即时刷新
npm run dev:mp-weixin    # 产物在 dist/dev/mp-weixin，用微信开发者工具导入
npm run build:h5         # 产物在 dist/build/h5
npm run build:mp-weixin
npm run build:app        # 产物用 HBuilderX 导入后云打包
npm run type-check       # vue-tsc --noEmit
```

装依赖时注意：`@dcloudio/*` 全部锁在 `3.0.0-5020420260813003`。
npm 上的 `latest` 标签指向的是 **Vue 2** 那条线，混进来会和 `vue@3` 打架。

---

## 在浏览器里跑

客户端默认连 `https://bbs1.org`。那边**没有装 `app_api`**，所以直接 `npm run dev:h5`
打开只会看到「没能连上服务器」。本地要看到真数据，得把地址指到本机的后端：

```bash
# 1. 起后端（在仓库根目录，别用 localhost 当 Host）
php -S 127.0.0.1:8099 index.php

# 2. 起前端，编译期把站点地址指过去
cd app-client
VITE_API_BASE_URL=http://127.0.0.1:8099 npm run dev:h5

# 3. 浏览器打开
open http://localhost:5173/
```

三个地址来源，优先级从高到低：**运行时设置**（「我的 → 站点设置」，存在本地存储里）
> **`VITE_API_BASE_URL`**（只影响这次编译，正式包不会带上）> `src/core/config.ts` 的 `DEFAULT_BASE_URL`。

> 如果之前用「站点设置」改过地址，那个值存在浏览器本地存储里，会**盖住** `VITE_API_BASE_URL`。
> 表现是改了环境变量重启还是连旧地址 —— 去设置页点一次「恢复默认」即可
> （当前地址已经等于兜底地址时那一行不显示；输入框清空会被当成格式错误拒绝，
> 所以别指望靠清空回去）。

> 「站点地址」填的是**站点根地址**，不是接口地址。客户端自己会拼 `/api/v1`，
> 填成 `https://bbs1.org/api` 会拼出 `/api/api/v1/...`，全站 404。

H5 跑在 `localhost:5173`、后端在 `127.0.0.1:8099`，这是**跨域**，浏览器会先发预检。
后端插件配置里的 `cors_origins` 必须包含 `http://localhost:5173`，
否则控制台只会报 CORS，接口一个都通不了：

```
# 后台插件管理 → app_api 配置
cors_origins = http://localhost:5173,http://127.0.0.1:5173
```

`127.0.0.1:5173` 和 `localhost:5173` 是两个不同的来源，两个都填上就不用管打开的是哪个。
App 和小程序不受同源策略约束，只有 H5 需要这一项。

---

## 跑起来之前，服务端要先满足几件事

| 事项 | 在哪 |
| --- | --- |
| 启用 `app_api` 插件 | 后台插件管理。改过插件代码或表结构要「停用再启用」，光保存不会重跑安装 |
| 关掉 CORS 限制或加白名单 | 插件配置 `cors_origins`。H5 端跨域时必填；App 和小程序不受同源策略约束 |
| 打开上传 | 插件配置 `upload_enabled`，并启用 `attachment_upload` 插件 |
| 微信登录（可选） | 插件配置里填 `wechat_appid` / `wechat_secret`；小程序还要在公众平台把接口域名配成 request 合法域名 |

客户端默认连 `https://bbs1.org`。改地址有两个入口：

- **运行时**：我的 → 设置 → 站点地址（自建站、内网调试用这个，改完会清缓存并重启到首页）
- **编译期**：`src/core/config.ts` 里的 `DEFAULT_BASE_URL`

改错了回不去的话，设置页「站点 → 恢复默认」回到兜底地址（`core/config.ts` 的
`defaultBaseUrl()`：这次编译若注入了 `VITE_API_BASE_URL` 就是它，否则是 `DEFAULT_BASE_URL`）。

---

## 目录

```
src/
  core/           纯逻辑，不碰界面
    config.ts       站点地址、接口前缀、客户端版本号
    http.ts         请求层：信封归一、401 续期重试、会话失效广播
    tokens.ts       令牌与会话（单飞续期在这里）
    errors.ts       错误码与 ApiError
    storage.ts      本地存储的薄封装
    types.ts        与服务端序列化结果一一对应的类型
    icon.ts         图标：把描边 SVG 拼成 data URI
    theme.ts        主题：跟随系统 / 浅色 / 深色
    palette.ts      调色板的 JS 副本（图标颜色要由 JS 给，CSS 变量进不去 SVG）
    rich.ts         正文 HTML 的客户端加工（补绝对地址、小程序内联样式）
    color.ts        高亮色解析与对比度判断、字母头像底色
    highlight.ts    搜索关键词命中切分（不用正则，用户输入当字面量）
    format.ts       时间与数字的展示
    navigate.ts     路由表与跳转
    platform.ts     平台差异收口
    ui.ts           轻提示、确认框、加载态
    device.ts       上报给服务端的设备信息
  api/            接口函数，一文件一组
  stores/         Pinia：会话、站点、主题流、消息、界面外壳
  components/     NavBar / BottomBar / TopicCard / ForumPicker / Composer / AppIcon …
  composables/    usePageChrome：头部高度、呼吸间距、滚动状态
  pages/          9 个页面
  styles/         global.scss（全局 CSS 输出）
  uni.scss        变量与 mixin，会被注入到每个 <style lang="scss">
```

---

## 几个值得说明的选择

**导航栏是自己画的。** `pages.json` 里所有页面都设了 `navigationStyle: custom`。
好处是三端标题栏长得一样、可以放搜索框和按钮；代价是状态栏高度、微信右上角胶囊的占位
都要自己算（见 `stores/ui.ts`），改导航栏高度别绕开那里。

**底部栏也是自己画的，没用原生 tabBar。** 原生 tabBar 的图标必须是图片文件，
字号间距都改不了，还做不了未读角标。代价是切主页面要用 `reLaunch`（页面实例会被销毁），
所以列表状态、滚动位置都缓存在 Pinia 的 `feed` store 里，切回来是直接渲染缓存，不白屏也不重发请求。

**首页只有导航栏是固定的，版块和排序跟着内容滚。** 版块原来是横向滚动的胶囊条，版块一多就得
左右划着找，还不知道划到头没有，所以换成了下拉（`components/ForumPicker.vue`）：点开是一整列、
当前项打勾、超长按整行封顶滚动。它和右边的排序一起放在内容区第一行，不占固定头部的高度。
代价是滚下去之后要改版块得先滚回顶部。

> 下拉面板用 `position: fixed` 挂在版块行所在的层叠上下文里。别把它挪出去，
> 那样就要和导航栏、底部栏的 z-index 抢高低，一端一变就容易翻车。
> 面板的 `top` 由页面按「导航栏 + 间距 + 行高 − 滚动距离」算好传进去；
> 因为滚动超过 4px 就会把面板收起来，这个减法实际只在几像素的范围内活动。

**头部与内容之间的间距是统一的，别在页面里另写。** `usePageChrome()` 给两个函数：
`contentTop(extra)` 是内容区该留的上边距（头部高度 + `CONTENT_GAP`），页面一律用它；
`headerHeight(extra)` 是头部的纯几何底边，只给浮层定位用。混用会让某些页面贴上头部、
某些页面又空一大块。想调全站的呼吸感，改 `CONTENT_GAP` 一个地方。

**主题由 JS 决定，不完全靠 CSS 媒体查询。** 原因是图标颜色烘焙在 SVG 里，必须由 JS 给；
小程序那边 `prefers-color-scheme` 还要配合 `app.json` 的 darkmode 和 theme.json 才生效，
链路长容易漏配。所以 JS 解出当前是深是浅，在外壳上挂 `.theme-light` / `.theme-dark`。
`global.scss` 里的媒体查询只作为 JS 跑起来之前那一帧的兜底，避免深色系统下白闪。

> 改 `styles/global.scss` 的令牌时注意：小程序那边**不要**把 `:root`、`body`
> 和 `page` 写进同一个选择器列表。WXSS 遇到认不出的简单选择器有可能整条规则作废，
> 整套浅色令牌会一起消失。所以 H5 专用那部分包在 `// #ifdef H5` 里。

**图标是现画的，没有图片资源和图标字体。** `core/icon.ts` 里 39 个 24×24 的描边路径，
运行时拼成 `data:image/svg+xml;base64,…` 交给 `<image>`，颜色在生成时烘焙进去。
换颜色不用重新导出图片，也不占小程序包体。底部栏选中态用同一份几何的填充版。

**正文里的相对地址要在客户端补全。** 内核渲染出的 `<img src="/app/upload/…">` 在
H5 同源时能用，但小程序和 App 的 webview 不在站点域名下会 404。`core/rich.ts` 负责补绝对地址，
另外小程序端还要把段落间距、图片宽度内联到标签上 —— 微信的 `rich-text` 是独立渲染层，
外面的 CSS 选择器进不去。

**续期是单飞的。** 服务端的 refresh 会轮换令牌（旧的立刻作废），并发请求同时触发续期
会互相把对方的令牌打掉。`core/tokens.ts` 里用一个模块级 promise 保证同一时刻只有一次续期在飞。

**搜索页把「为什么这条会被搜出来」说清楚了。** 命中关键词的片段在标题和摘要里标出来
（`core/highlight.ts`，按字面量找，不走正则 —— 用户随手输的 `(` 之类不该把正则搞坏）；
按「回复」搜的时候，服务端本来就会多回一段 `matched_reply_excerpt`，卡片上补一个
「命中回复」小方块显示它，否则只看到一个标题，不知道命中的是哪层楼。
搜索范围的最小字数从站点配置的 `limits.search_min_chars` 取，不够长时按钮是暗的、
点了也只会提示，不再是敲一个字提交然后吃一个红色报错。

---

## 提审和小程序上架前要过的坎

- **接口域名**：微信要求 HTTPS + 已备案，并在公众平台配成 request 合法域名。`urlCheck: false` 只是开发者工具的开关，真机不认。
- **包体**：主包上限 2MB。目前小程序产物约 520KB，还有余量，但也别往里塞图片了。
- **上传**：`uni.uploadFile` 在小程序里只能上传 `chooseImage` / `chooseMedia` 拿到的临时文件路径。
- **隐私协议**：`manifest.json` 里已经填了相册和相机的用途说明（iOS）与相关权限（Android），上架时按平台要求再对一遍。
- **版本号**：`manifest.json` 的 `versionName` 和 `core/config.ts` 的 `APP_VERSION` 要一致。
  站点配了 `min_app_version` 时，低于它的客户端会被接口拒绝（错误码提示客户端升级）。

---

## 本地调试的两个坑

搭环境见上面的「在浏览器里跑」。两个容易绕进去的地方：

**别用 `Host: localhost` 打后端。** 用 PHP 内置服务器时，`Host` 是 `localhost` 的请求会落到
`php -S` 自己身上，返回目录列表而不是页面。用 `127.0.0.1` 或者配好的域名。

**机器上如果设了 `http_proxy`，`curl` 会绕开你的本地服务。** 表现是 curl 一个本地端口，
回来的却是远端站点的响应 —— 因为请求被代理转发走了。加 `--noproxy '*'`：

```bash
curl --noproxy '*' -H "Origin: http://localhost:5173" http://127.0.0.1:8099/api/v1/config
```

顺带一提，本机浏览器如果装了系统级代理，也会以同样的方式影响 H5 调试。
