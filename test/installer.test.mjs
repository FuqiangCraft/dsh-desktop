import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const configUrl = new URL('../packages/dsh-desktop-rust/tauri.conf.json', import.meta.url)

test('NSIS installer stops the bundled sidecar before replacing runtime files', async () => {
  const config = JSON.parse(await readFile(configUrl, 'utf8'))
  const hookPath = config.bundle?.windows?.nsis?.installerHooks

  assert.equal(
    hookPath,
    './windows/installer-hooks.nsh',
    'the installer must register the runtime shutdown hook',
  )

  const hooks = await readFile(
    new URL(`../packages/dsh-desktop-rust/${hookPath.replace(/^\.\//, '')}`, import.meta.url),
    'utf8',
  )

  assert.match(hooks, /NSIS_HOOK_PREINSTALL/, 'the sidecar must stop before files are copied')
  assert.match(hooks, /NSIS_HOOK_PREUNINSTALL/, 'uninstall must also release runtime files')
  assert.match(hooks, /FindProcessCurrentUser\s+"dsh-node\.exe"/, 'the hook must detect the bundled Node sidecar')
  assert.match(hooks, /KillProcessCurrentUser\s+"dsh-node\.exe"/, 'the hook must terminate the bundled Node sidecar')
  assert.match(hooks, /Abort/, 'the hook must fail closed when the sidecar cannot be stopped')
})
