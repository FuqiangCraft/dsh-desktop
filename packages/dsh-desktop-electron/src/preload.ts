import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopSettings {
  petEnabled: boolean
  petCharacter: string
  petSize: number
}

export interface DesktopNotificationPayload {
  id: string
  title: string
  kind: 'approval' | 'plan-review' | 'question' | string
  label: string
}

export interface RecentSessionPayload {
  id: string
  title: string
}

export interface DesktopUpdateState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  message?: string
}

const bridge = {
  notify(payload: DesktopNotificationPayload): void {
    ipcRenderer.send('dsh:notify', payload)
  },

  syncSettings(settings: DesktopSettings): void {
    ipcRenderer.send('dsh:sync-settings', settings)
  },

  getSettings(): Promise<DesktopSettings> {
    return ipcRenderer.invoke('dsh:get-settings')
  },

  updatePetState(state: string, text = ''): void {
    ipcRenderer.send('dsh:update-pet-state', { state, text })
  },

  syncRecentSessions(sessions: RecentSessionPayload[]): void {
    ipcRenderer.send('dsh:sync-recent-sessions', sessions)
  },

  startDraggingPet(): void {
    ipcRenderer.send('dsh:start-dragging-pet')
  },

  openPetResourceFolder(): Promise<void> {
    return ipcRenderer.invoke('dsh:open-pet-resource-folder')
  },

  listPetResources(): Promise<string[]> {
    return ipcRenderer.invoke('dsh:list-pet-resources')
  },

  readPetResource(name: string): Promise<string | null> {
    return ipcRenderer.invoke('dsh:read-pet-resource', name)
  },

  openSession(id: string): void {
    ipcRenderer.send('dsh:open-session', id)
  },

  newChat(): void {
    ipcRenderer.send('dsh:new-chat')
  },

  retryBoot(): Promise<boolean> {
    return ipcRenderer.invoke('dsh:retry-boot')
  },

  resetProfile(): Promise<boolean> {
    return ipcRenderer.invoke('dsh:reset-profile')
  },

  openProfileDir(): Promise<void> {
    return ipcRenderer.invoke('dsh:open-profile-dir')
  },

  getUpdateState(): Promise<DesktopUpdateState> {
    return ipcRenderer.invoke('dsh:get-update-state')
  },

  checkForUpdates(): Promise<DesktopUpdateState> {
    return ipcRenderer.invoke('dsh:check-for-updates')
  },

  installUpdate(): Promise<boolean> {
    return ipcRenderer.invoke('dsh:install-update')
  },

  onUpdateState(callback: (state: DesktopUpdateState) => void): () => void {
    const handler = (_event: unknown, state: DesktopUpdateState) => callback(state)
    ipcRenderer.on('dsh:update-state', handler)
    return () => ipcRenderer.removeListener('dsh:update-state', handler)
  },

  onPetCharacter(callback: (character: string) => void): () => void {
    const handler = (_event: unknown, character: string) => callback(character)
    ipcRenderer.on('dsh:set-pet-character', handler)
    return () => {
      ipcRenderer.removeListener('dsh:set-pet-character', handler)
    }
  },

  onPetSize(callback: (size: number) => void): () => void {
    const handler = (_event: unknown, size: number) => callback(size)
    ipcRenderer.on('dsh:set-pet-size', handler)
    return () => {
      ipcRenderer.removeListener('dsh:set-pet-size', handler)
    }
  },

  onPetState(callback: (state: string, text: string) => void): () => void {
    const handler = (_event: unknown, data: { state: string; text: string }) => callback(data.state, data.text)
    ipcRenderer.on('dsh:set-pet-state', handler)
    return () => {
      ipcRenderer.removeListener('dsh:set-pet-state', handler)
    }
  },
}

declare global {
  interface Window {
    __DSH_DESKTOP_BRIDGE__?: typeof bridge
  }
}

contextBridge.exposeInMainWorld('__DSH_DESKTOP_BRIDGE__', bridge)

// Also set globalThis.__DSH_DESKTOP_BRIDGE__ for fallback contexts
try {
  window.__DSH_DESKTOP_BRIDGE__ = bridge
} catch {
  // ignore
}
