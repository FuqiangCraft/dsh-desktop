import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

test('tauri configuration has valid productName and identifier', async () => {
  const config = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  )

  assert.equal(config.productName, 'DSH Desktop')
  assert.equal(config.identifier, 'com.deepseek.harness.desktop')
  assert.equal(config.version, '0.1.0')
})

test('tauri bundle icons exist on disk', async () => {
  const config = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  )
  const iconsDir = new URL('../src-tauri/', import.meta.url).pathname

  assert.ok(Array.isArray(config.bundle.icon), 'bundle.icon must be an array')
  assert.ok(config.bundle.icon.length > 0, 'bundle.icon must have at least one icon')

  for (const iconPath of config.bundle.icon) {
    const fullPath = join(new URL('../src-tauri', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), iconPath)
    assert.ok(existsSync(fullPath), `Icon file ${iconPath} must exist on disk`)
  }
})
