import { BrowserWindow, screen } from 'electron'
import { DesktopSettingsStore, type DesktopSettings } from '../runtime/settings-store.ts'

export class PetWindowManager {
  private window: BrowserWindow | null = null
  private readonly settingsStore: DesktopSettingsStore
  private moveTimer: NodeJS.Timeout | null = null

  constructor(settingsStore: DesktopSettingsStore) {
    this.settingsStore = settingsStore
  }

  public createWindow(preloadPath: string, petHtmlPath: string): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window
    }

    const savedPos = this.settingsStore.getPetPosition()
    let x = savedPos?.x
    let y = savedPos?.y

    if (x === undefined || y === undefined) {
      const primary = screen.getPrimaryDisplay()
      const workArea = primary.workArea
      x = workArea.x + workArea.width - 200
      y = workArea.y + workArea.height - 200
    }

    const win = new BrowserWindow({
      width: 160,
      height: 160,
      x,
      y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      title: '',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: false,
      roundedCorners: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    win.on('moved', () => {
      if (this.moveTimer) clearTimeout(this.moveTimer)
      this.moveTimer = setTimeout(() => {
        if (!win.isDestroyed()) {
          const [curX, curY] = win.getPosition()
          this.settingsStore.savePetPosition({ x: curX, y: curY })
        }
      }, 500)
    })

    void win.loadFile(petHtmlPath)

    this.window = win
    return win
  }

  public getWindow(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  public syncSettings(settings: DesktopSettings): void {
    if (!this.window || this.window.isDestroyed()) return

    if (settings.petEnabled) {
      if (!this.window.isVisible()) {
        this.window.showInactive()
      }
    } else {
      if (this.window.isVisible()) {
        this.window.hide()
      }
    }

    this.window.webContents.send('dsh:set-pet-character', settings.petCharacter)
    this.window.webContents.send('dsh:set-pet-size', settings.petSize)
  }

  public updateState(state: string, text = ''): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send('dsh:set-pet-state', { state, text })
  }

  public destroy(): void {
    if (this.moveTimer) {
      clearTimeout(this.moveTimer)
      this.moveTimer = null
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
      this.window = null
    }
  }
}
