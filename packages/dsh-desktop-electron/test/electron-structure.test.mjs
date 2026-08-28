import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('main.ts enforces single instance lock', () => {
  const mainTs = fs.readFileSync(path.join(rootDir, 'src/main.ts'), 'utf8')
  assert.match(
    mainTs,
    /app\.requestSingleInstanceLock\(\)/,
    'main.ts must call app.requestSingleInstanceLock()',
  )
  assert.match(
    mainTs,
    /app\.on\(['"]second-instance['"]/,
    'main.ts must handle second-instance event to restore main window',
  )
})

test('main-window.ts intercepts close event to hide window to tray', () => {
  const winTs = fs.readFileSync(path.join(rootDir, 'src/windows/main-window.ts'), 'utf8')
  assert.match(
    winTs,
    /win\.on\(['"]close['"][\s\S]*?event\.preventDefault\(\)[\s\S]*?win\.hide\(\)/,
    'Main window close event must prevent default and hide to tray unless quitting',
  )
})

test('preload.ts exposes __DSH_DESKTOP_BRIDGE__ with all required methods', () => {
  const preloadTs = fs.readFileSync(path.join(rootDir, 'src/preload.ts'), 'utf8')
  assert.match(preloadTs, /contextBridge\.exposeInMainWorld\(['"]__DSH_DESKTOP_BRIDGE__['"]/, 'Must expose __DSH_DESKTOP_BRIDGE__')
  assert.match(preloadTs, /notify\(/, 'Bridge must include notify')
  assert.match(preloadTs, /syncSettings\(/, 'Bridge must include syncSettings')
  assert.match(preloadTs, /getSettings\(/, 'Bridge must include getSettings')
  assert.match(preloadTs, /updatePetState\(/, 'Bridge must include updatePetState')
  assert.match(preloadTs, /syncRecentSessions\(/, 'Bridge must include syncRecentSessions')
  assert.match(preloadTs, /retryBoot\(/, 'Bridge must include retryBoot')
  assert.match(preloadTs, /resetProfile\(/, 'Bridge must include resetProfile')
  assert.match(preloadTs, /getUpdateState\(/, 'Bridge must include getUpdateState')
  assert.match(preloadTs, /checkForUpdates\(/, 'Bridge must include checkForUpdates')
  assert.match(preloadTs, /installUpdate\(/, 'Bridge must include installUpdate')
  assert.match(preloadTs, /onUpdateState\(/, 'Bridge must include onUpdateState')
})

test('desktop updater uses electron-updater and GitHub Releases metadata', () => {
  const updaterTs = fs.readFileSync(path.join(rootDir, 'src/runtime/update-manager.ts'), 'utf8')
  const builderConfig = fs.readFileSync(path.join(rootDir, 'electron-builder.yml'), 'utf8')

  assert.match(updaterTs, /checkForUpdates\(\)/, 'Updater must support checking for releases')
  assert.match(updaterTs, /quitAndInstall\(/, 'Updater must support restart-and-install')
  assert.match(builderConfig, /provider:\s*github/, 'Builder must publish GitHub update metadata')
  assert.match(builderConfig, /owner:\s*FuqiangCraft/, 'Builder must target the project owner')
  assert.match(builderConfig, /repo:\s*dsh-desktop/, 'Builder must target the desktop repository')
  assert.match(builderConfig, /asar:\s*true/, 'Builder must archive JavaScript dependencies to keep installation fast')
  assert.match(builderConfig, /to:\s*agent-presets/, 'Builder must ship filesystem-readable agent presets')
  assert.match(builderConfig, /lib\/client\.js/, 'Builder must unpack browser client entry bundles')
})

test('packaged host resolves web client packages from the installation anchor', () => {
  const hostRunnerTs = fs.readFileSync(path.join(rootDir, 'src/runtime/host-runner.ts'), 'utf8')
  assert.match(
    hostRunnerTs,
    /boot\([\s\S]*?pathToFileURL\(installAnchor\)\.href[\s\S]*?\)/,
    'Closed packaged runtimes must pass the installation anchor to boot()',
  )
})

test('update controls are available from the tray and a dedicated settings section', () => {
  const trayTs = fs.readFileSync(path.join(rootDir, 'src/windows/tray-menu.ts'), 'utf8')
  const pluginTs = fs.readFileSync(path.resolve(rootDir, '../dsh-desktop-plugin/src/client/index.ts'), 'utf8')
  assert.match(trayTs, /['"]检查更新['"]/, 'Tray menu must expose a check-for-updates command')
  assert.match(trayTs, /checkForUpdates\(true\)/, 'Tray update checks must provide interactive feedback')
  assert.match(pluginTs, /desktop-update/, 'App updates must have a dedicated settings section')
  assert.match(pluginTs, /AppUpdateSettingsSection/, 'Dedicated update settings UI must be registered')
})

test('assets exist and are complete', () => {
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/pet.html')), 'pet.html must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/dsh-companion.png')), 'dsh-companion.png must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/dsh-companion-whale.png')), 'dsh-companion-whale.png must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/dsh-companion-cat.png')), 'dsh-companion-cat.png must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/recovery/recovery.html')), 'recovery.html must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/icons/icon.png')), 'icon.png must exist')
})
