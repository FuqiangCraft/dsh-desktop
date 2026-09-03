import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sidecarDir = path.join(rootDir, 'packages/dsh-desktop-sidecar')
const rootManifestPath = path.join(sidecarDir, 'package.json')
const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'))
const queue = Object.keys(rootManifest.dependencies || {}).map((name) => ({ name, from: rootManifestPath, required: true }))
const visited = new Set()
const versions = new Map()
const unresolved = []

function findManifest(entry, expectedName) {
  let current = path.dirname(entry)
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, 'package.json')
    if (fs.existsSync(candidate)) {
      const manifest = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      if (manifest.name === expectedName) return { path: candidate, manifest }
    }
    current = path.dirname(current)
  }
  return null
}

function findManifestFromSearch(req, expectedName) {
  for (const base of req.resolve.paths(expectedName) || []) {
    const candidate = path.join(base, expectedName, 'package.json')
    if (!fs.existsSync(candidate)) continue
    const manifest = JSON.parse(fs.readFileSync(candidate, 'utf8'))
    if (manifest.name === expectedName) return { path: candidate, manifest }
  }
  return null
}

while (queue.length > 0) {
  const { name, from, required } = queue.shift()
  const key = `${from}\0${name}`
  if (visited.has(key)) continue
  visited.add(key)
  try {
    const req = createRequire(from)
    let found
    try {
      const manifestPath = req.resolve(`${name}/package.json`)
      found = { path: manifestPath, manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) }
    } catch {
      try {
        found = findManifest(req.resolve(name), name)
      } catch {
        found = findManifestFromSearch(req, name)
      }
    }
    if (!found) throw new Error('package manifest not found')
    const realManifestPath = fs.realpathSync(found.path)
    const packageName = typeof found.manifest.name === 'string' ? found.manifest.name : name
    const packageKey = `${packageName}@${found.manifest.version || '0.0.0'}:${realManifestPath}`
    if (versions.has(packageKey)) continue
    versions.set(packageKey, found.manifest)
    for (const child of Object.keys(found.manifest.dependencies || {})) queue.push({ name: child, from: realManifestPath, required: true })
    for (const child of Object.keys(found.manifest.optionalDependencies || {})) queue.push({ name: child, from: realManifestPath, required: false })
  } catch (error) {
    if (required) unresolved.push(`${name} from ${path.relative(rootDir, from)}: ${error.message}`)
  }
}

const manifests = [...versions.values()]
const names = new Set(manifests.map((item) => item.name).filter((name) => typeof name === 'string'))
const required = [
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-app-boot', '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-home-paths', '@deepseek-ai/dsh-launch-environment',
  '@deepseek-ai/dsh-cmdline', '@mixian/dsh-desktop-plugin',
  '@deepseek-ai/dsh-client-ui-directory-picker-native', '@deepseek-ai/dsh-host-directory-picker-native',
]
const missingRequired = required.filter((name) => !names.has(name))
const versionSets = new Map()
for (const manifest of manifests) {
  if (typeof manifest.name !== 'string' || !manifest.name.startsWith('@deepseek-ai/dsh')) continue
  if (!versionSets.has(manifest.name)) versionSets.set(manifest.name, new Set())
  versionSets.get(manifest.name).add(manifest.version)
}
const duplicateDsh = [...versionSets]
  .filter(([, set]) => set.size > 1)
  .map(([name, set]) => `${name}: ${[...set].sort().join(', ')}`)

if (unresolved.length || missingRequired.length || duplicateDsh.length) {
  if (unresolved.length) console.error('[FAIL] Unresolved production dependencies:\n' + unresolved.join('\n'))
  if (missingRequired.length) console.error('[FAIL] Missing runtime packages: ' + missingRequired.join(', '))
  if (duplicateDsh.length) console.error('[FAIL] Duplicate DSH runtime versions:\n' + duplicateDsh.join('\n'))
  process.exit(1)
}

console.log(`[verify-runtime-closure] ${manifests.length} production packages resolved; ${versionSets.size} DSH packages have one version each.`)
