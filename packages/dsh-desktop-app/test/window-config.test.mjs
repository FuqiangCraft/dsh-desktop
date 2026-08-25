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
  assert.equal(config.version, '0.1.1')
})

test('tauri bundle icons exist on disk', async () => {
  const config = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  )

  assert.ok(Array.isArray(config.bundle.icon), 'bundle.icon must be an array')
  assert.ok(config.bundle.icon.length > 0, 'bundle.icon must have at least one icon')

  for (const iconPath of config.bundle.icon) {
    const fullPath = join(new URL('../src-tauri', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), iconPath)
    assert.ok(existsSync(fullPath), `Icon file ${iconPath} must exist on disk`)
  }
})

test('tray uses recent sessions instead of an attention HUD', async () => {
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')
  const frontend = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8')

  assert.match(main, /sync_recent_sessions/)
  assert.match(main, /"最近会话"/)
  assert.match(main, /"新建会话"/)
  assert.doesNotMatch(main, /WebviewWindowBuilder::new\(app, "hud"/)
  assert.doesNotMatch(main, /toggle_hud|report_pending_interaction/)
  assert.doesNotMatch(frontend, /DeepSeek Attention HUD|0 pending|Esc to close/)
})

test('every tray action restores a hidden or minimized main window', async () => {
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')
  const helper = main.match(/fn restore_main_window[\s\S]*?\n}/)?.[0] ?? ''

  assert.match(helper, /window\.show\(\)/, 'restoring a hidden window must show it')
  assert.match(helper, /window\.unminimize\(\)/, 'show alone does not restore a minimized Windows window')
  assert.match(helper, /window\.set_focus\(\)/, 'the restored window must be foregrounded')
  assert.match(main, /"new-chat" => \{\s*restore_main_window\(app, true\)/)
})

test('capability grants the embedded dsh origin IPC access to the app commands', async () => {
  // Regression: Tauri v2 denies ALL IPC from remote origins unless a capability
  // explicitly grants the command with a matching `remote.urls`. The dsh web UI
  // runs at the remote origin http://127.0.0.1:3080, so without this capability
  // the tray recent-sessions sync (sync_recent_sessions) silently never fires.
  const capabilityPath = new URL('../src-tauri/capabilities/default.json', import.meta.url)
  assert.ok(existsSync(capabilityPath), 'src-tauri/capabilities/default.json must exist (remote-origin IPC is denied without it)')

  const capability = JSON.parse(await readFile(capabilityPath, 'utf8'))

  assert.ok(capability.windows?.includes('main'), 'capability must apply to the main window')
  assert.ok(
    capability.remote?.urls?.some((url) => url.includes('127.0.0.1:3080')),
    'capability must grant the remote dsh origin (http://127.0.0.1:3080) access to IPC',
  )

  for (const command of ['sync_recent_sessions', 'retry_spawn_dsh']) {
    const permission = `allow-${command.replaceAll('_', '-')}`
    assert.ok(
      capability.permissions?.includes(permission),
      `capability must grant ${permission}`,
    )
  }

  // App-command permissions are only referenceable once build.rs declares an
  // app ACL manifest listing them; without it the capability fails validation.
  const buildRs = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8')
  assert.match(
    buildRs,
    /AppManifest::new\(\)[\s\S]*\.commands\(&\[[^\]]*"sync_recent_sessions"[\s\S]*"retry_spawn_dsh"/,
    'build.rs must declare an app ACL manifest listing both app commands',
  )
})
