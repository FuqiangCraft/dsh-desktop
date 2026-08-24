import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('package metadata declarations are consistent across workspace', async () => {
  const rootPkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const pluginPkg = JSON.parse(
    await readFile(new URL('../packages/dsh-desktop-plugin/package.json', import.meta.url), 'utf8'),
  )

  assert.equal(rootPkg.author, 'FuqiangCraft')
  assert.equal(pluginPkg.author, 'FuqiangCraft')
  assert.equal(rootPkg.license, 'MIT')
  assert.equal(pluginPkg.license, 'MIT')

  assert.ok(
    rootPkg.repository.url.includes('FuqiangCraft/dsh-desktop'),
    'Root repository URL must point to FuqiangCraft/dsh-desktop',
  )
  assert.ok(
    pluginPkg.repository.url.includes('FuqiangCraft/dsh-desktop'),
    'Plugin repository URL must point to FuqiangCraft/dsh-desktop',
  )
})

test('plugin package declares essential ecosystem keywords', async () => {
  const pluginPkg = JSON.parse(
    await readFile(new URL('../packages/dsh-desktop-plugin/package.json', import.meta.url), 'utf8'),
  )

  const keywords = pluginPkg.keywords || []
  assert.ok(keywords.includes('dsh-plugin'), 'Plugin must include dsh-plugin keyword for index crawling')
  assert.ok(keywords.includes('cordis-plugin'), 'Plugin must include cordis-plugin keyword')
  assert.ok(keywords.includes('deepseek-harness'), 'Plugin must include deepseek-harness keyword')
})
