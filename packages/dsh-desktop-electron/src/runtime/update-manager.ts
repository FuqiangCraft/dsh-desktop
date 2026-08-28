import fs from 'node:fs'
import path from 'node:path'
import { app, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import type { MainWindowManager } from '../windows/main-window.ts'

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'

export interface DesktopUpdateState {
  phase: UpdatePhase
  currentVersion: string
  availableVersion?: string
  percent?: number
  message?: string
}

function formatUpdateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/Cannot find latest\.yml|latest\.yml.*404|404.*latest\.yml/i.test(raw)) {
    return '更新服务尚未发布完整的版本文件，请稍后重试或前往 GitHub Releases 手动下载。'
  }
  if (/net::ERR_|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(raw)) {
    return '无法连接更新服务器，请检查网络后重试。'
  }
  return raw.split('\n', 1)[0] || '检查更新失败'
}

export class DesktopUpdateManager {
  private readonly mainWindowManager: MainWindowManager
  private state: DesktopUpdateState
  private onStateChange: (() => void) | null = null
  private interactiveCheck = false

  constructor(mainWindowManager: MainWindowManager) {
    this.mainWindowManager = mainWindowManager
    this.state = { phase: 'idle', currentVersion: app.getVersion() }
  }

  public init(onStateChange?: () => void): void {
    this.onStateChange = onStateChange || null
    if (!app.isPackaged) return

    const { autoUpdater } = electronUpdater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = this.createLogger()

    autoUpdater.on('checking-for-update', () => {
      this.setState({ phase: 'checking', message: '正在检查更新…' })
    })
    autoUpdater.on('update-available', (info) => {
      this.setState({ phase: 'available', availableVersion: info.version, message: `发现新版本 ${info.version}` })
    })
    autoUpdater.on('download-progress', (progress) => {
      this.setState({ phase: 'downloading', percent: Math.round(progress.percent), message: `正在下载 ${Math.round(progress.percent)}%` })
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.setState({ phase: 'downloaded', availableVersion: info.version, percent: 100, message: `版本 ${info.version} 已下载` })
    })
    autoUpdater.on('update-not-available', async () => {
      this.setState({ phase: 'up-to-date', message: '当前已是最新版本' })
      if (this.interactiveCheck) {
        await dialog.showMessageBox({ type: 'info', title: '检查更新', message: '当前已是最新版本', detail: `当前版本：${app.getVersion()}` })
      }
      this.interactiveCheck = false
    })
    autoUpdater.on('error', async (error) => {
      const message = formatUpdateError(error)
      this.setState({ phase: 'error', message })
      if (this.interactiveCheck) {
        await dialog.showMessageBox({ type: 'error', title: '更新失败', message: '无法检查或下载更新', detail: message })
      }
      this.interactiveCheck = false
    })
  }

  public getState(): DesktopUpdateState {
    return { ...this.state }
  }

  public async checkForUpdates(interactive = false): Promise<DesktopUpdateState> {
    if (!app.isPackaged) {
      this.setState({ phase: 'error', message: '开发模式不支持自动更新' })
      return this.getState()
    }
    if (this.state.phase === 'checking' || this.state.phase === 'downloading') return this.getState()
    this.interactiveCheck = interactive
    try {
      await electronUpdater.autoUpdater.checkForUpdates()
    } catch (error) {
      const message = formatUpdateError(error)
      this.setState({ phase: 'error', message })
    }
    return this.getState()
  }

  public async installDownloadedUpdate(): Promise<boolean> {
    if (this.state.phase !== 'downloaded') return false
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['立即重启安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
      title: '安装更新',
      message: `DeepSeek Harness 桌面版 ${this.state.availableVersion || ''} 已下载完成`,
      detail: '应用将关闭、完成安装并重新启动。',
    })
    if (result.response !== 0) return false
    this.mainWindowManager.setQuitting(true)
    electronUpdater.autoUpdater.quitAndInstall(false, true)
    return true
  }

  private setState(patch: Partial<DesktopUpdateState>): void {
    this.state = { ...this.state, ...patch, currentVersion: app.getVersion() }
    const win = this.mainWindowManager.getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('dsh:update-state', this.getState())
    this.onStateChange?.()
  }

  private createLogger() {
    const logPath = path.join(app.getPath('logs'), 'updater.log')
    const write = (level: string, values: unknown[]) => {
      try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true })
        const message = values.map((value) => value instanceof Error ? value.stack || value.message : String(value)).join(' ')
        fs.appendFileSync(logPath, `${new Date().toISOString()} [${level}] ${message}\n`, 'utf8')
      } catch {
        // Update logging must never interrupt the app.
      }
    }
    return {
      info: (...values: unknown[]) => write('info', values),
      warn: (...values: unknown[]) => write('warn', values),
      error: (...values: unknown[]) => write('error', values),
      debug: (...values: unknown[]) => write('debug', values),
    }
  }
}
