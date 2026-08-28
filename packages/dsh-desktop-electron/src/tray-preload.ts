import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('__DSH_TRAY_MENU__', {
  action: (name: string, payload?: string) => ipcRenderer.send('dsh:tray-menu-action', name, payload),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on('dsh:tray-menu-state', listener)
    return () => ipcRenderer.off('dsh:tray-menu-state', listener)
  },
})
