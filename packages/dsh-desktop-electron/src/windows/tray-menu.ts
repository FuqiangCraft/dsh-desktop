import { Tray, Menu, type MenuItemConstructorOptions, nativeImage, app } from 'electron'
import type { MainWindowManager } from './main-window.ts'
import type { PetWindowManager } from './pet-window.ts'
import type { DesktopSettingsStore, RecentSession } from '../runtime/settings-store.ts'
import type { DesktopUpdateManager } from '../runtime/update-manager.ts'

export class TrayMenuManager {
  private tray: Tray | null = null
  private recentSessions: RecentSession[] = []
  private readonly mainWinManager: MainWindowManager
  private readonly petWinManager: PetWindowManager
  private readonly settingsStore: DesktopSettingsStore
  private readonly updateManager: DesktopUpdateManager

  constructor(
    mainWinManager: MainWindowManager,
    petWinManager: PetWindowManager,
    settingsStore: DesktopSettingsStore,
    updateManager: DesktopUpdateManager,
  ) {
    this.mainWinManager = mainWinManager
    this.petWinManager = petWinManager
    this.settingsStore = settingsStore
    this.updateManager = updateManager
  }

  public createTray(iconPath: string): Tray {
    if (this.tray) return this.tray

    let image = nativeImage.createFromPath(iconPath)
    if (image.isEmpty()) {
      image = nativeImage.createEmpty()
    }

    this.tray = new Tray(image)
    this.tray.setToolTip('DeepSeek Harness 桌面版')

    this.tray.on('click', () => {
      this.mainWinManager.restoreWindow()
    })

    this.tray.on('double-click', () => {
      this.mainWinManager.restoreWindow()
    })

    this.updateMenu()
    return this.tray
  }

  public setRecentSessions(sessions: RecentSession[]): void {
    this.recentSessions = sessions.slice(0, 5)
    this.updateMenu()
  }

  public updateMenu(): void {
    if (!this.tray) return

    const settings = this.settingsStore.getSettings()
    const petLabel = settings.petEnabled ? '隐藏宠物' : '打开宠物'
    const update = this.updateManager.getState()
    const updateLabel = update.phase === 'downloading'
      ? `正在下载更新 ${update.percent || 0}%`
      : update.phase === 'downloaded'
        ? `重启安装 ${update.availableVersion || '新版本'}`
        : update.phase === 'checking'
          ? '正在检查更新…'
          : '检查更新'

    const recentSubmenu: MenuItemConstructorOptions[] = []
    if (this.recentSessions.length === 0) {
      recentSubmenu.push({
        label: '暂无最近会话',
        enabled: false,
      })
    } else {
      for (const session of this.recentSessions) {
        const title = session.title.slice(0, 42)
        recentSubmenu.push({
          label: title,
          click: () => {
            this.mainWinManager.restoreWindow()
            const win = this.mainWinManager.getWindow()
            if (win) {
              void win.webContents.executeJavaScript(
                `window.__DSH_DESKTOP_OPEN_SESSION__?.(${JSON.stringify(session.id)})`,
              )
            }
          },
        })
      }
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开 DeepSeek Harness 桌面版',
        click: () => {
          this.mainWinManager.restoreWindow()
        },
      },
      {
        label: '新建会话',
        click: () => {
          this.mainWinManager.restoreWindow()
          const win = this.mainWinManager.getWindow()
          if (win) {
            void win.webContents.executeJavaScript(
              `window.__DSH_DESKTOP_NEW_CHAT__?.()`,
            )
          }
        },
      },
      {
        label: '最近会话',
        submenu: recentSubmenu,
      },
      { type: 'separator' },
      {
        label: updateLabel,
        enabled: update.phase !== 'checking' && update.phase !== 'downloading',
        click: () => {
          if (update.phase === 'downloaded') void this.updateManager.installDownloadedUpdate()
          else void this.updateManager.checkForUpdates(true)
        },
      },
      { type: 'separator' },
      {
        label: petLabel,
        click: () => {
          const nextEnabled = !settings.petEnabled
          const updated = this.settingsStore.saveSettings({ petEnabled: nextEnabled })
          this.petWinManager.syncSettings(updated)
          this.updateMenu()
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.mainWinManager.setQuitting(true)
          app.quit()
        },
      },
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
