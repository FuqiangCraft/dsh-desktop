import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DesktopProfileManager } from '../dist/runtime/profile-manager.js'

function withTempDir(fn) {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-profile-test-'))
  try {
    fn(tempHome)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
}

test('DesktopProfileManager initializes isolated desktop profile with default bundles and patches', () => {
  withTempDir((tempHome) => {
    const manager = new DesktopProfileManager(tempHome)
    manager.ensureProfile()

    assert.ok(fs.existsSync(manager.paths.profileDir), 'Profile directory must exist')
    assert.ok(fs.existsSync(manager.paths.manifestPath), 'Profile package.json must exist')
    assert.ok(fs.existsSync(manager.paths.patchPath), 'Profile cordis.patch.yml must exist')
    assert.ok(fs.existsSync(manager.paths.rootConfigPath), 'Profile cordis.yml must exist')

    const manifest = JSON.parse(fs.readFileSync(manager.paths.manifestPath, 'utf8'))
    assert.deepEqual(
      manifest.dsh?.profile?.bundles,
      ['@deepseek-ai/dsh-web-app', '@mixian/dsh-desktop-plugin'],
      'Desktop profile must include web-app and desktop plugin bundles',
    )

    const patchContent = fs.readFileSync(manager.paths.patchPath, 'utf8')
    assert.match(patchContent, /openBrowser:\s*false/, 'Must disable external browser opening')
    assert.match(patchContent, /printUrl:\s*false/, 'Must disable printing url')
    assert.match(patchContent, /directory-picker-browse/, 'Must use in-app browse picker')
  })
})

test('DesktopProfileManager can recover from checkpoint when profile is damaged', () => {
  withTempDir((tempHome) => {
    const manager = new DesktopProfileManager(tempHome)
    manager.ensureProfile()

    // Corrupt the profile files
    fs.writeFileSync(manager.paths.manifestPath, 'invalid json content', 'utf8')
    fs.writeFileSync(manager.paths.patchPath, 'corrupted yaml', 'utf8')

    // Restore
    const restored = manager.restoreFromCheckpoint()
    assert.equal(restored, true, 'Should restore from checkpoint')

    const manifest = JSON.parse(fs.readFileSync(manager.paths.manifestPath, 'utf8'))
    assert.deepEqual(
      manifest.dsh?.profile?.bundles,
      ['@deepseek-ai/dsh-web-app', '@mixian/dsh-desktop-plugin'],
    )
  })
})

test('DesktopProfileManager resetProfile resets to factory default template', () => {
  withTempDir((tempHome) => {
    const manager = new DesktopProfileManager(tempHome)
    manager.ensureProfile()

    // Overwrite manifest with custom bundles
    fs.writeFileSync(
      manager.paths.manifestPath,
      JSON.stringify({ dsh: { profile: { bundles: ['custom-bundle'] } } }),
      'utf8',
    )

    manager.resetProfile()

    const manifest = JSON.parse(fs.readFileSync(manager.paths.manifestPath, 'utf8'))
    assert.deepEqual(
      manifest.dsh?.profile?.bundles,
      ['@deepseek-ai/dsh-web-app', '@mixian/dsh-desktop-plugin'],
    )
  })
})
