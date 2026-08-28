import { app, BrowserWindow, ipcMain, nativeImage, screen, Tray } from 'electron'
import type { MainWindowManager } from './main-window.ts'
import type { PetWindowManager } from './pet-window.ts'
import type { DesktopSettingsStore, RecentSession } from '../runtime/settings-store.ts'
import type { DesktopUpdateManager } from '../runtime/update-manager.ts'

export class TrayMenuManager {
  private tray: Tray | null = null
  private popup: BrowserWindow | null = null
  private recentSessions: RecentSession[] = []

  constructor(
    private readonly mainWinManager: MainWindowManager,
    private readonly petWinManager: PetWindowManager,
    private readonly settingsStore: DesktopSettingsStore,
    private readonly updateManager: DesktopUpdateManager,
    private readonly preloadPath: string,
    private readonly menuHtmlPath: string,
  ) {
    ipcMain.on('dsh:tray-menu-action', this.handleAction)
  }

  public createTray(iconPath: string): Tray {
    if (this.tray) return this.tray
    let image = nativeImage.createFromPath(iconPath)
    if (image.isEmpty()) image = nativeImage.createEmpty()
    this.tray = new Tray(image)
    this.tray.setToolTip('DeepSeek Harness 桌面版')
    this.tray.on('click', () => this.mainWinManager.restoreWindow())
    this.tray.on('double-click', () => this.mainWinManager.restoreWindow())
    this.tray.on('right-click', () => this.togglePopup())
    return this.tray
  }

  public setRecentSessions(sessions: RecentSession[]): void {
    this.recentSessions = sessions.slice(0, 5)
    this.updateMenu()
  }

  public updateMenu(): void {
    if (!this.popup || this.popup.isDestroyed()) return
    const settings = this.settingsStore.getSettings()
    const update = this.updateManager.getState()
    const updateLabel = update.phase === 'downloading'
      ? `正在下载更新 ${update.percent || 0}%`
      : update.phase === 'downloaded'
        ? `重启安装 ${update.availableVersion || '新版本'}`
        : update.phase === 'checking' ? '正在检查更新…' : '检查更新'
    this.popup.webContents.send('dsh:tray-menu-state', {
      petLabel: settings.petEnabled ? '隐藏宠物' : '打开宠物',
      updateLabel,
      updateDisabled: update.phase === 'checking' || update.phase === 'downloading',
      sessions: this.recentSessions.map(({ id, title }) => ({ id, title: title.slice(0, 42) })),
    })
  }

  private ensurePopup(): BrowserWindow {
    if (this.popup && !this.popup.isDestroyed()) return this.popup
    this.popup = new BrowserWindow({
      width: 256, height: 284, show: false, frame: false, transparent: true,
      resizable: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#00000000',
      webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false },
    })
    this.popup.on('blur', () => this.popup?.hide())
    this.popup.on('closed', () => { this.popup = null })
    this.popup.webContents.on('did-finish-load', () => this.updateMenu())
    void this.popup.loadFile(this.menuHtmlPath)
    return this.popup
  }

  private togglePopup(): void {
    const popup = this.ensurePopup()
    if (popup.isVisible()) { popup.hide(); return }
    const trayBounds = this.tray?.getBounds()
    const cursor = screen.getCursorScreenPoint()

    const hasValidTray = !!(trayBounds && trayBounds.width > 0 && trayBounds.x > 0)
    const anchorX = hasValidTray ? trayBounds.x + trayBounds.width / 2 : cursor.x
    const anchorY = hasValidTray ? trayBounds.y : cursor.y
    const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY })
    const [width, height] = popup.getSize()

    let x = anchorX - width / 2
    if (x + width > display.workArea.x + display.workArea.width - 8) {
      x = display.workArea.x + display.workArea.width - width - 8
    }
    if (x < display.workArea.x + 8) {
      x = display.workArea.x + 8
    }

    let y = anchorY - height - 4
    if (y < display.workArea.y) {
      y = (hasValidTray ? trayBounds.y + trayBounds.height : anchorY) + 4
    }
    if (y + height > display.workArea.y + display.workArea.height) {
      y = display.workArea.y + display.workArea.height - height - 4
    }

    popup.setPosition(Math.round(x), Math.round(y), false)
    this.updateMenu()
    popup.show()
    popup.focus()
  }

  private handleAction = (event: Electron.IpcMainEvent, action: string, payload?: string): void => {
    if (!this.popup || event.sender !== this.popup.webContents) return
    this.popup.hide()
    if (action === 'open') this.mainWinManager.restoreWindow()
    if (action === 'new-chat') this.runInMain('window.__DSH_DESKTOP_NEW_CHAT__?.()')
    if (action === 'session' && payload) this.runInMain(`window.__DSH_DESKTOP_OPEN_SESSION__?.(${JSON.stringify(payload)})`)
    if (action === 'update') {
      const update = this.updateManager.getState()
      if (update.phase === 'downloaded') void this.updateManager.installDownloadedUpdate()
      else void this.updateManager.checkForUpdates(true)
    }
    if (action === 'pet') {
      const settings = this.settingsStore.getSettings()
      const updated = this.settingsStore.saveSettings({ petEnabled: !settings.petEnabled })
      this.petWinManager.syncSettings(updated)
      this.updateMenu()
    }
    if (action === 'quit') {
      this.mainWinManager.setQuitting(true)
      app.quit()
    }
  }

  private runInMain(script: string): void {
    this.mainWinManager.restoreWindow()
    const win = this.mainWinManager.getWindow()
    if (win) void win.webContents.executeJavaScript(script)
  }

  public destroy(): void {
    ipcMain.off('dsh:tray-menu-action', this.handleAction)
    if (this.popup && !this.popup.isDestroyed()) this.popup.destroy()
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy()
    this.popup = null
    this.tray = null
  }
}
