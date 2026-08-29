import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const main = await readFile(new URL('src/main.ts', root), 'utf8')
const paths = await readFile(new URL('src/runtime/paths.ts', root), 'utf8')
const builder = await readFile(new URL('electron-builder.yml', root), 'utf8')

test('boot requests are serialized and in-flight startup is reused', () => {
  assert.match(main, /private bootPromise: Promise<boolean> \| null = null/)
  assert.match(main, /host-boot-reused-in-flight/)
  assert.match(main, /this\.bootPromise = this\.bootAndLoadInternal\(\)\.finally/)
})

test('quit waits for host disposal before exiting', () => {
  assert.match(main, /event\.preventDefault\(\)/)
  assert.match(main, /const stop = this\.hostRunner\.stop\(\)\.catch\(\(\) => undefined\)/)
  assert.match(main, /Promise\.race\(\[stop, timeout\]\)\.finally\(\(\) => app\.exit\(0\)\)/)
})

test('CommonJS bundle path resolution does not depend on import.meta', () => {
  assert.match(paths, /createRequire\(__filename\)/)
  assert.match(paths, /return __dirname/)
  assert.doesNotMatch(paths, /import\.meta/)
})

test('Windows package keeps only supported Chromium locales', () => {
  assert.match(builder, /electronLanguages:\n  - en-US\n  - zh-CN/)
  assert.match(builder, /win32-arm64/)
  assert.match(builder, /darwin-\*/)
})

test('runtime assets required by the main process exist', async () => {
  for (const file of [
    'assets/icons/icon.png',
    'assets/pet/pet.html',
    'assets/recovery/recovery.html',
    'assets/tray/menu.html',
  ]) {
    assert.equal(existsSync(new URL(file, root)), true, file)
  }
})

test('built main process has no unresolved import.meta path code', async () => {
  const output = await readFile(new URL('dist/main.cjs', root), 'utf8')
  assert.doesNotMatch(output, /import_meta/)
  assert.ok((await stat(new URL('dist/main.cjs', root))).size > 20_000)
})
