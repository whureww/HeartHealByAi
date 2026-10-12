/**
 * AI 分析报告 Markdown 渲染器（安全子集）
 *
 * AI 输出为 Markdown（标题/加粗/列表/分隔线），界面此前按纯文本 pre-wrap 展示，
 * 星号井号直接裸露，观感差。此渲染器将其转为结构化 HTML。
 *
 * 安全策略：先整体 HTML 转义再做语法替换，所有标签均由本模块生成，
 * 用户/AI 内容永远不会以原始 HTML 形态注入（防 XSS）。
 * 支持语法：# ~ #### 标题、**加粗**、`行内代码`、-/* 无序列表、1. 有序列表、--- 分隔线、段落。
 */

/** HTML 实体转义（渲染前第一步，杜绝注入） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 行内语法：**加粗** 与 `行内代码`（输入已完成实体转义） */
function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

/**
 * 渲染 Markdown 报告为 HTML 片段
 * 逐行分块：标题/列表项/分隔线独立成块，连续普通行聚合为段落
 */
export function renderReportHtml(md: string): string {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let listBuf: { ordered: boolean; items: string[] } | null = null
  let paraBuf: string[] = []

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${inline(escapeHtml(paraBuf.join(' ')))}</p>`)
      paraBuf = []
    }
  }
  const flushList = () => {
    if (listBuf) {
      const tag = listBuf.ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${listBuf.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`)
      listBuf = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()

    // 空行：结束当前段落与列表
    if (!line) {
      flushPara()
      flushList()
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushPara()
      flushList()
      out.push('<hr/>')
      continue
    }

    // 标题（# ~ ####）
    const h = line.match(/^(#{1,4})\s+(.+)$/)
    if (h) {
      flushPara()
      flushList()
      const level = h[1].length <= 2 ? 'h2' : 'h3' // 报告只用到两级
      out.push(`<${level}>${inline(escapeHtml(h[2].replace(/#+\s*$/, '')))}</${level}>`)
      continue
    }

    // 无序列表（- / * / •）
    const ul = line.match(/^[-*•]\s+(.+)$/)
    if (ul) {
      flushPara()
      if (!listBuf || listBuf.ordered) {
        flushList()
        listBuf = { ordered: false, items: [] }
      }
      listBuf.items.push(escapeHtml(ul[1]))
      continue
    }

    // 有序列表（1. / 1、）
    const ol = line.match(/^\d+[.、)]\s+(.+)$/)
    if (ol) {
      flushPara()
      if (!listBuf || !listBuf.ordered) {
        flushList()
        listBuf = { ordered: true, items: [] }
      }
      listBuf.items.push(escapeHtml(ol[1]))
      continue
    }

    // 普通行：聚合为段落
    flushList()
    paraBuf.push(line)
  }
  flushPara()
  flushList()

  return out.join('\n')
}

/** Markdown 转纯文本（复制用）：去标题井号、去加粗星号、保留换行结构 */
export function reportToPlainText(md: string): string {
  return String(md || '')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*•]\s+/gm, '· ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
