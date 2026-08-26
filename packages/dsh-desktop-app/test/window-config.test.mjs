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

test('tray uses recent sessions and companion controls', async () => {
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')

  assert.match(main, /sync_recent_sessions/)
  assert.match(main, /"最近会话"/)
  assert.match(main, /"新建会话"/)
  assert.match(main, /"pet-toggle"/)
  assert.match(main, /"打开宠物"/)
  assert.match(main, /"隐藏宠物"/)
  assert.match(main, /sync_pet_toggle_label/)
})

test('companion pet floating window and frontend exist', async () => {
  const petHtmlPath = new URL('../frontend/pet.html', import.meta.url)
  assert.ok(existsSync(petHtmlPath), 'frontend/pet.html must exist')

  const petHtml = await readFile(petHtmlPath, 'utf8')
  assert.match(petHtml, /pointermove/, 'pet.html must distinguish dragging from pet interaction')
  assert.match(petHtml, /start_dragging_pet/, 'pet.html must remain draggable')
  assert.match(petHtml, /__DSH_SET_PET_STATE__/, 'pet.html must expose state machine updater')
  assert.doesNotMatch(petHtml, /id="menu"|data-action|新建会话|隐藏伴侣/, 'right-click menu must be removed')
  assert.doesNotMatch(petHtml, /SoundFX|AudioContext|playWoodfish|playMeow/, 'pet must be silent')
  assert.doesNotMatch(petHtml, /drop-shadow/, 'pet must not cast a drop shadow')
  assert.doesNotMatch(petHtml, /mouseenter/, 'hover must not auto-interact')
  assert.match(petHtml, /has-status/, 'interaction bubble must auto-hide')
  assert.match(petHtml, /@keyframes dance/, 'success must trigger a dance (with spin)')
  assert.match(petHtml, /is-sleeping/, 'idle pet must fall asleep')
  assert.match(petHtml, /is-spinning/, 'rapid petting must spin the pet dizzy')
  assert.match(petHtml, /SLEEP_DELAY/, 'idle sleep timeout must be configured')
  assert.match(petHtml, /read_pet_resource/, 'custom pets must load via IPC')
  assert.match(petHtml, /dsh-companion\.png/, 'pet.html must render the character asset')
  assert.match(petHtml, /__DSH_SET_PET_CHARACTER__/, 'pet.html must expose character switching')
  assert.match(petHtml, /__DSH_SET_PET_SIZE__/, 'pet.html must expose size control')
  assert.doesNotMatch(petHtml, /capsule-wrapper|pixel-wrapper|bot-wrapper/, 'legacy widget styles must be removed')
  for (const asset of ['dsh-companion.png', 'dsh-companion-whale.png', 'dsh-companion-cat.png', 'dsh-companion-woodfish.png']) {
    assert.ok(existsSync(new URL(`../frontend/${asset}`, import.meta.url)), `${asset} must exist`)
  }

  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')
  assert.match(main, /settings\.pet_character/, 'native settings sync must forward the selected character')
  assert.match(main, /WebviewWindowBuilder::new\(\s*app,\s*"pet",\s*WebviewUrl::App\("pet\.html"\.into\(\)\)/)
  assert.match(main, /\.transparent\(true\)/)
  assert.match(main, /\.always_on_top\(true\)/)
})

test('desktop companion stays off the Windows taskbar', async () => {
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')
  const petWindow = main.match(/WebviewWindowBuilder::new\([\s\S]*?"pet"[\s\S]*?\.build\(\)\?/)?.[0] ?? ''

  assert.match(petWindow, /\.skip_taskbar\(true\)/, 'the companion is a utility surface, not a second taskbar window')
})

test('every tray action restores a hidden or minimized main window', async () => {
  const main = await readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8')
  const helper = main.match(/fn restore_main_window[\s\S]*?\n}/)?.[0] ?? ''

  assert.match(helper, /window\.show\(\)/, 'restoring a hidden window must show it')
  assert.match(helper, /window\.unminimize\(\)/, 'show alone does not restore a minimized Windows window')
  assert.match(helper, /window\.set_focus\(\)/, 'the restored window must be foregrounded')
  assert.match(main, /"new-chat" => \{\s*restore_main_window\(app, true\)/)
})

test('capability grants both main and pet windows IPC access to all commands', async () => {
  const capabilityPath = new URL('../src-tauri/capabilities/default.json', import.meta.url)
  assert.ok(existsSync(capabilityPath), 'src-tauri/capabilities/default.json must exist')

  const capability = JSON.parse(await readFile(capabilityPath, 'utf8'))

  assert.ok(capability.windows?.includes('main'), 'capability must apply to main window')
  assert.ok(capability.windows?.includes('pet'), 'capability must apply to pet window')
  assert.ok(
    capability.remote?.urls?.some((url) => url.includes('127.0.0.1:3080')),
    'capability must grant the remote dsh origin (http://127.0.0.1:3080) access to IPC',
  )

  const expectedCommands = [
    'sync_recent_sessions',
    'retry_spawn_dsh',
    'sync_desktop_settings',
    'get_pet_resource_path',
    'open_pet_resource_folder',
    'list_pet_resources',
    'read_pet_resource',
    'update_pet_state',
    'start_dragging_pet',
  ]

  for (const command of expectedCommands) {
    const permission = `allow-${command.replaceAll('_', '-')}`
    assert.ok(
      capability.permissions?.includes(permission),
      `capability must grant ${permission}`,
    )
  }

  const buildRs = await readFile(new URL('../src-tauri/build.rs', import.meta.url), 'utf8')
  for (const command of expectedCommands) {
    assert.match(buildRs, new RegExp(`"${command}"`), `build.rs must declare ${command}`)
  }
})
