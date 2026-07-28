import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import zlib from 'node:zlib'

const root = process.cwd()
const out = path.join(root, 'public')
const cacheRoot = path.join(root, '.aidocs-cache')
const config = readConfig()
const base = normalizeBase(config.base || '/aidocs/')
const siteTitle = config.title || 'AI Docs'
const siteDescription = config.description || '统一沉淀 AI 生成文档。'
const sourceName = config.source || 'transportmall/aidocs'
const plantUmlServer = String(config.plantUmlServer || '').replace(/\/+$/, '')
const plantUmlCommand = process.env.PLANTUML_BIN || config.plantUmlCommand || 'plantuml'
const plantUmlJar = process.env.PLANTUML_JAR || config.plantUmlJar || '/opt/plantuml/plantuml.jar'
const rendererVersion = `incremental-pages-v10:${base}:${siteTitle}:${plantUmlServer}:${plantUmlCommand}:${plantUmlJar}`
const sourceRoots = config.sourceRoots || [
  { dir: 'technical-caliber', label: '技术口径' },
  { dir: 'product-caliber', label: '产品口径' }
]

const docEntries = []
const ignoredPathParts = new Set(['.git', 'public', '.vitepress-work', '.aidocs-cache', 'node_modules'])
const ignoredRelativePrefixes = ['technical-caliber/startup/tools/']
let plantUmlLocalRendererMemo
let plantUmlRendererCacheKeyMemo

function readConfig() {
  const configFile = path.join(root, 'docs-build.config.json')
  return fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {}
}

function normalizeBase(value) {
  const raw = String(value || '/')
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${shellQuote(command)}`], {
    cwd: root,
    encoding: 'utf8'
  })
  return result.status === 0
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`
}

function sha(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10)
}

function fileHash(file) {
  return crypto.createHash('sha1')
    .update(rendererVersion)
    .update(plantUmlRendererCacheKey())
    .update(fs.readFileSync(file))
    .digest('hex')
}

function plantUmlRendererCacheKey() {
  if (plantUmlRendererCacheKeyMemo) return plantUmlRendererCacheKeyMemo
  const localRenderer = plantUmlLocalRenderer()
  if (localRenderer) {
    plantUmlRendererCacheKeyMemo = `plantuml-local:${localRenderer.command}:${localRenderer.args.join(' ')}`
  } else if (plantUmlServer) {
    plantUmlRendererCacheKeyMemo = `plantuml-server:${plantUmlServer}`
  } else {
    plantUmlRendererCacheKeyMemo = 'plantuml-source'
  }
  return plantUmlRendererCacheKeyMemo
}

function slugSegment(segment, fallbackPrefix = 'doc') {
  const ext = path.extname(segment)
  const base = ext ? segment.slice(0, -ext.length) : segment
  const slug = base
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const clean = (slug || `${fallbackPrefix}-${sha(segment)}`).replace(/^\.+/, `${fallbackPrefix}-`)
  const needsHash = clean !== base.toLowerCase()
  return `${clean}${needsHash ? `-${sha(segment)}` : ''}${ext.toLowerCase()}`
}

function safeRelPath(rel) {
  return rel
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment, index, all) => slugSegment(segment, index === all.length - 1 ? 'doc' : 'dir'))
    .join('/')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeSearchText(value) {
  return String(value)
    .replace(/```[\s\S]*?```/g, block => block.replace(/```/g, ' '))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|[\](){}!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function gitDates(file) {
  const rel = path.relative(root, file)
  const result = spawnSync('git', ['log', '--follow', '--format=%cI', '--', rel], {
    cwd: root,
    encoding: 'utf8'
  })
  const dates = result.status === 0
    ? result.stdout.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
    : []
  if (dates.length) return { createdAt: dates[dates.length - 1], updatedAt: dates[0] }
  const stat = fs.statSync(file)
  return { createdAt: stat.birthtime.toISOString(), updatedAt: stat.mtime.toISOString() }
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function isTableDelimiter(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => renderInline(cell.trim()))
}

function renderTable(lines) {
  const headHtml = tableCells(lines[0]).map(cell => `<th>${cell}</th>`).join('')
  const bodyHtml = lines.slice(2)
    .map(tableCells)
    .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
    .join('\n')
  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
}

function htmlBlockTag(line) {
  const match = /^\s*<([a-z][a-z0-9-]*)(\s|>|\/>)/i.exec(line)
  if (!match) return ''
  const tag = match[1].toLowerCase()
  const allowed = new Set(['div', 'table', 'details', 'summary', 'figure', 'figcaption', 'img', 'section', 'article'])
  return allowed.has(tag) ? tag : ''
}

function isSelfClosingHtmlTag(tag, line) {
  return ['img'].includes(tag) || /\/>\s*$/.test(line)
}

function renderHtmlBlock(rawHtml) {
  const safeHtml = String(rawHtml)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1="#"')
  return `<div class="raw-html-block">${safeHtml}</div>`
}

function renderMarkdownLite(markdownText) {
  const lines = markdownText
    .replace(/^```pre!(?:\s+[^\r\n]*)?$/gim, '```text')
    .split(/\r?\n/)
  const html = []
  const toc = []
  let paragraph = []
  let code = null
  let table = []

  function flushParagraph() {
    if (!paragraph.length) return
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  function flushTable() {
    if (!table.length) return
    html.push(table.length >= 2 && isTableDelimiter(table[1])
      ? renderTable(table)
      : `<pre><code>${escapeHtml(table.join('\n'))}</code></pre>`)
    table = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fence = /^```(\S*)/.exec(line)
    if (fence) {
      flushParagraph()
      flushTable()
      if (code) {
        html.push(renderCodeBlock(code.lang, code.lines.join('\n')))
        code = null
      } else {
        code = { lang: fence[1] || '', lines: [] }
      }
      continue
    }
    if (code) {
      code.lines.push(line)
      continue
    }
    const blockTag = htmlBlockTag(line)
    if (blockTag) {
      flushParagraph()
      flushTable()
      const block = [line]
      const closeTag = `</${blockTag}>`
      if (!isSelfClosingHtmlTag(blockTag, line)) {
        while (index + 1 < lines.length && !lines[index].toLowerCase().includes(closeTag)) {
          index += 1
          block.push(lines[index])
          if (lines[index].toLowerCase().includes(closeTag)) break
        }
      }
      html.push(renderHtmlBlock(block.join('\n')))
      continue
    }
    if (/^\s*@start\w*/i.test(line)) {
      flushParagraph()
      flushTable()
      const block = [line]
      while (index + 1 < lines.length && !/^\s*@end\w*/i.test(lines[index])) {
        index += 1
        block.push(lines[index])
        if (/^\s*@end\w*/i.test(lines[index])) break
      }
      html.push(renderCodeBlock('plantuml', block.join('\n')))
      continue
    }
    if (line.includes('|') && (table.length || isTableDelimiter(lines[index + 1] || ''))) {
      flushParagraph()
      table.push(line)
      continue
    }
    flushTable()
    if (!line.trim()) {
      flushParagraph()
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      const text = heading[2].trim()
      const id = headingId(text, toc.length)
      toc.push({ level, title: normalizeSearchText(text), id })
      html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`)
      continue
    }
    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph()
      html.push('<hr>')
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph()
      const items = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*[-*]\s+/, '').trim())}</li>`)
        index += 1
      }
      index -= 1
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph()
      const items = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*\d+\.\s+/, '').trim())}</li>`)
        index += 1
      }
      index -= 1
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    paragraph.push(line.trim())
  }
  flushParagraph()
  flushTable()
  if (code) html.push(renderCodeBlock(code.lang, code.lines.join('\n')))
  return { html: html.join('\n'), toc }
}

function headingId(text, index) {
  const slug = normalizeSearchText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
  return `h-${slug || sha(text)}-${index}`
}

function renderCodeBlock(lang, content) {
  const normalizedLang = String(lang || '').toLowerCase()
  if (normalizedLang === 'mermaid') {
    return `<div class="mermaid">${escapeHtml(content)}</div>`
  }
  if (['plantuml', 'puml', 'uml'].includes(normalizedLang)) {
    return renderPlantUmlBlock(content)
  }
  const label = String(lang || 'text').trim() || 'text'
  return `<figure class="code-block"><figcaption>${escapeHtml(label)}</figcaption><pre><code>${escapeHtml(content)}</code></pre></figure>`
}

function renderPlantUmlBlock(content) {
  const source = normalizePlantUmlSource(content)
  const localSvg = renderPlantUmlSvg(source)
  if (localSvg) {
    return `<figure class="plantuml-diagram"><figcaption>PlantUML</figcaption><img src="${localSvg}" alt="PlantUML diagram" loading="lazy"><details><summary>查看源码</summary><pre><code>${escapeHtml(source)}</code></pre></details></figure>`
  }
  if (!plantUmlServer) {
    return `<figure class="code-block plantuml-source"><figcaption>plantuml</figcaption><pre><code>${escapeHtml(source)}</code></pre></figure>`
  }
  const imageUrl = `${plantUmlServer}/svg/${plantUmlEncode(source)}`
  return `<figure class="plantuml-diagram"><figcaption>PlantUML</figcaption><img src="${imageUrl}" alt="PlantUML diagram" loading="lazy"><details><summary>查看源码</summary><pre><code>${escapeHtml(source)}</code></pre></details></figure>`
}

function renderPlantUmlSvg(source) {
  const localRenderer = plantUmlLocalRenderer()
  if (!localRenderer) return ''
  const fileName = `${sha(source)}.svg`
  const cacheFile = path.join(cacheRoot, 'plantuml', fileName)
  const outFile = path.join(out, 'assets', 'plantuml', fileName)
  ensureDir(path.dirname(cacheFile))
  ensureDir(path.dirname(outFile))
  if (fs.existsSync(cacheFile)) {
    fs.copyFileSync(cacheFile, outFile)
    return `${base}assets/plantuml/${fileName}`
  }
  const result = spawnSync(localRenderer.command, localRenderer.args, {
    cwd: root,
    input: source,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  })
  if (result.status !== 0 || !String(result.stdout || '').includes('<svg')) {
    const error = String(result.stderr || result.stdout || '').trim()
    console.warn(`PlantUML render skipped: ${error.slice(0, 300) || 'unknown error'}`)
    return ''
  }
  fs.writeFileSync(cacheFile, result.stdout, 'utf8')
  fs.copyFileSync(cacheFile, outFile)
  return `${base}assets/plantuml/${fileName}`
}

function plantUmlLocalRenderer() {
  if (plantUmlLocalRendererMemo !== undefined) return plantUmlLocalRendererMemo
  if (commandExists(plantUmlCommand)) {
    plantUmlLocalRendererMemo = { command: plantUmlCommand, args: ['-tsvg', '-pipe', '-charset', 'UTF-8'] }
    return plantUmlLocalRendererMemo
  }
  if (fs.existsSync(plantUmlJar) && commandExists('java')) {
    plantUmlLocalRendererMemo = {
      command: 'java',
      args: ['-Djava.awt.headless=true', '-jar', plantUmlJar, '-tsvg', '-pipe', '-charset', 'UTF-8']
    }
    return plantUmlLocalRendererMemo
  }
  plantUmlLocalRendererMemo = null
  return plantUmlLocalRendererMemo
}

function normalizePlantUmlSource(content) {
  const text = String(content).trim()
  return /^@start\w*/i.test(text) ? text : `@startuml\n${text}\n@enduml`
}

function plantUmlEncode(source) {
  return encodePlantUmlBytes(zlib.deflateRawSync(Buffer.from(source, 'utf8')))
}

function encodePlantUmlBytes(buffer) {
  let result = ''
  for (let index = 0; index < buffer.length; index += 3) {
    result += append3bytes(buffer[index], buffer[index + 1] ?? 0, buffer[index + 2] ?? 0)
  }
  return result
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
  const c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
  const c4 = b3 & 0x3F
  return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F)
}

function encode6bit(value) {
  if (value < 10) return String.fromCharCode(48 + value)
  value -= 10
  if (value < 26) return String.fromCharCode(65 + value)
  value -= 26
  if (value < 26) return String.fromCharCode(97 + value)
  value -= 26
  if (value === 0) return '-'
  if (value === 1) return '_'
  return '?'
}

function homeHref() {
  return base
}

function homeChromeCss() {
  return `
    .aidocs-topbar { position: sticky; top: 0; z-index: 20; margin: -32px -40px 28px; padding: 12px 40px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, Canvas 92%, transparent); backdrop-filter: blur(10px); }
    .aidocs-topbar-inner { max-width: 1120px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
    .aidocs-home { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; color: var(--brand); text-decoration: none; font-weight: 600; line-height: 1.4; }
    .aidocs-title { color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 720px) { .aidocs-topbar { margin: -20px -16px 22px; padding: 10px 16px; } }`
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function pageHtml(title, body, options = {}) {
  const meta = options.meta || {}
  const toc = options.toc || []
  const metaItems = [
    ['来源', meta.source],
    ['分类', meta.group],
    ['类型', meta.type],
    ['创建', formatDate(meta.createdAt)],
    ['修改', formatDate(meta.updatedAt)]
  ].filter(([, value]) => value)
  const metaHtml = metaItems.length
    ? `<section class="doc-meta">${metaItems.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</section>`
    : ''
  const tocHtml = toc.length
    ? `<nav class="doc-toc"><strong>目录</strong>${toc.map(item => `<a class="toc-l${Math.min(item.level, 4)}" href="#${item.id}">${escapeHtml(item.title)}</a>`).join('')}</nav>`
    : '<nav class="doc-toc"><strong>目录</strong><span>暂无标题</span></nav>'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; --fg: #1f2937; --muted: #6b7280; --line: #d7dde8; --soft: #f6f8fb; --brand: #2563eb; --code: #fff7ed; }
    @media (prefers-color-scheme: dark) { :root { --fg: #d8dee9; --muted: #9ca3af; --line: #374151; --soft: #111827; --brand: #60a5fa; --code: #1f2937; } body { background: #0f1117; } }
    body { margin: 0; padding: 28px clamp(16px, 2vw, 32px) 56px; color: var(--fg); font: 15px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1680px; margin: 0 auto; }
    .reader { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 24px; align-items: start; }
    article { min-width: 0; }
    .reader-side { position: sticky; top: 78px; max-height: calc(100vh - 96px); overflow: auto; border-left: 1px solid var(--line); padding-left: 16px; }
    .doc-meta { display: grid; gap: 8px; margin-bottom: 18px; color: var(--muted); font-size: 12px; }
    .doc-meta div { display: grid; gap: 2px; }
    .doc-meta strong { color: var(--fg); font-weight: 600; overflow-wrap: anywhere; }
    .doc-toc strong { display: block; margin: 0 0 8px; }
    .doc-toc a, .doc-toc span { display: block; padding: 5px 0; color: var(--muted); text-decoration: none; font-size: 13px; line-height: 1.45; }
    .doc-toc a:hover { color: var(--brand); }
    .doc-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .doc-action { width: auto; margin: 0; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
    .doc-action.active { color: var(--brand); border-color: color-mix(in srgb, var(--brand) 36%, var(--line)); background: var(--soft); font-weight: 700; }
    .doc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: -8px 0 16px; }
    .doc-tag { padding: 1px 6px; border: 1px solid #bbf7d0; border-radius: 4px; color: #047857; background: #f0fdf4; font-size: 12px; }
    .toc-l3 { padding-left: 12px !important; }
    .toc-l4 { padding-left: 24px !important; }
    h1, h2, h3 { line-height: 1.35; margin: 1.8em 0 .7em; }
    h1 { font-size: 32px; padding-bottom: 12px; border-bottom: 2px solid var(--brand); }
    h2 { font-size: 24px; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
    h3 { font-size: 19px; }
    p, ul, ol, blockquote, pre, table { margin: 14px 0; }
    code { padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; background: var(--code); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { overflow: auto; margin: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 0 0 8px 8px; background: var(--soft); }
    pre code { padding: 0; border: 0; background: transparent; }
    .code-block { margin: 16px 0; }
    .code-block figcaption { padding: 6px 10px; border: 1px solid var(--line); border-bottom: 0; border-radius: 8px 8px 0 0; color: var(--muted); background: var(--soft); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .mermaid { overflow: auto; padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); text-align: center; }
    .plantuml-diagram { margin: 18px 0; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); }
    .plantuml-diagram figcaption { margin-bottom: 10px; color: var(--muted); font-size: 12px; font-weight: 700; }
    .plantuml-diagram img { display: block; max-width: 100%; margin: 0 auto; }
    .plantuml-diagram details { margin-top: 12px; color: var(--muted); }
    .plantuml-diagram summary { cursor: pointer; }
    .raw-html-block { margin: 16px 0; overflow-x: auto; }
    .raw-html-block table { width: max-content; max-width: none; }
    table { width: 100%; border-collapse: collapse; display: block; overflow-x: auto; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; vertical-align: top; }
    th { background: var(--soft); text-align: left; }
    img { max-width: 100%; }
    a { color: var(--brand); }
    ${homeChromeCss()}
    @media (max-width: 980px) { .reader { grid-template-columns: 1fr; } .reader-side { position: static; max-height: none; border-left: 0; border-top: 1px solid var(--line); padding: 16px 0 0; } }
    @media (max-width: 720px) { body { padding: 20px 16px 40px; } h1 { font-size: 26px; } }
  </style>
</head>
<body>
<nav class="aidocs-topbar"><div class="aidocs-topbar-inner"><a class="aidocs-home" href="${homeHref()}">← 返回首页</a><span class="aidocs-title">${escapeHtml(siteTitle)}</span></div></nav>
<main><div class="reader"><article>${body}</article><aside class="reader-side"><section class="doc-actions"><button class="doc-action" id="docFavorite" type="button">☆ 收藏</button><button class="doc-action" id="docPin" type="button">↟ 置顶</button><button class="doc-action" id="docTagEdit" type="button">标 标签</button></section><section class="doc-tags" id="docTags"></section>${metaHtml}${tocHtml}</aside></div></main>
<script>
  if (document.querySelector('.mermaid')) {
    const script = document.createElement('script');
    script.src = '${base}assets/mermaid.min.js';
    script.onload = () => window.mermaid && window.mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });
    document.head.appendChild(script);
  }
  (function () {
    const source = ${JSON.stringify(meta.source || sourceName)};
    const key = source + '|' + window.location.pathname;
    const favoriteButton = document.getElementById('docFavorite');
    const pinButton = document.getElementById('docPin');
    const tagButton = document.getElementById('docTagEdit');
    const tagsEl = document.getElementById('docTags');
    function readSet(name) {
      try {
        const items = JSON.parse(localStorage.getItem(name) || '[]');
        return new Set(Array.isArray(items) ? items : []);
      } catch (_) {
        return new Set();
      }
    }
    function saveSet(name, value) {
      localStorage.setItem(name, JSON.stringify(Array.from(value)));
    }
    function readTags() {
      try {
        const value = JSON.parse(localStorage.getItem('aidocs:tags') || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } catch (_) {
        return {};
      }
    }
    function saveTags(value) {
      localStorage.setItem('aidocs:tags', JSON.stringify(value));
    }
    function render() {
      const favorites = readSet('aidocs:favorites');
      const pinned = readSet('aidocs:pinned');
      const tagMap = readTags();
      const tags = Array.isArray(tagMap[key]) ? tagMap[key] : [];
      favoriteButton.className = 'doc-action' + (favorites.has(key) ? ' active' : '');
      favoriteButton.textContent = favorites.has(key) ? '★ 已收藏' : '☆ 收藏';
      pinButton.className = 'doc-action' + (pinned.has(key) ? ' active' : '');
      pinButton.textContent = pinned.has(key) ? '↑ 已置顶' : '↟ 置顶';
      tagButton.className = 'doc-action' + (tags.length ? ' active' : '');
      tagsEl.innerHTML = tags.map(tag => '<span class="doc-tag">' + String(tag).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch])) + '</span>').join('');
    }
    favoriteButton.addEventListener('click', () => {
      const favorites = readSet('aidocs:favorites');
      if (favorites.has(key)) favorites.delete(key);
      else favorites.add(key);
      saveSet('aidocs:favorites', favorites);
      render();
    });
    pinButton.addEventListener('click', () => {
      const pinned = readSet('aidocs:pinned');
      if (pinned.has(key)) pinned.delete(key);
      else pinned.add(key);
      saveSet('aidocs:pinned', pinned);
      render();
    });
    tagButton.addEventListener('click', () => {
      const tagMap = readTags();
      const current = Array.isArray(tagMap[key]) ? tagMap[key].join(', ') : '';
      const input = window.prompt('输入标签，多个用逗号、中文逗号或空格分隔；留空清除标签', current);
      if (input === null) return;
      const tags = Array.from(new Set(input.split(/[,，\\s]+/).map(item => item.trim()).filter(Boolean))).slice(0, 12);
      if (tags.length) tagMap[key] = tags;
      else delete tagMap[key];
      saveTags(tagMap);
      render();
    });
    render();
  })();
</script>
</body>
</html>`
}

function injectHtmlChrome(html) {
  const style = `<style>
.aidocs-home-link{position:fixed;top:14px;left:14px;z-index:2147483647;display:inline-flex;align-items:center;padding:7px 11px;border:1px solid #d7dde8;border-radius:6px;background:rgba(255,255,255,.92);color:#2563eb;text-decoration:none;font:600 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(15,23,42,.12);backdrop-filter:blur(10px)}
.aidocs-html-actions{position:fixed;top:14px;left:128px;z-index:2147483647;display:flex;gap:8px}
.aidocs-html-action{padding:7px 10px;border:1px solid #d7dde8;border-radius:999px;background:rgba(255,255,255,.92);color:#667085;font:600 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 4px 16px rgba(15,23,42,.12);backdrop-filter:blur(10px);cursor:pointer}
.aidocs-html-action.active{color:#2563eb;background:#eff6ff;border-color:#93c5fd}
@media (prefers-color-scheme:dark){.aidocs-home-link{border-color:#374151;background:rgba(17,24,39,.9);color:#60a5fa}}
@media (prefers-color-scheme:dark){.aidocs-html-action{border-color:#374151;background:rgba(17,24,39,.9);color:#9ca3af}.aidocs-html-action.active{color:#60a5fa;background:#111827;border-color:#60a5fa}}
</style>`
  const link = `<a class="aidocs-home-link" href="${homeHref()}">← 返回首页</a>`
  const actions = `<div class="aidocs-html-actions"><button class="aidocs-html-action" id="aidocsHtmlFavorite" type="button">☆ 收藏</button><button class="aidocs-html-action" id="aidocsHtmlPin" type="button">↟ 置顶</button><button class="aidocs-html-action" id="aidocsHtmlTag" type="button">标 标签</button></div><script>
(function(){
  const key = ${JSON.stringify(sourceName)} + '|' + window.location.pathname;
  const favoriteButton = document.getElementById('aidocsHtmlFavorite');
  const pinButton = document.getElementById('aidocsHtmlPin');
  const tagButton = document.getElementById('aidocsHtmlTag');
  function readSet(name){try{const items=JSON.parse(localStorage.getItem(name)||'[]');return new Set(Array.isArray(items)?items:[])}catch(_){return new Set()}}
  function saveSet(name,value){localStorage.setItem(name,JSON.stringify(Array.from(value)))}
  function readTags(){try{const value=JSON.parse(localStorage.getItem('aidocs:tags')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(_){return {}}}
  function saveTags(value){localStorage.setItem('aidocs:tags',JSON.stringify(value))}
  function render(){const favorites=readSet('aidocs:favorites');const pinned=readSet('aidocs:pinned');const tagMap=readTags();const tags=Array.isArray(tagMap[key])?tagMap[key]:[];favoriteButton.className='aidocs-html-action'+(favorites.has(key)?' active':'');favoriteButton.textContent=favorites.has(key)?'★ 已收藏':'☆ 收藏';pinButton.className='aidocs-html-action'+(pinned.has(key)?' active':'');pinButton.textContent=pinned.has(key)?'↑ 已置顶':'↟ 置顶';tagButton.className='aidocs-html-action'+(tags.length?' active':'')}
  favoriteButton.addEventListener('click',function(){const favorites=readSet('aidocs:favorites');if(favorites.has(key))favorites.delete(key);else favorites.add(key);saveSet('aidocs:favorites',favorites);render()});
  pinButton.addEventListener('click',function(){const pinned=readSet('aidocs:pinned');if(pinned.has(key))pinned.delete(key);else pinned.add(key);saveSet('aidocs:pinned',pinned);render()});
  tagButton.addEventListener('click',function(){const tagMap=readTags();const current=Array.isArray(tagMap[key])?tagMap[key].join(', '):'';const input=window.prompt('输入标签，多个用逗号、中文逗号或空格分隔；留空清除标签',current);if(input===null)return;const tags=Array.from(new Set(input.split(/[,，\\\\s]+/).map(item=>item.trim()).filter(Boolean))).slice(0,12);if(tags.length)tagMap[key]=tags;else delete tagMap[key];saveTags(tagMap);render()});
  render();
})();
</script>`
  let result = html
  result = /<\/head>/i.test(result) ? result.replace(/<\/head>/i, `${style}\n</head>`) : `${style}\n${result}`
  result = /<body[^>]*>/i.test(result) ? result.replace(/<body[^>]*>/i, match => `${match}\n${link}${actions}`) : `${link}${actions}\n${result}`
  return result
}

function titleFromMarkdown(file) {
  const text = fs.readFileSync(file, 'utf8')
  const line = text.split(/\r?\n/).find(item => item.startsWith('# '))
  return line ? line.replace(/^#\s+/, '').trim() : path.basename(file, path.extname(file))
}

function titleFromHtml(file) {
  const text = fs.readFileSync(file, 'utf8')
  const title = /<title[^>]*>(.*?)<\/title>/is.exec(text)
  return title ? title[1].replace(/\s+/g, ' ').trim() : path.basename(file, path.extname(file))
}

function shouldSkip(fullPath) {
  const rel = path.relative(root, fullPath).replace(/\\/g, '/')
  if (rel.split('/').some(part => ignoredPathParts.has(part))) return true
  return ignoredRelativePrefixes.some(prefix => rel.startsWith(prefix))
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (shouldSkip(full)) continue
    if (entry.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function writeCached(sourceFile, outRel, render) {
  const hash = fileHash(sourceFile)
  const cacheFile = path.join(cacheRoot, `${hash}.html`)
  const dest = path.join(out, outRel)
  ensureDir(path.dirname(dest))
  if (!fs.existsSync(cacheFile)) {
    ensureDir(cacheRoot)
    const html = render()
    fs.writeFileSync(cacheFile, html, 'utf8')
    fs.writeFileSync(dest, html, 'utf8')
    return { dest, cacheHit: false }
  }
  fs.copyFileSync(cacheFile, dest)
  return { dest, cacheHit: true }
}

function addDoc(entry) {
  docEntries.push(entry)
}

function copyMarkdown(file, rootInfo, stats) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const pageRel = path.posix.join(rootInfo.dir, safe).replace(/\.md$/i, '.html')
  const title = titleFromMarkdown(file)
  const body = fs.readFileSync(file, 'utf8')
  const dates = gitDates(file)
  const result = writeCached(file, pageRel, () => {
    const rendered = renderMarkdownLite(body)
    return pageHtml(title, rendered.html, {
      toc: rendered.toc,
      meta: {
        source: sourceName,
        group: rootInfo.label,
        type: 'MD',
        ...dates
      }
    })
  })
  stats[result.cacheHit ? 'cached' : 'rendered'] += 1
  addDoc({
    title,
    path: pageRel,
    type: 'MD',
    group: rootInfo.label,
    source: sourceName,
    content: normalizeSearchText(body).slice(0, 12000),
    ...dates
  })
}

function copyHtml(file, rootInfo, stats) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const pageRel = path.posix.join(rootInfo.dir, safe)
  const title = titleFromHtml(file)
  const body = fs.readFileSync(file, 'utf8')
  const result = writeCached(file, pageRel, () => injectHtmlChrome(body))
  stats[result.cacheHit ? 'cached' : 'rendered'] += 1
  addDoc({
    title,
    path: pageRel,
    type: 'HTML',
    group: rootInfo.label,
    source: sourceName,
    content: normalizeSearchText(body).slice(0, 12000),
    ...gitDates(file)
  })
}

function copyCodeDoc(file, rootInfo, stats) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(`${rel}.html`)
  const pageRel = path.posix.join(rootInfo.dir, safe)
  const title = path.basename(file)
  const body = fs.readFileSync(file, 'utf8')
  const dates = gitDates(file)
  const result = writeCached(file, pageRel, () => pageHtml(title, `<h1 id="h-${sha(title)}-0">${escapeHtml(title)}</h1>\n${renderCodeBlock(path.extname(file).slice(1), body)}`, {
    toc: [{ level: 1, title, id: `h-${sha(title)}-0` }],
    meta: {
      source: sourceName,
      group: rootInfo.label,
      type: path.extname(file).slice(1).toUpperCase(),
      ...dates
    }
  }))
  stats[result.cacheHit ? 'cached' : 'rendered'] += 1
  addDoc({
    title,
    path: pageRel,
    type: path.extname(file).slice(1).toUpperCase(),
    group: rootInfo.label,
    source: sourceName,
    content: normalizeSearchText(body).slice(0, 12000),
    ...dates
  })
}

function copyAsset(file, rootInfo) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const dest = path.join(out, rootInfo.dir, safe)
  ensureDir(path.dirname(dest))
  fs.copyFileSync(file, dest)
}

function copyRootAssets() {
  const assetDir = path.join(root, 'assets')
  if (!fs.existsSync(assetDir)) return
  for (const file of walk(assetDir)) {
    const rel = path.relative(assetDir, file)
    const dest = path.join(out, 'assets', safeRelPath(rel))
    ensureDir(path.dirname(dest))
    fs.copyFileSync(file, dest)
  }
}

function copyCachedPlantUmlAssets() {
  const sourceDir = path.join(cacheRoot, 'plantuml')
  if (!fs.existsSync(sourceDir)) return
  const pending = [sourceDir]
  while (pending.length) {
    const current = pending.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        pending.push(full)
        continue
      }
      if (path.extname(entry.name).toLowerCase() !== '.svg') continue
      const rel = path.relative(sourceDir, full)
      const dest = path.join(out, 'assets', 'plantuml', safeRelPath(rel))
      ensureDir(path.dirname(dest))
      fs.copyFileSync(full, dest)
    }
  }
}

function docGroup(doc) {
  if (doc.group) return doc.group
  if ((doc.path || '').startsWith('technical-caliber/')) return '技术口径'
  if ((doc.path || '').startsWith('product-caliber/')) return '产品口径'
  return '外部文档'
}

function docFolder(doc) {
  const parts = (doc.path || '').split('/').filter(Boolean)
  if (parts.length <= 1) return '根目录'
  return parts.slice(0, Math.min(2, parts.length - 1)).join('/')
}

function writeIndex() {
  const docs = docEntries.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || a.path.localeCompare(b.path))
  const searchIndex = docs.map(doc => ({
    title: doc.title,
    path: doc.path,
    url: `${base}${doc.path}`,
    type: doc.type,
    group: doc.group,
    source: doc.source,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    content: doc.content
  }))
  fs.writeFileSync(path.join(out, 'search-index.json'), `${JSON.stringify(searchIndex, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(out, 'search-index.js'),
    `window.__AIDOCS_EXTERNAL_INDEXES__ = window.__AIDOCS_EXTERNAL_INDEXES__ || [];\nwindow.__AIDOCS_EXTERNAL_INDEXES__.push(${JSON.stringify({ source: sourceName, docs: searchIndex })});\n`,
    'utf8'
  )

  const externalIndexFile = path.join(root, config.externalIndexesFile || 'external-indexes.json')
  const externalIndexScripts = fs.existsSync(externalIndexFile)
    ? JSON.parse(fs.readFileSync(externalIndexFile, 'utf8')).map(item => item.script).filter(Boolean)
    : []

  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(siteTitle)}</title>
  <style>
    :root { --fg:#20242c; --muted:#667085; --line:#d9e0ea; --soft:#f6f8fb; --brand:#1d75d8; --active:#e8efff; }
    body { margin:0; color:var(--fg); font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#fff; }
    header { height:72px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:center; }
    header div { width:min(1120px, calc(100% - 32px)); display:flex; align-items:center; gap:24px; }
    h1 { font-size:42px; margin:54px 0 14px; }
    main { width:min(1360px, calc(100% - 32px)); margin:0 auto 64px; }
    .lead { color:var(--muted); font-size:20px; }
    .search { display:flex; align-items:center; gap:12px; margin:30px 0 14px; }
    .search input { width:min(560px, 100%); padding:12px 14px; border:1px solid var(--line); border-radius:8px; font-size:16px; }
    .count { color:var(--muted); white-space:nowrap; }
    .toolbar { display:flex; flex-wrap:wrap; align-items:flex-start; gap:10px 18px; margin:0 0 20px; color:var(--muted); font-size:14px; }
    .toolbar-group { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    .toolbar select { padding:8px 34px 8px 10px; border:1px solid var(--line); border-radius:8px; color:var(--fg); background:#fff; font:inherit; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip { width:auto; margin:0; padding:7px 10px; border:1px solid var(--line); border-radius:999px; background:#fff; line-height:1.2; }
    .chip.active { border-color:#bad1ff; background:var(--active); }
    .browser { display:grid; grid-template-columns:240px minmax(0, 1fr) 220px; gap:28px; align-items:start; }
    aside { min-width:0; }
    .left-filters { border-right:1px solid var(--line); padding-right:18px; }
    .right-filters { border-left:1px solid var(--line); padding-left:18px; }
    section { margin-bottom:28px; }
    section strong { display:block; margin-bottom:10px; }
    button { display:block; width:100%; margin:6px 0; padding:9px 12px; border:0; border-radius:8px; color:var(--muted); background:transparent; text-align:left; font:inherit; cursor:pointer; }
    button.active { color:var(--brand); background:var(--active); font-weight:700; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; }
    .card { position:relative; min-height:132px; display:flex; flex-direction:column; gap:8px; padding:16px 48px 16px 16px; border:1px solid var(--line); border-radius:8px; color:var(--fg); background:var(--soft); }
    .card:hover { border-color:var(--brand); }
    .card b a { color:var(--brand); text-decoration:underline; }
    .quick-action { position:absolute; right:12px; width:28px; height:28px; margin:0; padding:0; border:1px solid var(--line); border-radius:50%; color:var(--muted); background:#fff; text-align:center; line-height:1; }
    .favorite { top:12px; }
    .pin { top:46px; }
    .tag-edit { top:80px; font-size:13px; font-weight:700; }
    .favorite.active { color:#a16207; border-color:#f6d365; background:#fff7cc; }
    .pin.active { color:#1d4ed8; border-color:#93c5fd; background:#eff6ff; }
    .tag-edit.active { color:#047857; border-color:#86efac; background:#ecfdf5; }
    .meta, small { color:var(--muted); font-size:12px; overflow-wrap:anywhere; }
    .tags { display:flex; flex-wrap:wrap; gap:6px; }
    .tag { width:fit-content; padding:1px 6px; border:1px solid #bbf7d0; border-radius:4px; color:#047857; background:#f0fdf4; font-size:12px; }
    .snippet { color:var(--muted); font-size:13px; line-height:1.55; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    mark { padding:0 2px; border-radius:3px; color:#8a4b00; background:#fff1a8; }
    small { margin-top:auto; }
    em { width:fit-content; padding:2px 7px; border-radius:4px; color:var(--brand); background:#eef4ff; font-size:12px; font-style:normal; font-weight:700; }
    @media (max-width: 1080px) { .browser { grid-template-columns:220px minmax(0, 1fr); } .right-filters { grid-column:1 / -1; border-left:0; border-top:1px solid var(--line); padding:16px 0 0; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:18px; } }
    @media (max-width: 860px) { h1 { font-size:32px; } .browser { grid-template-columns:1fr; } .left-filters { border-right:0; border-bottom:1px solid var(--line); padding:0 0 16px; } .right-filters { display:block; } }
  </style>
</head>
<body>
  <header><div><strong>${escapeHtml(siteTitle)}</strong></div></header>
  <main>
    <h1>${escapeHtml(siteTitle)}</h1>
    <p class="lead">${escapeHtml(siteDescription)}</p>
    <div class="search"><input id="query" placeholder="搜索标题、路径、类型、来源、正文"><span id="count" class="count"></span></div>
    <div class="toolbar">
      <div class="toolbar-group"><span>排序</span><select id="sortBy"><option value="updated-desc">最近修改优先</option><option value="created-desc">最近创建优先</option><option value="title-asc">标题 A-Z</option></select></div>
      <div class="toolbar-group"><span>置顶</span><div class="chips" id="pinned"></div></div>
      <div class="toolbar-group"><span>收藏</span><div class="chips" id="favorites"></div></div>
      <div class="toolbar-group"><span>标签</span><div class="chips" id="tags"></div></div>
    </div>
    <div class="browser">
      <aside class="left-filters">
        <section><strong>目录</strong><div id="folders"></div></section>
      </aside>
      <div class="grid" id="results"></div>
      <aside class="right-filters">
        <section><strong>来源</strong><div id="sources"></div></section>
        <section><strong>分类</strong><div id="groups"></div></section>
      </aside>
    </div>
  </main>
  <script>
    let localDocs = [];
    const externalIndexScripts = ${JSON.stringify(externalIndexScripts)};
    let externalDocs = [];
    let activeSource = '全部来源';
    let activeGroup = '全部分类';
    let activeFolder = '全部目录';
    let activePinned = '全部';
    let activeFavorite = '全部';
    let activeTag = '全部标签';
    let pinnedKeys = readStoredKeys('aidocs:pinned');
    let favoriteKeys = readFavorites();
    let tagMap = readTagMap();
    const sourceFallback = ${JSON.stringify(sourceName)};
    const query = document.getElementById('query');
    const sortBy = document.getElementById('sortBy');
    const count = document.getElementById('count');
    const results = document.getElementById('results');
    function readStoredKeys(storageKey) {
      try {
        const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return new Set(Array.isArray(items) ? items : []);
      } catch (_) {
        return new Set();
      }
    }
    function readFavorites() {
      return readStoredKeys('aidocs:favorites');
    }
    function saveFavorites() {
      localStorage.setItem('aidocs:favorites', JSON.stringify(Array.from(favoriteKeys)));
    }
    function savePinned() {
      localStorage.setItem('aidocs:pinned', JSON.stringify(Array.from(pinnedKeys)));
    }
    function readTagMap() {
      try {
        const value = JSON.parse(localStorage.getItem('aidocs:tags') || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } catch (_) {
        return {};
      }
    }
    function saveTagMap() {
      localStorage.setItem('aidocs:tags', JSON.stringify(tagMap));
    }
    function loadExternalIndex(src) {
      return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }
    function loadLocalIndex() {
      return fetch('search-index.json?t=' + Date.now())
        .then(response => response.ok ? response.json() : [])
        .then(items => { localDocs = Array.isArray(items) ? items : []; })
        .catch(() => { localDocs = []; });
    }
    function docs() { return localDocs.concat(externalDocs); }
    function docHref(doc) {
      let href = String(doc.url || doc.path || '');
      href = href.replace(/\\.md(?=([?#]|$))/i, '.html');
      href = href.replace(/\\.sql(?=([?#]|$))/i, '.sql.html');
      return href || '#';
    }
    function docKey(doc) { return (doc.source || sourceFallback) + '|' + docHref(doc); }
    function isPinned(doc) { return pinnedKeys.has(docKey(doc)); }
    function isFavorite(doc) { return favoriteKeys.has(docKey(doc)); }
    function customTags(doc) {
      const tags = tagMap[docKey(doc)];
      return Array.isArray(tags) ? tags : [];
    }
    function togglePinned(key) {
      if (pinnedKeys.has(key)) pinnedKeys.delete(key);
      else pinnedKeys.add(key);
      savePinned();
      render();
    }
    function toggleFavorite(key) {
      if (favoriteKeys.has(key)) favoriteKeys.delete(key);
      else favoriteKeys.add(key);
      saveFavorites();
      render();
    }
    function editTags(key) {
      const current = Array.isArray(tagMap[key]) ? tagMap[key].join(', ') : '';
      const input = window.prompt('输入标签，多个用逗号、中文逗号或空格分隔；留空清除标签', current);
      if (input === null) return;
      const tags = Array.from(new Set(input.split(/[,，\\s]+/).map(item => item.trim()).filter(Boolean))).slice(0, 12);
      if (tags.length) tagMap[key] = tags;
      else delete tagMap[key];
      saveTagMap();
      render();
    }
    function unique(values) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')); }
    function group(doc) {
      if (doc.group) return doc.group;
      if ((doc.path || '').startsWith('technical-caliber/')) return '技术口径';
      if ((doc.path || '').startsWith('product-caliber/')) return '产品口径';
      return '外部文档';
    }
    function folder(doc) {
      const parts = (doc.path || '').split('/').filter(Boolean);
      if (parts.length <= 1) return '根目录';
      return parts.slice(0, Math.min(2, parts.length - 1)).join('/');
    }
    function fmt(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' });
    }
    function dateLine(doc) {
      const created = fmt(doc.createdAt);
      const updated = fmt(doc.updatedAt);
      if (created && updated) return '创建 ' + created + ' · 修改 ' + updated;
      return updated ? '修改 ' + updated : created ? '创建 ' + created : '';
    }
    function timeValue(value) {
      const time = new Date(value || 0).getTime();
      return Number.isNaN(time) ? 0 : time;
    }
    function sortDocs(items) {
      const mode = sortBy.value;
      return items.slice().sort((a, b) => {
        const pinnedDiff = Number(isPinned(b)) - Number(isPinned(a));
        if (pinnedDiff) return pinnedDiff;
        if (mode === 'created-desc') return timeValue(b.createdAt) - timeValue(a.createdAt) || String(a.path || '').localeCompare(String(b.path || ''), 'zh-CN');
        if (mode === 'title-asc') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN') || String(a.path || '').localeCompare(String(b.path || ''), 'zh-CN');
        return timeValue(b.updatedAt) - timeValue(a.updatedAt) || String(a.path || '').localeCompare(String(b.path || ''), 'zh-CN');
      });
    }
    function snippet(doc, value) {
      const text = String(doc.content || doc.title || doc.path || '').replace(/\\s+/g, ' ').trim();
      if (!text) return '';
      const needle = value.trim().toLowerCase();
      const index = needle ? text.toLowerCase().indexOf(needle) : -1;
      const start = index > 36 ? index - 36 : 0;
      const sample = text.slice(start, start + 150);
      return (start > 0 ? '...' : '') + sample + (text.length > start + 150 ? '...' : '');
    }
    function highlight(value, keyword) {
      const escaped = escapeHtmlClient(value);
      const needle = keyword.trim();
      if (!needle) return escaped;
      return escaped.replace(new RegExp(escapeRegExp(escapeHtmlClient(needle)), 'ig'), match => '<mark>' + match + '</mark>');
    }
    function escapeRegExp(value) {
      const specials = '\\\\^$.*+?()[]{}|';
      return String(value).split('').map(ch => specials.includes(ch) ? '\\\\' + ch : ch).join('');
    }
    function buttonList(el, values, active, onClick, className) {
      el.innerHTML = '';
      values.forEach(value => {
        const btn = document.createElement('button');
        btn.textContent = value;
        btn.className = (className || '') + (value === active ? ' active' : '');
        btn.onclick = () => onClick(value);
        el.appendChild(btn);
      });
    }
    function render() {
      const all = docs();
      const value = query.value.trim().toLowerCase();
      const visible = sortDocs(all
        .filter(doc => activePinned === '全部' || isPinned(doc))
        .filter(doc => activeFavorite === '全部' || isFavorite(doc))
        .filter(doc => activeTag === '全部标签' || customTags(doc).includes(activeTag))
        .filter(doc => activeSource === '全部来源' || (doc.source || sourceFallback) === activeSource)
        .filter(doc => activeGroup === '全部分类' || group(doc) === activeGroup)
        .filter(doc => activeFolder === '全部目录' || folder(doc) === activeFolder)
        .filter(doc => !value || (doc.title + ' ' + doc.path + ' ' + (doc.url || '') + ' ' + doc.type + ' ' + group(doc) + ' ' + (doc.source || '') + ' ' + customTags(doc).join(' ') + ' ' + (doc.content || '')).toLowerCase().includes(value)));
      buttonList(document.getElementById('pinned'), ['全部', '只看置顶'], activePinned, value => { activePinned = value; render(); }, 'chip');
      buttonList(document.getElementById('favorites'), ['全部', '只看收藏'], activeFavorite, value => { activeFavorite = value; render(); }, 'chip');
      buttonList(document.getElementById('tags'), ['全部标签'].concat(unique(all.flatMap(customTags))), activeTag, value => { activeTag = value; render(); }, 'chip');
      buttonList(document.getElementById('sources'), ['全部来源'].concat(unique(all.map(doc => doc.source || sourceFallback))), activeSource, value => { activeSource = value; activeGroup = '全部分类'; activeFolder = '全部目录'; render(); });
      buttonList(document.getElementById('groups'), ['全部分类'].concat(unique(all.filter(doc => activeSource === '全部来源' || (doc.source || sourceFallback) === activeSource).map(group))), activeGroup, value => { activeGroup = value; activeFolder = '全部目录'; render(); });
      buttonList(document.getElementById('folders'), ['全部目录'].concat(unique(all.filter(doc => activeSource === '全部来源' || (doc.source || sourceFallback) === activeSource).filter(doc => activeGroup === '全部分类' || group(doc) === activeGroup).map(folder))), activeFolder, value => { activeFolder = value; render(); });
      count.textContent = visible.length + ' / ' + all.length;
      results.innerHTML = visible.map(doc => {
        const sample = snippet(doc, value);
        const key = docKey(doc);
        const href = docHref(doc);
        const pinned = pinnedKeys.has(key);
        const favorite = favoriteKeys.has(key);
        const tags = customTags(doc);
        const tagsHtml = tags.length ? '<span class="tags">' + tags.map(tag => '<span class="tag">' + escapeHtmlClient(tag) + '</span>').join('') + '</span>' : '';
        return '<div class="card"><button class="quick-action favorite' + (favorite ? ' active' : '') + '" title="' + (favorite ? '取消收藏' : '收藏') + '" data-favorite="' + escapeHtmlClient(key) + '">' + (favorite ? '★' : '☆') + '</button><button class="quick-action pin' + (pinned ? ' active' : '') + '" title="' + (pinned ? '取消置顶' : '置顶') + '" data-pin="' + escapeHtmlClient(key) + '">' + (pinned ? '↑' : '↟') + '</button><button class="quick-action tag-edit' + (tags.length ? ' active' : '') + '" title="编辑标签" data-tags="' + escapeHtmlClient(key) + '">标</button><b><a href="' + escapeHtmlClient(href) + '">' + highlight(doc.title, value) + '</a></b><span class="meta">' + escapeHtmlClient(dateLine(doc)) + '</span>' + tagsHtml + '<span class="snippet">' + highlight(sample, value) + '</span><small>' + escapeHtmlClient((doc.source || sourceFallback) + ' · ' + group(doc) + ' · ' + doc.path) + '</small><em>' + escapeHtmlClient(doc.type) + '</em></div>';
      }).join('');
      results.querySelectorAll('[data-tags]').forEach(btn => {
        btn.addEventListener('click', event => {
          event.preventDefault();
          editTags(btn.getAttribute('data-tags'));
        });
      });
      results.querySelectorAll('[data-pin]').forEach(btn => {
        btn.addEventListener('click', event => {
          event.preventDefault();
          togglePinned(btn.getAttribute('data-pin'));
        });
      });
      results.querySelectorAll('[data-favorite]').forEach(btn => {
        btn.addEventListener('click', event => {
          event.preventDefault();
          toggleFavorite(btn.getAttribute('data-favorite'));
        });
      });
    }
    function escapeHtmlClient(value) {
      return String(value).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
    }
    query.addEventListener('input', render);
    sortBy.addEventListener('change', render);
    window.__AIDOCS_EXTERNAL_INDEXES__ = [];
    Promise.all([loadLocalIndex()].concat(externalIndexScripts.map(loadExternalIndex))).then(() => {
      externalDocs = (window.__AIDOCS_EXTERNAL_INDEXES__ || []).flatMap(item => item.docs || []);
      render();
    });
    render();
  </script>
</body>
</html>`, 'utf8')
}

const stats = { rendered: 0, cached: 0 }
rmrf(out)
ensureDir(out)
ensureDir(cacheRoot)

for (const source of sourceRoots) {
  const sourceDir = path.join(root, source.dir)
  for (const file of walk(sourceDir)) {
    const ext = path.extname(file).toLowerCase()
    if (ext === '.md') copyMarkdown(file, source, stats)
    else if (ext === '.html') copyHtml(file, source, stats)
    else if (ext === '.sql') copyCodeDoc(file, source, stats)
    else if (['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.css', '.js'].includes(ext)) copyAsset(file, source)
  }
}

copyRootAssets()
copyCachedPlantUmlAssets()
writeIndex()
console.log(`incremental pages build complete: rendered=${stats.rendered}, cached=${stats.cached}, docs=${docEntries.length}`)
