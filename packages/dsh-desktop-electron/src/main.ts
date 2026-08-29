import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { app, ipcMain, Notification, shell } from 'electron'
import { DesktopSettingsStore, type DesktopSettings } from './runtime/settings-store.ts'
import { DesktopProfileManager } from './runtime/profile-manager.ts'
import { DesktopHostRunner } from './runtime/host-runner.ts'
import { MainWindowManager } from './windows/main-window.ts'
import { PetWindowManager } from './windows/pet-window.ts'
import { TrayMenuManager } from './windows/tray-menu.ts'
import { getCurrentDir } from './runtime/paths.ts'
import { DesktopUpdateManager } from './runtime/update-manager.ts'
import { installApplicationMenu, openApplicationSubmenu } from './windows/application-menu.ts'

const currentDir = getCurrentDir()

const startupLogPath = process.env.DSH_DESKTOP_STARTUP_LOG
  || path.join(app.getPath('logs'), 'startup.log')
function traceStartup(message: string): void {
  try {
    fs.mkdirSync(path.dirname(startupLogPath), { recursive: true })
    fs.appendFileSync(startupLogPath, `${new Date().toISOString()} ${message}\n`, 'utf8')
  } catch {
    // Startup tracing is diagnostic-only and must never block the app.
  }
}

function formatStartupError(error: unknown, depth = 0): string {
  if (depth > 6) return '[maximum error depth reached]'
  if (!(error instanceof Error)) return String(error)
  const nested = error instanceof AggregateError
    ? error.errors.map((item, index) => `aggregate[${index}]: ${formatStartupError(item, depth + 1)}`)
    : []
  const cause = error.cause ? [`cause: ${formatStartupError(error.cause, depth + 1)}`] : []
  return [error.stack || error.message, ...nested, ...cause].join('\n')
}

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock()
traceStartup(`single-instance-lock=${gotTheLock}`)
if (!gotTheLock) {
  // app.quit() before `ready` can leave a headless secondary process alive.
  // app.exit() terminates it synchronously while the primary instance handles
  // the `second-instance` event and restores its existing window.
  app.exit(0)
}

class DesktopApplication {
  private readonly settingsStore: DesktopSettingsStore
  private readonly profileManager: DesktopProfileManager
  private readonly hostRunner: DesktopHostRunner
  private readonly mainWinManager: MainWindowManager
  private readonly petWinManager: PetWindowManager
  private readonly trayMenuManager: TrayMenuManager
  private readonly updateManager: DesktopUpdateManager
  private bootPromise: Promise<boolean> | null = null
  private quitInProgress = false

  private readonly preloadPath: string
  private readonly iconPath: string
  private readonly petHtmlPath: string
  private readonly recoveryHtmlPath: string
  private readonly trayPreloadPath: string
  private readonly trayMenuHtmlPath: string
  private applicationMenu: Electron.Menu | null = null

  constructor() {
    this.settingsStore = new DesktopSettingsStore()
    this.profileManager = new DesktopProfileManager()
    this.hostRunner = new DesktopHostRunner(this.profileManager)
    this.mainWinManager = new MainWindowManager()
    this.petWinManager = new PetWindowManager(this.settingsStore)
    this.updateManager = new DesktopUpdateManager(this.mainWinManager)
    this.preloadPath = path.join(currentDir, 'preload.cjs')
    this.trayPreloadPath = path.join(currentDir, 'tray-preload.cjs')
    this.iconPath = path.join(currentDir, '../assets/icons/icon.png')
    this.petHtmlPath = path.join(currentDir, '../assets/pet/pet.html')
    this.recoveryHtmlPath = path.join(currentDir, '../assets/recovery/recovery.html')
    this.trayMenuHtmlPath = path.join(currentDir, '../assets/tray/menu.html')
    this.trayMenuManager = new TrayMenuManager(
      this.mainWinManager,
      this.petWinManager,
      this.settingsStore,
      this.updateManager,
      this.trayPreloadPath,
      this.trayMenuHtmlPath,
    )
  }

  public init(): void {
    app.on('second-instance', () => {
      this.mainWinManager.restoreWindow()
    })

    app.whenReady().then(() => this.onReady()).catch(console.error)

    app.on('window-all-closed', () => {
      // Keep app alive in tray on Windows/macOS
    })

    app.on('before-quit', (event) => {
      if (this.quitInProgress) return
      event.preventDefault()
      this.quitInProgress = true
      this.mainWinManager.setQuitting(true)
      const stop = this.hostRunner.stop().catch(() => undefined)
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500))
      void Promise.race([stop, timeout]).finally(() => app.exit(0))
    })
  }

  private registerIpcHandlers(): void {
    ipcMain.on('dsh:window-control', (_event, action: 'minimize' | 'maximize' | 'close') => {
      const win = this.mainWinManager.getWindow()
      if (!win) return
      if (action === 'minimize') win.minimize()
      else if (action === 'maximize') {
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
      }
      else win.close()
    })
    ipcMain.on('dsh:open-application-menu', (event, label: string, x: number, y: number) => {
      const win = this.mainWinManager.getWindow()
      if (win && this.applicationMenu) openApplicationSubmenu(this.applicationMenu, label, win, x, y)
    })
    ipcMain.on('dsh:notify', (_event, payload) => {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: `DeepSeek Harness · ${payload.title}`,
          body: payload.label || payload.kind,
          icon: this.iconPath,
        })
        notif.on('click', () => {
          this.mainWinManager.restoreWindow()
          const win = this.mainWinManager.getWindow()
          if (win) {
            void win.webContents.executeJavaScript(
              `window.__DSH_DESKTOP_OPEN_SESSION__?.(${JSON.stringify(payload.id)})`,
            )
          }
        })
        notif.show()
      }
    })

    ipcMain.on('dsh:sync-settings', (_event, settings: DesktopSettings) => {
      const updated = this.settingsStore.saveSettings(settings)
      this.petWinManager.syncSettings(updated)
      this.trayMenuManager.updateMenu()
    })

    ipcMain.handle('dsh:get-settings', () => {
      return this.settingsStore.getSettings()
    })

    ipcMain.on('dsh:update-pet-state', (_event, { state, text }) => {
      this.petWinManager.updateState(state, text)
    })

    ipcMain.on('dsh:sync-recent-sessions', (_event, sessions) => {
      this.trayMenuManager.setRecentSessions(sessions)
    })

    ipcMain.handle('dsh:get-pet-resource-path', () => {
      return this.settingsStore.getPetsDir()
    })

    ipcMain.handle('dsh:open-pet-resource-folder', async () => {
      const dir = this.settingsStore.getPetsDir()
      await shell.openPath(dir)
    })

    ipcMain.handle('dsh:list-pet-resources', () => {
      return this.settingsStore.listPetResources()
    })

    ipcMain.handle('dsh:read-pet-resource', (_event, name: string) => {
      return this.settingsStore.readPetResource(name)
    })

    ipcMain.handle('dsh:open-profile-dir', async () => {
      await shell.openPath(this.profileManager.paths.profileDir)
    })

    ipcMain.handle('dsh:retry-boot', async () => {
      return this.bootAndLoad()
    })

    ipcMain.handle('dsh:reset-profile', async () => {
      this.profileManager.resetProfile()
      return this.bootAndLoad()
    })

    ipcMain.handle('dsh:get-update-state', () => this.updateManager.getState())
    ipcMain.handle('dsh:check-for-updates', () => this.updateManager.checkForUpdates(false))
    ipcMain.handle('dsh:install-update', () => this.updateManager.installDownloadedUpdate())
  }

  private async onReady(): Promise<void> {
    traceStartup('app-ready')
    this.registerIpcHandlers()
    this.updateManager.init(() => this.trayMenuManager.updateMenu())

    // A pet explicitly opened during the previous run must not automatically
    // reappear on the next application launch.
    const settings = this.settingsStore.saveSettings({ petEnabled: false })

    // 1. Create windows
    this.mainWinManager.createWindow(this.preloadPath, this.iconPath)
    this.applicationMenu = installApplicationMenu(this.mainWinManager.getWindow()!, {
      onNewChat: () => {
        const win = this.mainWinManager.getWindow()
        if (win) void win.webContents.executeJavaScript('window.__DSH_DESKTOP_NEW_CHAT__?.()')
      },
      onCheckForUpdates: () => { void this.updateManager.checkForUpdates(true) },
    })
    // The companion is created lazily by syncSettings when the user enables it.
    this.petWinManager.configure(this.preloadPath, this.petHtmlPath)
    this.trayMenuManager.createTray(this.iconPath)

    // Sync initial settings to pet window (keeps it hidden by default)
    this.petWinManager.syncSettings(settings)

    // 2. Boot Host and load URL
    await this.bootAndLoad()
    traceStartup('startup-complete')
  }

  private async waitForHttpReady(origin: string, timeoutMs = 10000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const ready = await new Promise<boolean>((resolve) => {
          const req = http.get(origin, (res) => {
            res.resume()
            resolve(res.statusCode === 200)
          })
          req.on('error', () => resolve(false))
          req.setTimeout(1000, () => {
            req.destroy()
            resolve(false)
          })
        })
        if (ready) return
      } catch {
        // retry
      }
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`Web server at ${origin} did not become ready within ${timeoutMs}ms`)
  }

  private bootAndLoad(): Promise<boolean> {
    if (this.bootPromise) {
      traceStartup('host-boot-reused-in-flight')
      return this.bootPromise
    }
    this.bootPromise = this.bootAndLoadInternal().finally(() => {
      this.bootPromise = null
    })
    return this.bootPromise
  }

  private async bootAndLoadInternal(): Promise<boolean> {
    const startedAt = Date.now()
    traceStartup('host-boot-start')
    try {
      const instance = await this.hostRunner.start()
      traceStartup(`host-boot-ready origin=${instance.origin}`)
      await this.waitForHttpReady(instance.origin)
      traceStartup(`host-http-ready origin=${instance.origin}`)
      await this.mainWinManager.loadUrl(instance.origin)
      traceStartup(`host-boot-duration-ms=${Date.now() - startedAt}`)
      return true
    } catch (err: any) {
      traceStartup(`host-boot-failed error=${formatStartupError(err)}`)
      console.error('[dsh-desktop-electron] Boot failed:', err)
      await this.mainWinManager.loadRecovery(
        this.recoveryHtmlPath,
        formatStartupError(err),
      )
      traceStartup(`host-boot-failed-duration-ms=${Date.now() - startedAt}`)
      return false
    }
  }
}

if (gotTheLock) {
  const desktopApp = new DesktopApplication()
  desktopApp.init()
}
