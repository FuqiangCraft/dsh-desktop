import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DesktopSettingsStore } from '../dist/runtime/settings-store.js'

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-settings-test-'))
  try {
    fn(tempDir)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('DesktopSettingsStore returns default settings when unconfigured', () => {
  withTempDir((tempDir) => {
    const store = new DesktopSettingsStore(tempDir)
    const settings = store.getSettings()

    assert.equal(settings.petEnabled, false, 'Pet must be disabled by default')
    assert.equal(settings.petCharacter, 'robot')
    assert.equal(settings.petSize, 100)
  })
})

test('DesktopSettingsStore updates and persists settings with value clamping', () => {
  withTempDir((tempDir) => {
    const store = new DesktopSettingsStore(tempDir)
    const updated = store.saveSettings({
      petEnabled: true,
      petCharacter: 'whale',
      petSize: 200, // Should clamp to 140
    })

    assert.equal(updated.petEnabled, true)
    assert.equal(updated.petCharacter, 'whale')
    assert.equal(updated.petSize, 140, 'petSize must be clamped to max 140')

    // Create a new store instance pointing to same dir to verify persistence
    const store2 = new DesktopSettingsStore(tempDir)
    const loaded = store2.getSettings()
    assert.deepEqual(loaded, updated)
  })
})

test('DesktopSettingsStore persists and loads pet window position', () => {
  withTempDir((tempDir) => {
    const store = new DesktopSettingsStore(tempDir)
    assert.equal(store.getPetPosition(), null, 'Initial position should be null')

    store.savePetPosition({ x: 350, y: 450 })

    const store2 = new DesktopSettingsStore(tempDir)
    assert.deepEqual(store2.getPetPosition(), { x: 350, y: 450 })
  })
})

test('DesktopSettingsStore lists and reads custom pet resources', () => {
  withTempDir((tempDir) => {
    const store = new DesktopSettingsStore(tempDir)
    const petsDir = store.getPetsDir()

    const samplePng = Buffer.from('89504e470d0a1a0a', 'hex')
    fs.writeFileSync(path.join(petsDir, 'custom-dragon.png'), samplePng)

    const list = store.listPetResources()
    assert.ok(list.includes('custom-dragon'), 'Custom pet should be discovered')

    const dataUrl = store.readPetResource('custom-dragon')
    assert.ok(dataUrl?.startsWith('data:image/png;base64,'), 'Should return base64 data url')
  })
})
