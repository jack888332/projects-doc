import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/\//g, '\\')
const srcRoot = join(root, 'src')
const files = []

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (/\.(vue|js|ts)$/.test(entry.name)) files.push(path)
  }
}

await collect(srcRoot)

const directDbRefs = []
const largeFiles = []
let tableFrameUses = 0
let legacyPaginationUses = 0

for (const file of files) {
  const content = await readFile(file, 'utf8')
  const name = relative(root, file).replaceAll('\\', '/')
  const lines = content.split(/\r?\n/).length
  if (lines > 300) largeFiles.push(`${name} (${lines} lines)`)
  tableFrameUses += (content.match(/<DataTableFrame\b/g) || []).length
  if (!name.startsWith('src/shared/components/DataTableFrame.vue')) {
    legacyPaginationUses += (content.match(/<TablePagination\b/g) || []).length
  }
  if (!name.startsWith('src/data/') && /(?:from|import\()\s*['"].*prototypeDb/.test(content)) {
    directDbRefs.push(name)
  }
}

console.log(`[architecture] DataTableFrame usages: ${tableFrameUses}`)
console.log(`[architecture] legacy TablePagination usages outside frame: ${legacyPaginationUses}`)
if (largeFiles.length) console.log(`[architecture] large files: ${largeFiles.join(', ')}`)

if (directDbRefs.length) {
  console.error(`[architecture] direct prototypeDb references outside src/data: ${directDbRefs.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('[architecture] data boundary: OK')
}
