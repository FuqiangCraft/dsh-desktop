import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const PLUGIN_DIR = join(ROOT, 'packages', 'dsh-desktop-plugin')

console.info('🔍 Verifying DSH plugin bundle structure...')

// 1. Check package.json
const pkgPath = join(PLUGIN_DIR, 'package.json')
assert.ok(existsSync(pkgPath), 'package.json must exist')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

assert.equal(pkg.name, '@mixian/dsh-desktop-plugin', 'package.json name must match scoped id')
assert.ok(pkg.exports && pkg.exports['.'] && pkg.exports['./client'], 'package.json must export . and ./client')

// 2. Check dsh manifest declarations
assert.ok(typeof pkg.dsh?.bundle?.patch === 'string', 'dsh.bundle.patch must be an object with string patch path')
const patchFile = join(PLUGIN_DIR, pkg.dsh.bundle.patch)
assert.ok(existsSync(patchFile), `Patch file declared in dsh.bundle (${pkg.dsh.bundle.patch}) must exist`)

// 3. Check cordis.patch.yml format
const patchContent = readFileSync(patchFile, 'utf8')
assert.ok(patchContent.includes('- insert:'), 'cordis.patch.yml must contain "- insert:" root entry')

// 4. Check dsh.plugin.json
const manifestPath = join(PLUGIN_DIR, 'dsh.plugin.json')
assert.ok(existsSync(manifestPath), 'dsh.plugin.json must exist')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
assert.equal(manifest.name, '@mixian/dsh-desktop-plugin', 'dsh.plugin.json name must match package name')

// 5. Check build artifacts in lib/
const hostLib = join(PLUGIN_DIR, 'lib', 'index.js')
const clientLib = join(PLUGIN_DIR, 'lib', 'client.js')
assert.ok(existsSync(hostLib), 'lib/index.js must exist')
assert.ok(existsSync(clientLib), 'lib/client.js must exist')

const clientContent = readFileSync(clientLib, 'utf8')
assert.ok(
  clientContent.includes('window.__ModuleLoader__.load'),
  'lib/client.js must be wrapped with window.__ModuleLoader__.load for DSH web runtime',
)

console.info('✅ Bundle verification passed: all DSH plugin and bundle requirements met!')
