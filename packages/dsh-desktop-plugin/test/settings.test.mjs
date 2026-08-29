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

test('settings UI offers desktop companion characters without skin controls', async () => {
  const source = await readFile(new URL('../src/client/settings/DesktopSettingsSection.tsx', import.meta.url), 'utf8')
  assert.match(source, /id: 'robot'/)
  assert.match(source, /id: 'whale'/)
  assert.match(source, /id: 'cat'/)
  assert.doesNotMatch(source, /woodfish/)
  assert.match(source, /dsh_desktop_petThumbnail/)
  assert.match(source, /getPetResourcePath/)
  assert.match(source, /openPetResourceFolder/)

  assert.doesNotMatch(source, /PRESET_SKINS|skinTheme|get_skin_resource_path|save_skin_resource/)
})

test('pet previews are bundled instead of loaded from a cross-origin protocol', async () => {
  const source = await readFile(new URL('../src/client/settings/DesktopSettingsSection.tsx', import.meta.url), 'utf8')
  const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /https?:\/\/\w+\.localhost/, 'preview images must not load from a cross-origin protocol')
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

test('syncs character changes through the desktop bridge', async () => {
  const calls = []
  globalThis.window = {
    __DSH_DESKTOP_BRIDGE__: {
      syncSettings(settings) {
        calls.push(settings)
      },
    },
    localStorage: { getItem() { return null }, setItem() {} },
  }

  updateDesktopSettings({ petCharacter: 'whale' })
  await Promise.resolve()

  assert.deepEqual(calls, [getDesktopSettings()])
  delete globalThis.window
})
