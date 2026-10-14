import { baseUrl } from './config'

/**
 * 帖子正文是内核渲染好的 HTML，这里做两件客户端必须做的事。
 *
 * 1. 补绝对地址。正文里的图片和链接是站内相对路径（`/app/upload/...`），
 *    H5 端可能还同源，但小程序和 App 的 webview 不在站点域名下，相对路径会 404。
 *    协议相对地址（`//cdn...`）不能碰，所以负向断言一下。
 *
 * 2. 小程序端把常用的几个标签的样式内联进去。rich-text 在微信里是独立渲染层，
 *    外面的 CSS 选择器进不去，段落间距和图片宽度只能靠内联样式。
 *    其他端的 webview 里全局样式是生效的，不需要这一步。
 */

const RELATIVE_ATTR = /(\s(?:src|href)=")\/(?!\/)/g

function absolutizeHtml(html: string): string {
  if (!html) return ''
  return html.replace(RELATIVE_ATTR, '$1' + baseUrl() + '/')
}

const IMG_STYLE = 'max-width:100%;height:auto;border-radius:8px;'
const P_STYLE = 'margin:0 0 1em;'

/** 只在自己那一层标签内判断有没有 style，绝不跨标签匹配。 */
function inlineStyleForTag(html: string, tag: string, style: string): string {
  const pattern = new RegExp('<' + tag + '\\b([^>]*)>', 'gi')
  return html.replace(pattern, (whole: string, attrs: string) => {
    if (/\sstyle\s*=/i.test(attrs)) return whole
    return '<' + tag + ' style="' + style + '"' + attrs + '>'
  })
}

export function prepareHtml(html: string): string {
  let output = absolutizeHtml(html)
  if (!output) return output
  // #ifdef MP-WEIXIN
  output = inlineStyleForTag(output, 'img', IMG_STYLE)
  output = inlineStyleForTag(output, 'p', P_STYLE)
  // #endif
  return output
}

/** 纯文本兜底：服务端没给 HTML 时（比如接口降级），至少把正文原样显示出来。 */
export function textToHtml(text: string): string {
  const escaped = (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n{2,}/)
    .map((block) => '<p>' + block.replace(/\n/g, '<br/>') + '</p>')
    .join('')
}
