'use client'

/**
 * Minimal, dependency-free markdown → HTML renderer.
 *
 * Built specifically for the Growth Advisor's chat replies (and any other
 * short AI output): headings, bold, italic, inline code, links, and
 * bullet / numbered lists. It is SAFE by construction — the raw string is
 * HTML-escaped first, so model output cannot inject tags or scripts. Only the
 * whitelisted inline/block markdown we add afterward becomes real HTML.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Inline markdown on an already-escaped string. */
function inline(text: string): string {
  return text
    // bold then italic (order matters so ** isn't eaten by *)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-800 text-brand-blue text-[0.85em]">$1</code>')
    // [label](url) — only http/https links allowed
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-blue underline">$1</a>')
}

/** Convert a full markdown string into safe HTML. */
export function mdToHtml(src: string): string {
  const escaped = escapeHtml(src.trim())
  const lines = escaped.split('\n')
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) { flushPara(); closeList(); continue }

    // Headings: #, ##, ###
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flushPara(); closeList()
      const level = h[1].length
      const cls = level === 1 ? 'text-base font-bold mt-2 mb-1'
        : level === 2 ? 'text-sm font-bold mt-2 mb-1'
        : 'text-sm font-semibold mt-1.5 mb-0.5'
      out.push(`<h${level} class="${cls}">${inline(h[2])}</h${level}>`)
      continue
    }

    // Numbered list item
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ol) {
      flushPara()
      if (listType !== 'ol') { closeList(); out.push('<ol class="list-decimal pl-5 space-y-1 my-1">'); listType = 'ol' }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }

    // Bullet list item
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    if (ul) {
      flushPara()
      if (listType !== 'ul') { closeList(); out.push('<ul class="list-disc pl-5 space-y-1 my-1">'); listType = 'ul' }
      out.push(`<li>${inline(ul[1])}</li>`)
      continue
    }

    // Plain text → accumulate into a paragraph
    closeList()
    para.push(line.trim())
  }
  flushPara(); closeList()
  return out.join('')
}

/** Render markdown as formatted HTML in a prose-styled container. */
export default function Markdown({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={`md-body space-y-2 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
    />
  )
}
