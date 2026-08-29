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

  windowControl(action: 'minimize' | 'maximize' | 'close'): void {
    ipcRenderer.send('dsh:window-control', action)
  },

  openApplicationMenu(label: string, x: number, y: number): void {
    ipcRenderer.send('dsh:open-application-menu', label, x, y)
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

// The desktop shell uses a frameless window so its menu can share one row with
// the title and native window controls, matching the reference desktop UI.
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dsh-shell-titlebar')) return
  const chinese = navigator.language.toLowerCase().startsWith('zh')
  const labels = chinese ? ['文件', '编辑', '视图', '窗口', '帮助'] : ['File', 'Edit', 'View', 'Window', 'Help']
  let sidebarToggle: HTMLElement | null = null
  const titlebar = document.createElement('div')
  titlebar.id = 'dsh-shell-titlebar'
  titlebar.innerHTML = `<button class="dsh-shell-sidebar-toggle" data-collapse aria-label="${chinese ? '折叠侧边栏' : 'Collapse sidebar'}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5"></rect><path d="M6 3v10"></path></svg></button><nav>${labels.map((label) => `<button data-menu="${label}">${label}</button>`).join('')}</nav><div class="dsh-shell-controls"><button data-window="minimize">—</button><button data-window="maximize">□</button><button data-window="close">×</button></div>`
  const style = document.createElement('style')
  style.textContent = '#dsh-shell-titlebar{height:32px;position:fixed;inset:0 0 auto;z-index:2147483647;display:flex;align-items:center;background:#f3f6fa;color:#263342;font:13px system-ui,sans-serif;user-select:none;box-shadow:0 1px 0 rgba(0,0,0,.08)}#dsh-shell-titlebar nav{display:flex;height:100%;-webkit-app-region:no-drag}#dsh-shell-titlebar button{border:0;background:transparent;color:inherit;font:inherit;height:100%;padding:0 9px;cursor:pointer}#dsh-shell-titlebar nav button:hover,#dsh-shell-titlebar .dsh-shell-controls button:hover,#dsh-shell-titlebar .dsh-shell-sidebar-toggle:hover{background:#dce5ef}#dsh-shell-titlebar .dsh-shell-sidebar-toggle{width:40px;padding:0 12px;display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag}#dsh-shell-titlebar .dsh-shell-sidebar-toggle svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.35}#dsh-shell-titlebar .dsh-shell-controls{margin-left:auto;display:flex;height:100%;-webkit-app-region:no-drag}#dsh-shell-titlebar .dsh-shell-controls button{width:46px;padding:0;font-size:16px}#dsh-shell-titlebar .dsh-shell-controls button[data-window=close]:hover{background:#d9534f;color:#fff}html{padding-top:32px;box-sizing:border-box}body{margin-top:0!important}'
  document.head.append(style)
  document.body.prepend(titlebar)
  titlebar.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((button) => {
    button.addEventListener('click', () => {
      const rect = button.getBoundingClientRect()
      bridge.openApplicationMenu(button.dataset.menu!, Math.round(rect.left), 32)
    })
  })
  titlebar.querySelector<HTMLButtonElement>('[data-collapse]')?.addEventListener('click', () => {
    const findSidebarToggle = () => Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).find((el) => {
      if (el.closest('#dsh-shell-titlebar')) return false
      const text = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase()
      return text.includes('折叠侧边栏') || text.includes('收起侧边栏') || text.includes('collapse sidebar') || text.includes('toggle sidebar')
    }) || Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter((el) => {
        if (el.closest('#dsh-shell-titlebar') || !el.querySelector('svg')) return false
        const rect = el.getBoundingClientRect()
        return rect.top >= 32 && rect.top < 150 && rect.left > 150 && rect.left < 340 && rect.width <= 70 && rect.height <= 70
      })
      .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0]
    sidebarToggle = sidebarToggle || findSidebarToggle() || null
    sidebarToggle?.click()
  })
  const hideSidebarToggle = () => {
    Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).forEach((el) => {
      if (el.closest('#dsh-shell-titlebar')) return
      const text = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase()
      if (text.includes('折叠侧边栏') || text.includes('收起侧边栏') || text.includes('collapse sidebar') || text.includes('toggle sidebar')) {
        sidebarToggle = el
        // Keep the control in the DOM so the top-bar button can invoke its
        // handler, while removing it from the visual layout and hit testing.
        el.style.opacity = '0'
        el.style.pointerEvents = 'none'
      }
    })
    const unlabeledToggle = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).filter((el) => {
      if (el.closest('#dsh-shell-titlebar') || !el.querySelector('svg')) return false
      const rect = el.getBoundingClientRect()
      return rect.top >= 32 && rect.top < 150 && rect.left > 150 && rect.left < 340 && rect.width <= 70 && rect.height <= 70
    }).sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0]
    if (unlabeledToggle) {
      sidebarToggle = sidebarToggle || unlabeledToggle
      unlabeledToggle.style.opacity = '0'
      unlabeledToggle.style.pointerEvents = 'none'
    }
  }
  hideSidebarToggle()
  new MutationObserver(hideSidebarToggle).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'title'] })
  titlebar.querySelectorAll<HTMLButtonElement>('[data-window]').forEach((button) => {
    button.addEventListener('click', () => bridge.windowControl(button.dataset.window as 'minimize' | 'maximize' | 'close'))
  })
})

// Also set globalThis.__DSH_DESKTOP_BRIDGE__ for fallback contexts
try {
  window.__DSH_DESKTOP_BRIDGE__ = bridge
} catch {
  // ignore
}
