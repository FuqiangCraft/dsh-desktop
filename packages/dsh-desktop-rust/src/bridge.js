(() => {
  const settingsListeners = new Set()
  const updateListeners = new Set()
  const workspaceListeners = new Set()
  const invoke = (command, args = {}) => window.__TAURI__.core.invoke(command, args)
  window.__DSH_RUST_UPDATE_STATE__ = (state) => {
    for (const listener of updateListeners) listener(state)
  }
  window.__DSH_RUST_SET_SETTINGS__ = (settings) => {
    for (const listener of settingsListeners) listener(settings)
  }
  window.__DSH_DESKTOP_SET_WORKSPACE__ = (path) => {
    for (const listener of workspaceListeners) listener(path)
  }

  window.__DSH_DESKTOP_BRIDGE__ = {
    getSettings: () => invoke('get_desktop_settings'),
    syncSettings: (patch) => {
      void invoke('save_desktop_settings', { patch }).then((settings) => {
        for (const listener of settingsListeners) listener(settings)
      }).catch(console.error)
    },
    onSettingsChanged: (listener) => {
      settingsListeners.add(listener)
      return () => settingsListeners.delete(listener)
    },
    windowControl: (action) => { void invoke('window_control', { action }) },

    // Workspace native operations
    selectWorkspaceFolder: () => invoke('select_workspace_folder'),
    getCurrentWorkspace: () => invoke('get_current_workspace'),
    setCurrentWorkspace: (path) => invoke('set_current_workspace', { path }),
    listRecentWorkspaces: () => invoke('list_recent_workspaces'),
    onWorkspaceChanged: (listener) => {
      workspaceListeners.add(listener)
      return () => workspaceListeners.delete(listener)
    },

    // Capability-scoped native commands exposed by the Tauri host.
    notify: (payload) => { void invoke('notify', { payload }).catch(console.error) },
    updatePetState: (state, text = '') => {
      void invoke('update_pet_state', { state, text }).catch(console.error)
    },
    syncRecentSessions: (sessions) => {
      void invoke('sync_recent_sessions', { sessions }).catch(console.error)
    },
    getPetResourcePath: () => invoke('get_pet_resource_path'),
    openPetResourceFolder: () => invoke('open_pet_resource_folder'),
    listPetResources: () => invoke('list_pet_resources'),
    readPetResource: (name) => invoke('read_pet_resource', { name }),
    retryBoot: () => invoke('retry_boot'),
    resetProfile: () => invoke('reset_profile'),
    openProfileDir: () => invoke('open_profile_dir'),
    getUpdateState: () => invoke('get_update_state'),
    checkForUpdates: () => invoke('check_for_updates'),
    installUpdate: () => invoke('install_update'),
    openApplicationMenu: (label, x, y) => {
      void invoke('open_application_menu', { label, x, y }).catch(console.error)
    },
    onUpdateState: (listener) => {
      updateListeners.add(listener)
      return () => updateListeners.delete(listener)
    },
    onPetCharacter: () => () => {},
    onPetSize: () => () => {},
    onPetState: () => () => {},
  }

  const installTitlebar = () => {
    if (document.getElementById('dsh-shell-titlebar')) return
    const chinese = navigator.language.toLowerCase().startsWith('zh')
    const labels = chinese ? ['文件', '编辑', '视图', '窗口', '帮助'] : ['File', 'Edit', 'View', 'Window', 'Help']
    const titlebar = document.createElement('div')
    titlebar.id = 'dsh-shell-titlebar'
    titlebar.setAttribute('data-tauri-drag-region', '')
    titlebar.innerHTML = `<button class="dsh-shell-sidebar" data-sidebar aria-label="${chinese ? '切换侧边栏' : 'Toggle sidebar'}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5"></rect><path d="M6 3v10"></path></svg></button><button class="dsh-shell-history" data-history="back" aria-label="${chinese ? '后退' : 'Back'}">‹</button><button class="dsh-shell-history" data-history="forward" aria-label="${chinese ? '前进' : 'Forward'}">›</button><nav>${labels.map((label) => `<button data-menu="${label}">${label}</button>`).join('')}</nav><div class="dsh-shell-drag" data-tauri-drag-region></div><div class="dsh-shell-controls"><button data-window="minimize" aria-label="${chinese ? '最小化' : 'Minimize'}">—</button><button data-window="maximize" aria-label="${chinese ? '最大化' : 'Maximize'}">□</button><button data-window="close" aria-label="${chinese ? '关闭' : 'Close'}">×</button></div>`
    const style = document.createElement('style')
    style.textContent = '#dsh-shell-titlebar{--dsh-tb-bg:#f3f6fa;--dsh-tb-color:#59636e;--dsh-tb-hover:#e4eaf0;--dsh-tb-hover-color:#28323c;--dsh-tb-border:rgba(36,48,61,.08);height:36px;position:fixed;inset:0 0 auto;z-index:2147483647;display:flex;align-items:center;background:var(--dsw-alias-bg-layer-1,var(--dsh-tb-bg));color:var(--dsw-alias-label-secondary,var(--dsh-tb-color));font:13px system-ui,sans-serif;user-select:none;border-bottom:1px solid var(--dsw-alias-border-l1,var(--dsh-tb-border))}#dsh-shell-titlebar button{height:100%;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;-webkit-app-region:no-drag}#dsh-shell-titlebar button:hover{background:var(--dsw-alias-bg-layer-2,var(--dsh-tb-hover));color:var(--dsw-alias-label-primary,var(--dsh-tb-hover-color))}#dsh-shell-titlebar nav{display:flex;height:100%;margin-left:4px;-webkit-app-region:no-drag}#dsh-shell-titlebar nav button{padding:0 10px}#dsh-shell-titlebar .dsh-shell-sidebar{width:42px;display:flex;align-items:center;justify-content:center}#dsh-shell-titlebar .dsh-shell-sidebar svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.25}#dsh-shell-titlebar .dsh-shell-history{width:30px;padding:0;font-size:24px;font-weight:300;line-height:1}#dsh-shell-titlebar .dsh-shell-drag{height:100%;flex:1;-webkit-app-region:drag}#dsh-shell-titlebar .dsh-shell-controls{height:100%;display:flex;margin-left:auto;-webkit-app-region:no-drag}#dsh-shell-titlebar .dsh-shell-controls button{width:46px;padding:0;font-size:16px}#dsh-shell-titlebar .dsh-shell-controls button[data-window=close]:hover{background:#c42b1c;color:#fff}@media (prefers-color-scheme:dark){#dsh-shell-titlebar{--dsh-tb-bg:#161b22;--dsh-tb-color:#8b949e;--dsh-tb-hover:#21262d;--dsh-tb-hover-color:#f0f6fc;--dsh-tb-border:rgba(240,246,252,.1)}}html.dark #dsh-shell-titlebar,html[data-theme=dark] #dsh-shell-titlebar,body.dark #dsh-shell-titlebar{--dsh-tb-bg:#161b22;--dsh-tb-color:#8b949e;--dsh-tb-hover:#21262d;--dsh-tb-hover-color:#f0f6fc;--dsh-tb-border:rgba(240,246,252,.1)}html{padding-top:36px!important;box-sizing:border-box!important}body{margin-top:0!important}'
    document.head.append(style)
    document.body.prepend(titlebar)

    titlebar.querySelectorAll('[data-menu]').forEach((button) => {
      button.addEventListener('click', () => {
        const rect = button.getBoundingClientRect()
        window.__DSH_DESKTOP_BRIDGE__.openApplicationMenu(button.dataset.menu, Math.round(rect.left), 36)
      })
    })
    titlebar.querySelectorAll('[data-window]').forEach((button) => {
      button.addEventListener('click', () => window.__DSH_DESKTOP_BRIDGE__.windowControl(button.dataset.window))
    })
    titlebar.querySelectorAll('[data-history]').forEach((button) => {
      button.addEventListener('click', () => button.dataset.history === 'back' ? history.back() : history.forward())
    })
    titlebar.addEventListener('dblclick', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('button')) {
        window.__DSH_DESKTOP_BRIDGE__.windowControl('maximize')
      }
    })

    let sidebarToggle = null
    const findSidebarToggle = () => Array.from(document.querySelectorAll('button, [role="button"]')).find((element) => {
      if (element.closest('#dsh-shell-titlebar')) return false
      const text = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`.toLowerCase()
      return text.includes('侧边栏') || text.includes('sidebar')
    })
    const synchronizeSidebarToggle = () => {
      sidebarToggle = sidebarToggle && document.body.contains(sidebarToggle) ? sidebarToggle : findSidebarToggle()
      if (sidebarToggle) {
        sidebarToggle.style.opacity = '0'
        sidebarToggle.style.pointerEvents = 'none'
      }
    }
    titlebar.querySelector('[data-sidebar]').addEventListener('click', () => {
      synchronizeSidebarToggle()
      sidebarToggle?.click()
    })
    synchronizeSidebarToggle()
    new MutationObserver(synchronizeSidebarToggle).observe(document.body, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', installTitlebar, { once: true })
  } else {
    installTitlebar()
  }
})()
