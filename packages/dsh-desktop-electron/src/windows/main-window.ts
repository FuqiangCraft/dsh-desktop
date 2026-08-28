import { BrowserWindow, shell } from 'electron'

export class MainWindowManager {
  private window: BrowserWindow | null = null
  private isQuitting = false

  public createWindow(preloadPath: string, iconPath?: string): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      return this.window
    }

    const win = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 800,
      minHeight: 600,
      show: false,
      title: 'DeepSeek Harness 桌面版',
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    // Handle close button: hide window instead of quitting unless app is quitting
    win.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault()
        win.hide()
      }
    })

    // Open target=_blank links in default external browser
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    this.window = win
    return win
  }

  public getWindow(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  public async loadUrl(url: string): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      await this.window.loadURL(url)
      if (!this.window.isVisible()) {
        this.window.show()
      }
    }
  }

  public async loadRecovery(recoveryHtmlPath: string, error?: string): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      const targetUrl = `file://${recoveryHtmlPath}${error ? `?error=${encodeURIComponent(error)}` : ''}`
      await this.window.loadURL(targetUrl)
      if (!this.window.isVisible()) {
        this.window.show()
      }
    }
  }

  public restoreWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) {
        this.window.restore()
      }
      if (!this.window.isVisible()) {
        this.window.show()
      }
      this.window.focus()
    }
  }

  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting
  }

  public destroy(): void {
    this.isQuitting = true
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
      this.window = null
    }
  }
}
