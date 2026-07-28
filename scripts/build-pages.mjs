import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const configFile = path.join(root, 'docs-build.config.json')
const config = fs.existsSync(configFile)
  ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
  : {}
const mode = process.env.AIDOCS_BUILD_MODE || config.mode || 'incremental'

const scripts = {
  incremental: 'scripts/build-incremental-pages.mjs',
  vitepress: 'scripts/build-vitepress.mjs'
}

if (!scripts[mode]) {
  console.error(`Unsupported docs build mode: ${mode}. Expected one of: ${Object.keys(scripts).join(', ')}`)
  process.exit(1)
}

console.log(`docs build mode: ${mode}`)
const result = spawnSync(process.execPath, [scripts[mode]], {
  cwd: root,
  stdio: 'inherit'
})

process.exit(result.status ?? 1)
