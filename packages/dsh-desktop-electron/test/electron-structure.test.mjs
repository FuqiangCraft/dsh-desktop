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
})

test('assets exist and are complete', () => {
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/pet.html')), 'pet.html must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/dsh-companion.png')), 'dsh-companion.png must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/dsh-companion-whale.png')), 'dsh-companion-whale.png must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/pet/dsh-companion-cat.png')), 'dsh-companion-cat.png must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/recovery/recovery.html')), 'recovery.html must exist')
  assert.ok(fs.existsSync(path.join(rootDir, 'assets/icons/icon.png')), 'icon.png must exist')
})
