import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const out = path.join(root, 'public')
const cacheRoot = path.join(root, '.aidocs-cache')
const rendererVersion = 'incremental-pages-v2'
const sourceRoots = [
  { dir: 'technical-caliber', label: '技术口径' },
  { dir: 'product-caliber', label: '产品口径' }
]

const docEntries = []
const ignoredPathParts = new Set(['.git', 'public', '.vitepress-work', '.aidocs-cache', 'node_modules'])
const ignoredRelativePrefixes = ['technical-caliber/startup/tools/']

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function sha(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10)
}

function fileHash(file) {
  return crypto.createHash('sha1')
    .update(rendererVersion)
    .update(fs.readFileSync(file))
    .digest('hex')
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

function renderMarkdownLite(markdownText) {
  const lines = markdownText
    .replace(/^```(?:plantuml|pre!)(?:\s+[^\r\n]*)?$/gim, '```text')
    .split(/\r?\n/)
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
        code = { lines: [] }
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
  if (code) html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`)
  return html.join('\n')
}

function pageHtml(title, body) {
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
<body><main>${body}</main></body>
</html>`
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
  const result = writeCached(file, pageRel, () => pageHtml(title, renderMarkdownLite(body)))
  stats[result.cacheHit ? 'cached' : 'rendered'] += 1
  addDoc({
    title,
    path: pageRel,
    type: 'MD',
    group: rootInfo.label,
    source: 'transportmall/aidocs',
    content: normalizeSearchText(body).slice(0, 12000),
    ...gitDates(file)
  })
}

function copyHtml(file, rootInfo, stats) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const pageRel = path.posix.join(rootInfo.dir, safe)
  const title = titleFromHtml(file)
  const body = fs.readFileSync(file, 'utf8')
  const result = writeCached(file, pageRel, () => body)
  stats[result.cacheHit ? 'cached' : 'rendered'] += 1
  addDoc({
    title,
    path: pageRel,
    type: 'HTML',
    group: rootInfo.label,
    source: 'transportmall/aidocs',
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
  const result = writeCached(file, pageRel, () => pageHtml(title, `<h1>${escapeHtml(title)}</h1>\n<pre><code>${escapeHtml(body)}</code></pre>`))
  stats[result.cacheHit ? 'cached' : 'rendered'] += 1
  addDoc({
    title,
    path: pageRel,
    type: path.extname(file).slice(1).toUpperCase(),
    group: rootInfo.label,
    source: 'transportmall/aidocs',
    content: normalizeSearchText(body).slice(0, 12000),
    ...gitDates(file)
  })
}

function copyAsset(file, rootInfo) {
  const rel = path.relative(path.join(root, rootInfo.dir), file)
  const safe = safeRelPath(rel)
  const dest = path.join(out, rootInfo.dir, safe)
  ensureDir(path.dirname(dest))
  fs.copyFileSync(file, dest)
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
    url: `/aidocs/${doc.path}`,
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
    `window.__AIDOCS_EXTERNAL_INDEXES__ = window.__AIDOCS_EXTERNAL_INDEXES__ || [];\nwindow.__AIDOCS_EXTERNAL_INDEXES__.push(${JSON.stringify({ source: 'transportmall/aidocs', docs: searchIndex })});\n`,
    'utf8'
  )

  const externalIndexFile = path.join(root, 'external-indexes.json')
  const externalIndexScripts = fs.existsSync(externalIndexFile)
    ? JSON.parse(fs.readFileSync(externalIndexFile, 'utf8')).map(item => item.script).filter(Boolean)
    : []

  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TransportMall AI Docs</title>
  <style>
    :root { --fg:#20242c; --muted:#667085; --line:#d9e0ea; --soft:#f6f8fb; --brand:#1d75d8; --active:#e8efff; }
    body { margin:0; color:var(--fg); font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#fff; }
    header { height:72px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:center; }
    header div { width:min(1120px, calc(100% - 32px)); display:flex; align-items:center; gap:24px; }
    h1 { font-size:42px; margin:54px 0 14px; }
    main { width:min(1120px, calc(100% - 32px)); margin:0 auto 64px; }
    .lead { color:var(--muted); font-size:20px; }
    .search { display:flex; align-items:center; gap:12px; margin:30px 0 20px; }
    .search input { width:min(560px, 100%); padding:12px 14px; border:1px solid var(--line); border-radius:8px; font-size:16px; }
    .count { color:var(--muted); white-space:nowrap; }
    .browser { display:grid; grid-template-columns:260px 1fr; gap:28px; }
    aside { border-right:1px solid var(--line); padding-right:18px; }
    section { margin-bottom:28px; }
    section strong { display:block; margin-bottom:10px; }
    button { display:block; width:100%; margin:6px 0; padding:9px 12px; border:0; border-radius:8px; color:var(--muted); background:transparent; text-align:left; font:inherit; cursor:pointer; }
    button.active { color:var(--brand); background:var(--active); font-weight:700; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; }
    .card { min-height:132px; display:flex; flex-direction:column; gap:8px; padding:16px; border:1px solid var(--line); border-radius:8px; color:var(--fg); text-decoration:none; background:var(--soft); }
    .card:hover { border-color:var(--brand); }
    .meta, small { color:var(--muted); font-size:12px; overflow-wrap:anywhere; }
    small { margin-top:auto; }
    em { width:fit-content; padding:2px 7px; border-radius:4px; color:var(--brand); background:#eef4ff; font-size:12px; font-style:normal; font-weight:700; }
    @media (max-width: 860px) { h1 { font-size:32px; } .browser { grid-template-columns:1fr; } aside { border-right:0; border-bottom:1px solid var(--line); padding:0 0 16px; } }
  </style>
</head>
<body>
  <header><div><strong>TransportMall AI Docs</strong></div></header>
  <main>
    <h1>TransportMall AI Docs</h1>
    <p class="lead">统一沉淀 TransportMall 相关产品口径、技术口径、研发方案和运行手册。</p>
    <div class="search"><input id="query" placeholder="搜索标题、路径、类型、来源、正文"><span id="count" class="count"></span></div>
    <div class="browser">
      <aside>
        <section><strong>来源</strong><div id="sources"></div></section>
        <section><strong>分类</strong><div id="groups"></div></section>
        <section><strong>目录</strong><div id="folders"></div></section>
      </aside>
      <div class="grid" id="results"></div>
    </div>
  </main>
  <script>
    let localDocs = [];
    const externalIndexScripts = ${JSON.stringify(externalIndexScripts)};
    let externalDocs = [];
    let activeSource = '全部来源';
    let activeGroup = '全部分类';
    let activeFolder = '全部目录';
    const query = document.getElementById('query');
    const count = document.getElementById('count');
    const results = document.getElementById('results');
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
    function buttonList(el, values, active, onClick) {
      el.innerHTML = '';
      values.forEach(value => {
        const btn = document.createElement('button');
        btn.textContent = value;
        btn.className = value === active ? 'active' : '';
        btn.onclick = () => onClick(value);
        el.appendChild(btn);
      });
    }
    function render() {
      const all = docs();
      const value = query.value.trim().toLowerCase();
      const visible = all
        .filter(doc => activeSource === '全部来源' || (doc.source || 'transportmall/aidocs') === activeSource)
        .filter(doc => activeGroup === '全部分类' || group(doc) === activeGroup)
        .filter(doc => activeFolder === '全部目录' || folder(doc) === activeFolder)
        .filter(doc => !value || (doc.title + ' ' + doc.path + ' ' + (doc.url || '') + ' ' + doc.type + ' ' + group(doc) + ' ' + (doc.source || '') + ' ' + (doc.content || '')).toLowerCase().includes(value));
      buttonList(document.getElementById('sources'), ['全部来源'].concat(unique(all.map(doc => doc.source || 'transportmall/aidocs'))), activeSource, value => { activeSource = value; activeGroup = '全部分类'; activeFolder = '全部目录'; render(); });
      buttonList(document.getElementById('groups'), ['全部分类'].concat(unique(all.filter(doc => activeSource === '全部来源' || (doc.source || 'transportmall/aidocs') === activeSource).map(group))), activeGroup, value => { activeGroup = value; activeFolder = '全部目录'; render(); });
      buttonList(document.getElementById('folders'), ['全部目录'].concat(unique(all.filter(doc => activeSource === '全部来源' || (doc.source || 'transportmall/aidocs') === activeSource).filter(doc => activeGroup === '全部分类' || group(doc) === activeGroup).map(folder))), activeFolder, value => { activeFolder = value; render(); });
      count.textContent = visible.length + ' / ' + all.length;
      results.innerHTML = visible.map(doc => '<a class="card" href="' + (doc.url || doc.path) + '"><b>' + escapeHtmlClient(doc.title) + '</b><span class="meta">' + escapeHtmlClient(dateLine(doc)) + '</span><small>' + escapeHtmlClient((doc.source || 'transportmall/aidocs') + ' · ' + group(doc) + ' · ' + doc.path) + '</small><em>' + escapeHtmlClient(doc.type) + '</em></a>').join('');
    }
    function escapeHtmlClient(value) {
      return String(value).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
    }
    query.addEventListener('input', render);
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

writeIndex()
console.log(`incremental pages build complete: rendered=${stats.rendered}, cached=${stats.cached}, docs=${docEntries.length}`)
