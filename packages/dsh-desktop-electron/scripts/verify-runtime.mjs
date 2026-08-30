import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(path.join(root, 'runtime-manifest.json'), 'utf8'))
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

for (const [name, expected] of Object.entries(manifest.requiredPackages)) {
  if (expected === 'workspace') continue
  const packagePath = path.join(root, 'node_modules', ...name.split('/'), 'package.json')
  const actual = JSON.parse(await readFile(packagePath, 'utf8')).version
  if (actual !== expected) {
    throw new Error(`Runtime mismatch: ${name} expected ${expected}, found ${actual}`)
  }
}

if (packageJson.dependencies['@deepseek-ai/dsh'] !== manifest.requiredPackages['@deepseek-ai/dsh']) {
  throw new Error('Electron package.json and runtime-manifest.json are out of sync')
}

console.log(`Verified ${Object.keys(manifest.requiredPackages).length} Electron runtime packages on ${manifest.sourceLine}`)
