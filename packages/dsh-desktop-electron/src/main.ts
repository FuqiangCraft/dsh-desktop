import path from 'node:path'
import { app, ipcMain, Notification, shell } from 'electron'
import { DesktopSettingsStore, type DesktopSettings } from './runtime/settings-store.ts'
import { DesktopProfileManager } from './runtime/profile-manager.ts'
import { DesktopHostRunner } from './runtime/host-runner.ts'
import { MainWindowManager } from './windows/main-window.ts'
import { PetWindowManager } from './windows/pet-window.ts'
import { TrayMenuManager } from './windows/tray-menu.ts'
import { getCurrentDir } from './runtime/paths.ts'

const currentDir = getCurrentDir()

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

class DesktopApplication {
  private readonly settingsStore: DesktopSettingsStore
  private readonly profileManager: DesktopProfileManager
  private readonly hostRunner: DesktopHostRunner
  private readonly mainWinManager: MainWindowManager
  private readonly petWinManager: PetWindowManager
  private readonly trayMenuManager: TrayMenuManager

  private readonly preloadPath: string
  private readonly iconPath: string
  private readonly petHtmlPath: string
  private readonly recoveryHtmlPath: string

  constructor() {
    this.settingsStore = new DesktopSettingsStore()
    this.profileManager = new DesktopProfileManager()
    this.hostRunner = new DesktopHostRunner(this.profileManager)
    this.mainWinManager = new MainWindowManager()
    this.petWinManager = new PetWindowManager(this.settingsStore)
    this.trayMenuManager = new TrayMenuManager(
      this.mainWinManager,
      this.petWinManager,
      this.settingsStore,
    )

    this.preloadPath = path.join(currentDir, 'preload.cjs')
    this.iconPath = path.join(currentDir, '../assets/icons/icon.png')
    this.petHtmlPath = path.join(currentDir, '../assets/pet/pet.html')
    this.recoveryHtmlPath = path.join(currentDir, '../assets/recovery/recovery.html')
  }

  public init(): void {
    app.on('second-instance', () => {
      this.mainWinManager.restoreWindow()
    })

    app.whenReady().then(() => this.onReady()).catch(console.error)

    app.on('window-all-closed', () => {
      // Keep app alive in tray on Windows/macOS
    })

    app.on('before-quit', async (_e) => {
      this.mainWinManager.setQuitting(true)
      try {
        await this.hostRunner.stop()
      } catch {
        // ignore shutdown error
      }
    })
  }

  private registerIpcHandlers(): void {
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
  }

  private async onReady(): Promise<void> {
    this.registerIpcHandlers()

    // 1. Create windows
    this.mainWinManager.createWindow(this.preloadPath, this.iconPath)
    this.petWinManager.createWindow(this.preloadPath, this.petHtmlPath)
    this.trayMenuManager.createTray(this.iconPath)

    // Sync initial settings to pet window (keeps it hidden by default)
    const settings = this.settingsStore.getSettings()
    this.petWinManager.syncSettings(settings)

    // 2. Boot Host and load URL
    await this.bootAndLoad()
  }

  private async bootAndLoad(): Promise<boolean> {
    try {
      const instance = await this.hostRunner.start()
      await this.mainWinManager.loadUrl(instance.origin)
      return true
    } catch (err: any) {
      console.error('[dsh-desktop-electron] Boot failed:', err)
      await this.mainWinManager.loadRecovery(
        this.recoveryHtmlPath,
        err?.message || String(err),
      )
      return false
    }
  }
}

if (gotTheLock) {
  const desktopApp = new DesktopApplication()
  desktopApp.init()
}
