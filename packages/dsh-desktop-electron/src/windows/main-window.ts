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
      title: 'DeepSeek Harness Desktop',
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(`[main-window did-fail-load] code=${errorCode} desc=${errorDescription} url=${validatedURL} mainFrame=${isMainFrame}`)
    })
    win.webContents.on('preload-error', (_event, path, error) => {
      console.error(`[main-window preload-error] path=${path} error=`, error)
    })
    win.webContents.on('did-finish-load', () => {
      console.log('[main-window did-finish-load]')
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

  public async loadUrl(url: string, maxAttempts = 15, delayMs = 300): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      let lastError: any = null
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.window.loadURL(url)
          if (!this.window.isVisible()) {
            this.window.show()
          }
          return
        } catch (err: any) {
          lastError = err
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        }
      }
      throw lastError
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
