/**
 * 关键词命中切分。搜索结果里把命中的片段单独标出来用。
 *
 * 不用正则：关键词是用户随手输的，直接当字面量找更省事，也不会被 `(`、`*`
 * 这类字符把正则搞坏。大小写不敏感 —— 中文没有大小写，这一步是给英文搜索准备的。
 */

export interface HighlightPart {
  hit: boolean
  text: string
}

/**
 * 切成若干段，命中的那些 hit 为 true。
 * 关键词为空、或者整段都没命中的时候，返回原样一段，调用方不用自己判空。
 */
export function splitHighlight(text: string, keyword: string): HighlightPart[] {
  const source = text || ''
  const needle = (keyword || '').trim().toLowerCase()
  if (!needle || !source) return [{ hit: false, text: source }]

  const haystack = source.toLowerCase()
  const parts: HighlightPart[] = []
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) break
    if (at > from) parts.push({ hit: false, text: source.slice(from, at) })
    parts.push({ hit: true, text: source.slice(at, at + needle.length) })
    from = at + needle.length
  }
  if (!parts.length) return [{ hit: false, text: source }]
  if (from < source.length) parts.push({ hit: false, text: source.slice(from) })
  return parts
}
