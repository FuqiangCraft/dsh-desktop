import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  getDesktopSettings,
  resetDesktopSettings,
  subscribeDesktopSettings,
  updateDesktopSettings,
} from '../src/client/settings/settingsStore.ts'

test('settings store has expected default values', () => {
  resetDesktopSettings()
  const settings = getDesktopSettings()

  assert.equal(settings.petEnabled, true)
  assert.equal(settings.petCharacter, 'robot')
  assert.equal(settings.petSize, 100)
})

test('settings UI offers selectable companion characters', async () => {
  const source = await readFile(new URL('../src/client/settings/DesktopSettingsSection.tsx', import.meta.url), 'utf8')
  assert.match(source, /选择宠物/)
  assert.match(source, /id: 'robot'/)
  assert.match(source, /id: 'whale'/)
  assert.match(source, /id: 'cat'/)
  assert.match(source, /id: 'woodfish'/)
  assert.match(source, /dsh_desktop_petThumbnail/)
  assert.match(source, /petCharacter: pet\.id/, 'selection must update persistent settings')
  assert.match(source, /get_pet_resource_path/)
  assert.match(source, /open_pet_resource_folder/)
  assert.doesNotMatch(source, /alwaysOnTop|clickThrough|screenCapture|soundNotification|hotkey/)
})

test('pet previews are bundled instead of loaded from the cross-origin Tauri protocol', async () => {
  const source = await readFile(new URL('../src/client/settings/DesktopSettingsSection.tsx', import.meta.url), 'utf8')
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /http:\/\/tauri\.localhost/, 'remote DSH pages cannot load Tauri protocol thumbnails')
  assert.match(source, /import robotPreview from ['"]\.\.\/assets\/dsh-companion\.png['"]/)
  assert.match(build, /loader:\s*\{\s*['"]\.png['"]:\s*['"]dataurl['"]\s*\}/, 'preview images must be self-contained in the plugin bundle')
})

test('updating settings updates state and notifies subscribers', () => {
  resetDesktopSettings()
  let notified = null

  const unsubscribe = subscribeDesktopSettings((next) => {
    notified = next
  })

  updateDesktopSettings({
    petSize: 80,
  })

  const current = getDesktopSettings()
  assert.equal(current.petSize, 80)
  assert.equal(notified?.petSize, 80)

  unsubscribe()

  // After unsubscribe, listener is not called
  updateDesktopSettings({
    petSize: 70,
  })
  assert.equal(getDesktopSettings().petSize, 70)
  assert.equal(notified?.petSize, 80)
})

test('syncs settings with native bridge when available', () => {
  resetDesktopSettings()
  let bridgePayload = null

  globalThis.window = {
    __DSH_DESKTOP_BRIDGE__: {
      syncSettings(settings) {
        bridgePayload = settings
      },
    },
    localStorage: {
      getItem() { return null },
      setItem() {},
    },
  }

  updateDesktopSettings({
    petEnabled: false,
    petSize: 90,
  })

  assert.ok(bridgePayload !== null, 'Bridge syncSettings must be invoked')
  assert.equal(bridgePayload.petEnabled, false)
  assert.equal(bridgePayload.petSize, 90)

  delete globalThis.window
})

test('syncs character changes through Tauri when no custom bridge exists', async () => {
  const calls = []
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke(command, args) {
        calls.push({ command, args })
        return Promise.resolve()
      },
    },
    localStorage: { getItem() { return null }, setItem() {} },
  }

  updateDesktopSettings({ petCharacter: 'whale' })
  await Promise.resolve()

  assert.deepEqual(calls, [{
    command: 'sync_desktop_settings',
    args: { settings: getDesktopSettings() },
  }])
  delete globalThis.window
})
