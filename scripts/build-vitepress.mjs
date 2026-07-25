import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const work = path.join(root, '.vitepress-work')
const src = path.join(work, 'src')
const out = path.join(root, 'public')
const vitepress = '/opt/vitepress-builder/node_modules/.bin/vitepress'
const sourceRoots = [
  { dir: 'technical-caliber', label: '技术口径' },
  { dir: 'product-caliber', label: '产品口径' }
]

const docEntries = []
const ignoredPathParts = new Set([
  '.git',
  'public',
  '.vitepress-work',
  'node_modules'
])
const ignoredRelativePrefixes = [
  'technical-caliber/startup/tools/'
]

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function sha(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10)
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

  const clean = slug || `${fallbackPrefix}-${sha(segment)}`
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

function escapeJs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function yamlString(value) {
  return JSON.stringify(String(value))
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
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => renderInline(cell.trim()))
}

function renderTable(lines) {
  const header = tableCells(lines[0])
  const body = lines.slice(2).map(tableCells)
  const headHtml = header.map(cell => `<th>${cell}</th>`).join('')
  const bodyHtml = body
    .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
    .join('\n')
  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
}

function renderMarkdownLite(markdownText) {
  const lines = markdownText.split(/\r?\n/)
  const html = []
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
        html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`)
        code = null
      } else {
        code = { lang: fence[1], lines: [] }
      }
      continue
    }

    if (code) {
      code.lines.push(line)
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
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      continue
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph()
      html.push('<hr>')
      continue
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flushParagraph()
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`)
      continue
    }

    const listItem = /^\s*[-*]\s+(.+)$/.exec(line)
    if (listItem) {
      flushParagraph()
      html.push(`<ul><li>${renderInline(listItem[1])}</li></ul>`)
      continue
    }

    const orderedItem = /^\s*\d+\.\s+(.+)$/.exec(line)
    if (orderedItem) {
      flushParagraph()
      html.push(`<ol><li>${renderInline(orderedItem[1])}</li></ol>`)
      continue
    }

    paragraph.push(line.trim())
  }

  flushParagraph()
  flushTable()
  if (code) html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`)
  return html.join('\n')
}

function shouldSkip(fullPath) {
  const rel = path.relative(root, fullPath).replace(/\\/g, '/')
  if (rel.split('/').some(part => ignoredPathParts.has(part))) return true
  return ignoredRelativePrefixes.some(prefix => rel.startsWith(prefix))
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

function renderStandaloneHtml(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; --fg: #1f2937; --muted: #6b7280; --line: #d7dde8; --soft: #f6f8fb; --brand: #2563eb; --code: #fff7ed; }
    @media (prefers-color-scheme: dark) { :root { --fg: #d8dee9; --muted: #9ca3af; --line: #374151; --soft: #111827; --brand: #60a5fa; --code: #1f2937; } body { background: #0f1117; } }
    body { margin: 0; padding: 32px 40px 56px; color: var(--fg); font: 15px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1120px; margin: 0 auto; }
    h1, h2, h3 { line-height: 1.35; margin: 1.8em 0 .7em; }
    h1 { font-size: 32px; padding-bottom: 12px; border-bottom: 2px solid var(--brand); }
    h2 { font-size: 24px; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
    h3 { font-size: 19px; }
    p, ul, ol, blockquote, pre, table { margin: 14px 0; }
    blockquote { border-left: 4px solid var(--brand); padding: 8px 14px; color: var(--muted); background: var(--soft); }
    code { padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; background: var(--code); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { overflow: auto; padding: 14px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--soft); }
    pre code { padding: 0; border: 0; background: transparent; }
    table { width: 100%; border-collapse: collapse; display: block; overflow-x: auto; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; vertical-align: top; }
    th { background: var(--soft); text-align: left; }
    img { max-width: 100%; }
    a { color: var(--brand); }
    @media (max-width: 720px) { body { padding: 20px 16px 40px; } h1 { font-size: 26px; } }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (shouldSkip(full)) continue
    if (entry.isDirectory()) {
      walk(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

function copyMarkdown(file, rootInfo) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const pageRel = path.posix.join(rootInfo.dir, safe).replace(/\\/g, '/')
  const rawRel = path.posix.join('_rendered', rootInfo.dir, safe.replace(/\.md$/i, '.html')).replace(/\\/g, '/')
  const rawDest = path.join(src, 'public', rawRel)
  const title = titleFromMarkdown(file)
  const body = fs.readFileSync(file, 'utf8')
  ensureDir(path.dirname(rawDest))
  fs.writeFileSync(rawDest, renderStandaloneHtml(title, renderMarkdownLite(body)), 'utf8')

  const wrapper = path.join(src, pageRel)
  ensureDir(path.dirname(wrapper))
  fs.writeFileSync(wrapper, `---\ntitle: ${yamlString(title)}\noutline: false\n---\n\n<div class="html-frame-wrap">\n  <iframe class="html-frame" src="/aidocs/${rawRel}" title="${escapeHtml(title)}"></iframe>\n</div>\n`, 'utf8')

  docEntries.push({
    title,
    path: pageRel.replace(/\.md$/i, '.html'),
    type: 'MD',
    group: rootInfo.label
  })
}

function copyHtml(file, rootInfo) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const pageRel = path.posix.join(rootInfo.dir, safe).replace(/\\/g, '/')
  const rawRel = path.posix.join('_html', rootInfo.dir, safe).replace(/\\/g, '/')
  const rawDest = path.join(src, 'public', rawRel)
  ensureDir(path.dirname(rawDest))
  fs.copyFileSync(file, rawDest)

  const title = titleFromHtml(file)
  const wrapper = path.join(src, pageRel.replace(/\.html$/i, '.md'))
  ensureDir(path.dirname(wrapper))
  fs.writeFileSync(wrapper, `---\ntitle: ${yamlString(title)}\noutline: false\n---\n\n<div class="html-frame-wrap">\n  <iframe class="html-frame" src="/aidocs/${rawRel}" title="${escapeHtml(title)}"></iframe>\n</div>\n`, 'utf8')

  docEntries.push({
    title,
    path: pageRel,
    type: 'HTML',
    group: rootInfo.label
  })
}

function copyCodeDoc(file, rootInfo) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(`${rel}.md`)
  const destRel = path.posix.join(rootInfo.dir, safe).replace(/\\/g, '/')
  const dest = path.join(src, destRel)
  const title = path.basename(file)
  const lang = path.extname(file).slice(1) || 'text'
  ensureDir(path.dirname(dest))
  fs.writeFileSync(dest, `---\ntitle: ${yamlString(title)}\n---\n\n# ${title}\n\n\`\`\`${lang}\n${fs.readFileSync(file, 'utf8')}\n\`\`\`\n`, 'utf8')

  docEntries.push({
    title,
    path: destRel.replace(/\.md$/i, '.html'),
    type: lang.toUpperCase(),
    group: rootInfo.label
  })
}

function copyAsset(file, rootInfo) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const dest = path.join(src, 'public', rootInfo.dir, safe)
  ensureDir(path.dirname(dest))
  fs.copyFileSync(file, dest)
}

function writeIndex() {
  const docs = docEntries.sort((a, b) => a.path.localeCompare(b.path))
  const list = docs
    .map(doc => `  { title: '${escapeJs(doc.title)}', path: '${escapeJs(doc.path)}', url: '/aidocs/${escapeJs(doc.path)}', type: '${doc.type}', group: '${escapeJs(doc.group)}', source: 'transportmall/aidocs' },`)
    .join('\n')
  const externalIndexFile = path.join(root, 'external-indexes.json')
  const externalIndexScripts = fs.existsSync(externalIndexFile)
    ? JSON.parse(fs.readFileSync(externalIndexFile, 'utf8')).map(item => item.script).filter(Boolean)
    : []

  fs.writeFileSync(path.join(src, 'index.md'), `# TransportMall AI Docs

统一沉淀 TransportMall 相关产品口径、技术口径、研发方案和运行手册。

<script setup>
import { ref, computed, onMounted } from 'vue'

const query = ref('')
const activeSource = ref('全部来源')
const activeGroup = ref('全部分类')
const activeFolder = ref('全部目录')
const localDocs = [
${list}
]
const externalDocs = ref([])
const externalIndexScripts = ${JSON.stringify(externalIndexScripts, null, 2)}

function loadExternalIndex(src) {
  return new Promise(resolve => {
    const script = document.createElement('script')
    const separator = src.includes('?') ? '&' : '?'
    script.src = src + separator + 't=' + Date.now()
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  window.__AIDOCS_EXTERNAL_INDEXES__ = []
  await Promise.all(externalIndexScripts.map(loadExternalIndex))
  externalDocs.value = (window.__AIDOCS_EXTERNAL_INDEXES__ || []).flatMap(item => item.docs || [])
})

const docs = computed(() => [...localDocs, ...externalDocs.value])

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function docGroup(doc) {
  if (doc.group) return doc.group
  if ((doc.path || '').startsWith('technical-caliber/')) return '技术口径'
  if ((doc.path || '').startsWith('product-caliber/')) return '产品口径'
  return '外部文档'
}

function docFolder(doc) {
  const parts = (doc.path || '').split('/').filter(Boolean)
  if (parts.length === 0) return '根目录'
  if (parts.length === 1) return '根目录'
  return parts[0]
}

const sources = computed(() => ['全部来源', ...uniqueSorted(docs.value.map(doc => doc.source || 'transportmall/aidocs'))])
const groups = computed(() => ['全部分类', ...uniqueSorted(docs.value
  .filter(doc => activeSource.value === '全部来源' || (doc.source || 'transportmall/aidocs') === activeSource.value)
  .map(docGroup))])
const folders = computed(() => ['全部目录', ...uniqueSorted(docs.value
  .filter(doc => activeSource.value === '全部来源' || (doc.source || 'transportmall/aidocs') === activeSource.value)
  .filter(doc => activeGroup.value === '全部分类' || docGroup(doc) === activeGroup.value)
  .map(docFolder))])

function setSource(value) {
  activeSource.value = value
  activeGroup.value = '全部分类'
  activeFolder.value = '全部目录'
}

function setGroup(value) {
  activeGroup.value = value
  activeFolder.value = '全部目录'
}

const results = computed(() => {
  const value = query.value.trim().toLowerCase()
  return docs.value
    .filter(doc => activeSource.value === '全部来源' || (doc.source || 'transportmall/aidocs') === activeSource.value)
    .filter(doc => activeGroup.value === '全部分类' || docGroup(doc) === activeGroup.value)
    .filter(doc => activeFolder.value === '全部目录' || docFolder(doc) === activeFolder.value)
    .filter(doc => {
      if (!value) return true
      return (doc.title + ' ' + doc.path + ' ' + (doc.url || '') + ' ' + doc.type + ' ' + docGroup(doc) + ' ' + (doc.source || '')).toLowerCase().includes(value)
    })
})
</script>

<div class="doc-search">
  <input v-model="query" placeholder="搜索标题、路径、类型、来源" />
  <span>{{ results.length }} / {{ docs.length }}</span>
</div>

<div class="doc-browser">
  <aside class="doc-filters">
    <section>
      <strong>来源</strong>
      <button v-for="item in sources" :key="item" :class="{ active: activeSource === item }" @click="setSource(item)">
        {{ item }}
      </button>
    </section>
    <section>
      <strong>分类</strong>
      <button v-for="item in groups" :key="item" :class="{ active: activeGroup === item }" @click="setGroup(item)">
        {{ item }}
      </button>
    </section>
    <section>
      <strong>目录</strong>
      <button v-for="item in folders" :key="item" :class="{ active: activeFolder === item }" @click="activeFolder = item">
        {{ item }}
      </button>
    </section>
  </aside>

  <div class="doc-results">
    <div class="doc-grid">
      <a v-for="doc in results" :key="(doc.source || '') + ':' + doc.path" class="doc-card" :href="doc.url || doc.path">
        <b>{{ doc.title }}</b>
        <small>{{ doc.source || 'transportmall/aidocs' }} · {{ docGroup(doc) }} · {{ doc.path }}</small>
        <em>{{ doc.type }}</em>
      </a>
    </div>
  </div>
</div>
`, 'utf8')

  const searchIndex = docs.map(doc => ({
    title: doc.title,
    path: doc.path,
    url: `/aidocs/${doc.path}`,
    type: doc.type,
    group: doc.group,
    source: 'transportmall/aidocs'
  }))
  ensureDir(path.join(src, 'public'))
  fs.writeFileSync(path.join(src, 'public', 'search-index.json'), `${JSON.stringify(searchIndex, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(src, 'public', 'search-index.js'),
    `window.__AIDOCS_EXTERNAL_INDEXES__ = window.__AIDOCS_EXTERNAL_INDEXES__ || [];\nwindow.__AIDOCS_EXTERNAL_INDEXES__.push(${JSON.stringify({ source: 'transportmall/aidocs', docs: searchIndex }, null, 2)});\n`,
    'utf8'
  )
}

function writeConfig() {
  ensureDir(path.join(src, '.vitepress', 'theme'))
  fs.writeFileSync(path.join(src, '.vitepress', 'config.mts'), `import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/aidocs/',
  lang: 'zh-CN',
  title: 'TransportMall AI Docs',
  description: 'TransportMall AI generated documents',
  cleanUrls: false,
  lastUpdated: false,
  themeConfig: {
    siteTitle: 'TransportMall AI Docs',
    outline: { label: '目录', level: [2, 3] },
    search: { provider: 'local' },
    nav: [{ text: '首页', link: '/' }]
  }
})
`, 'utf8')

  fs.writeFileSync(path.join(src, '.vitepress', 'theme.css'), `
:root {
  --vp-c-brand-1: #1d75d8;
  --vp-c-brand-2: #2563eb;
  --vp-c-brand-3: #60a5fa;
  --vp-layout-max-width: 1440px;
}

.VPDoc.has-aside .content-container { max-width: 980px; }

.doc-search {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 18px;
}

.doc-search input {
  width: min(560px, 100%);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 15px;
}

.doc-search span { color: var(--vp-c-text-2); white-space: nowrap; }

.doc-browser {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.doc-filters {
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-right: 16px;
  border-right: 1px solid var(--vp-c-divider);
}

.doc-filters section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.doc-filters strong {
  color: var(--vp-c-text-1);
  font-size: 13px;
}

.doc-filters button {
  width: 100%;
  min-height: 34px;
  border: 0;
  border-radius: 6px;
  padding: 7px 10px;
  color: var(--vp-c-text-2);
  background: transparent;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
}

.doc-filters button:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.doc-filters button.active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  font-weight: 700;
}

.doc-results {
  min-width: 0;
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.doc-card {
  min-height: 128px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  background: var(--vp-c-bg-soft);
}

.doc-card:hover { border-color: var(--vp-c-brand-1); }
.doc-card small { margin-top: auto; color: var(--vp-c-text-2); overflow-wrap: anywhere; }
.doc-card em {
  width: fit-content;
  padding: 2px 7px;
  border-radius: 4px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-default-soft);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.html-frame-wrap {
  margin-top: -8px;
  width: calc(100vw - 32px);
  max-width: none;
  margin-left: 50%;
  transform: translateX(-50%);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.html-frame {
  display: block;
  width: 100%;
  height: calc(100vh - 96px);
  min-height: 780px;
  border: 0;
  background: #fff;
}

.vp-doc:has(.html-frame-wrap) { padding-top: 0; }
.VPDoc:has(.html-frame-wrap) .container,
.VPDoc:has(.html-frame-wrap) .content,
.VPDoc:has(.html-frame-wrap) .content-container,
.VPDoc:has(.html-frame-wrap) .main { max-width: none !important; }
.VPDoc:has(.html-frame-wrap) .aside { display: none; }

@media (max-width: 860px) {
  .doc-browser {
    grid-template-columns: 1fr;
  }

  .doc-filters {
    position: static;
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
    padding-bottom: 16px;
  }
}
`, 'utf8')

  fs.writeFileSync(path.join(src, '.vitepress', 'theme', 'index.ts'), `import DefaultTheme from 'vitepress/theme'
import '../theme.css'

export default DefaultTheme
`, 'utf8')
}

rmrf(work)
rmrf(out)
ensureDir(src)
fs.symlinkSync('/opt/vitepress-builder/node_modules', path.join(src, 'node_modules'))

for (const source of sourceRoots) {
  const sourceDir = path.join(root, source.dir)
  for (const file of walk(sourceDir)) {
    const ext = path.extname(file).toLowerCase()
    if (ext === '.md') copyMarkdown(file, source)
    else if (ext === '.html') copyHtml(file, source)
    else if (['.sql'].includes(ext)) copyCodeDoc(file, source)
    else if (['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.css', '.js'].includes(ext)) copyAsset(file, source)
  }
}

writeIndex()
writeConfig()

const result = spawnSync(vitepress, ['build', src, '--outDir', out], { stdio: 'inherit' })
process.exit(result.status ?? 1)
