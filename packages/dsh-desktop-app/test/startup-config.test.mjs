import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('the Rust-owned DSH server is not also a Tauri dev-server prerequisite', async () => {
  const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')

  assert.match(main, /spawn_server\(\)/, 'this test applies while Rust owns the DSH server lifecycle')
  assert.equal(
    config.build.devUrl,
    undefined,
    'devUrl makes Tauri wait for DSH before Rust gets a chance to start DSH',
  )
})

test('the tray icon is registered by exactly one layer', async () => {
  const config = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')
  const configOwnsTray = config.app.trayIcon !== undefined
  const rustOwnsTray = main.includes('TrayIconBuilder::new()')

  assert.notEqual(
    configOwnsTray && rustOwnsTray,
    true,
    'tauri.conf.json and Rust must not both create a tray icon',
  )
  assert.equal(configOwnsTray || rustOwnsTray, true, 'one layer must create the tray icon')
})
