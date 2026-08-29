import { app, dialog, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

export const PROJECT_URL = 'https://github.com/FuqiangCraft/dsh-desktop'

type MenuLocale = {
  file: string
  newChat: string
  close: string
  edit: string
  view: string
  reload: string
  toggleDevTools: string
  resetZoom: string
  zoomIn: string
  zoomOut: string
  window: string
  minimize: string
  showWindow: string
  help: string
  projectHome: string
  checkUpdates: string
  about: string
}

const locales: Record<'zh' | 'en', MenuLocale> = {
  zh: {
    file: '文件', newChat: '新建会话', close: '关闭窗口', edit: '编辑', view: '视图',
    reload: '重新加载', toggleDevTools: '开发者工具', resetZoom: '重置缩放', zoomIn: '放大', zoomOut: '缩小',
    window: '窗口', minimize: '最小化', showWindow: '显示主窗口', help: '帮助', projectHome: '项目主页',
    checkUpdates: '检查更新', about: '关于 DSH Desktop',
  },
  en: {
    file: 'File', newChat: 'New Chat', close: 'Close Window', edit: 'Edit', view: 'View',
    reload: 'Reload', toggleDevTools: 'Toggle Developer Tools', resetZoom: 'Reset Zoom', zoomIn: 'Zoom In', zoomOut: 'Zoom Out',
    window: 'Window', minimize: 'Minimize', showWindow: 'Show Main Window', help: 'Help', projectHome: 'Project Homepage',
    checkUpdates: 'Check for Updates', about: 'About DSH Desktop',
  },
}

export function menuLanguage(locale: string): 'zh' | 'en' {
  return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function createApplicationMenu(
  win: BrowserWindow,
  options: { onNewChat: () => void; onCheckForUpdates: () => void },
  locale = app.getLocale(),
): Menu {
  const copy = locales[menuLanguage(locale)]
  const template: MenuItemConstructorOptions[] = [
    { label: copy.file, submenu: [{ label: copy.newChat, accelerator: 'CmdOrCtrl+N', click: options.onNewChat }, { type: 'separator' }, { role: 'close', label: copy.close }] },
    { label: copy.edit, submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: copy.view, submenu: [{ role: 'reload', label: copy.reload }, { role: 'toggleDevTools', label: copy.toggleDevTools }, { type: 'separator' }, { role: 'resetZoom', label: copy.resetZoom }, { role: 'zoomIn', label: copy.zoomIn }, { role: 'zoomOut', label: copy.zoomOut }] },
    { label: copy.window, submenu: [{ role: 'minimize', label: copy.minimize }, { label: copy.showWindow, click: () => { if (win.isMinimized()) win.restore(); win.show(); win.focus() } }] },
    { label: copy.help, submenu: [
      { label: copy.projectHome, click: () => { void shell.openExternal(PROJECT_URL) } },
      { label: copy.checkUpdates, click: options.onCheckForUpdates },
      { type: 'separator' },
      { label: copy.about, click: () => { void dialog.showMessageBox(win, { type: 'info', title: copy.about, message: 'DSH Desktop', detail: `Version ${app.getVersion()}` }) } },
    ] },
  ]
  return Menu.buildFromTemplate(template)
}

export function installApplicationMenu(
  win: BrowserWindow,
  options: { onNewChat: () => void; onCheckForUpdates: () => void },
  locale = app.getLocale(),
): Menu {
  const menu = createApplicationMenu(win, options, locale)
  Menu.setApplicationMenu(menu)
  return menu
}

export function openApplicationSubmenu(menu: Menu, label: string, win: BrowserWindow, x: number, y: number): void {
  const item = menu.items.find((candidate) => candidate.label === label)
  item?.submenu?.popup({ window: win, x, y })
}
