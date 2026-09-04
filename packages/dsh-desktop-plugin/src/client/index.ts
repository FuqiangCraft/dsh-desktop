/**
 * @mixian/dsh-desktop-plugin — browser half.
 *
 * Registers the `desktop` dictionaries, the notification watcher (fires a
 * desktop notification when a session enters a pending interaction), the
 * multi-agent tiling canvas as a `conversation.view` tab, the Desktop &
 * Companion settings into the DSH native `settings.section` slot, and the
 * pet state engine driving the floating companion window.
 * All registrations are fiber effects, so unloading unwinds them.
 */
import type { ClientContext, ConversationViewDefinition } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotMap merge declaring `conversation.view`.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the SlotMap merge declaring `settings.section`.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh, type DesktopKey } from './locales.ts'
import { MultiAgentCanvas, type CanvasInjected } from './MultiAgentCanvas.tsx'
import { setupNotificationWatcher, setupTraySessionSync, type SessionsListFace } from './notifier.ts'
import { setupPetStateEngine } from './pet/stateEngine.ts'
import { DesktopSettingsSection } from './settings/DesktopSettingsSection.tsx'
import { AppUpdateSettingsSection } from './settings/AppUpdateSettingsSection.tsx'
import { setupPetNavIcon } from './settings/petNavIcon.ts'
import { applyDesktopSettingsFromHost } from './settings/settingsStore.ts'
import { adoptStyles } from './styles.ts'
import {
  adoptNativeWorkspace,
  installNativeWorkspacePickerInterceptor,
  installWebDirectoryPickerFallbackSuppressor,
} from './workspacePicker.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The desktop plugin's copy. */
    desktop: DesktopKey
  }
}

/** Locale namespace owned by this plugin. */
const NS = 'desktop'

/** The `conversation.view` tab id and the matching view-builder target. */
const CANVAS_VIEW = 'canvas'

/** The `settings.section` entry id for desktop & companion settings. */
const SETTINGS_SECTION_ID = 'desktop-companion'
const UPDATE_SETTINGS_SECTION_ID = 'desktop-update'

/** Required services: the sessions store, slot registry, locale, and view registry. */
export const inject = ['sessions', 'workspaces', 'slots', 'locale', 'conversationViews']

/** Minimal view builder: the canvas renders from the sessions store, not projected nodes. */
const canvasViewDefinition: ConversationViewDefinition = {
  target: CANVAS_VIEW,
  create() {
    return {
      empty: null,
      replace: () => null,
      apply: () => null,
    }
  },
}

/**
 * Client plugin body: compose the desktop surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-desktop-plugin: dictionaries')
  const t = ctx.locale.bind(NS)

  // The client sessions face is read through the service store, not the
  // `ctx.sessions` property proxy: the host dsh-session package merges a
  // different `sessions` Context member, and the two collide in this
  // single-program build.
  const sessions = ctx.get('sessions') as unknown as SessionsListFace & { open: (id: string) => void }
  window.__DSH_DESKTOP_OPEN_SESSION__ = (id) => sessions.open(id)
  window.__DSH_DESKTOP_NEW_CHAT__ = () => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      'button, [role="button"], a[href], [data-action="new-chat"], [data-action="create-session"]',
    ))
    const isNewChatTarget = (el: HTMLElement) => {
      const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase()
      const title = (el.getAttribute('title') || '').trim().toLowerCase()
      const text = (el.textContent || '').trim().toLowerCase()
      return aria === '新建会话' || aria === 'new chat' || aria.includes('新建') || aria.includes('new session')
        || title === '新建会话' || title === 'new chat' || title.includes('新建')
        || text === '新建会话' || text === 'new chat' || text === '新建' || text === '+ new' || text === '+'
    }
    const newChat = candidates.find(isNewChatTarget)
    if (newChat) {
      newChat.click()
      return
    }
    try {
      (sessions as unknown as { create?: () => void }).create?.()
    } catch {
      // ignore
    }
  }

  const desktopBridge = window.__DSH_DESKTOP_BRIDGE__ as typeof window.__DSH_DESKTOP_BRIDGE__ & {
    getSettings?: () => Promise<import('./settings/settingsStore.ts').DesktopSettings>
    onSettingsChanged?: (callback: (settings: import('./settings/settingsStore.ts').DesktopSettings) => void) => () => void
    selectWorkspaceFolder?: () => Promise<string | null>
    onWorkspaceChanged?: (callback: (workspace: string) => void) => () => void
  }
  if (desktopBridge?.getSettings) {
    void desktopBridge.getSettings().then(applyDesktopSettingsFromHost)
  }
  if (desktopBridge?.onSettingsChanged) {
    ctx.effect(() => desktopBridge.onSettingsChanged!(applyDesktopSettingsFromHost), 'dsh-desktop-plugin: native settings sync')
  }
  if (desktopBridge?.onWorkspaceChanged) {
    ctx.effect(() => desktopBridge.onWorkspaceChanged!((newPath) => {
      void adoptNativeWorkspace(ctx.workspaces, newPath).catch(console.error)
    }), 'dsh-desktop-plugin: native workspace sync')
  }

  // Open new workspace directories with the native folder dialog. Existing
  // workspace selectors keep their web menu behavior.
  if (desktopBridge?.selectWorkspaceFolder) {
    ctx.effect(
      () => installNativeWorkspacePickerInterceptor(window, () => desktopBridge.selectWorkspaceFolder!()),
      'dsh-desktop-plugin: native workspace click interceptor',
    )
    ctx.effect(
      () => installWebDirectoryPickerFallbackSuppressor(() => desktopBridge.selectWorkspaceFolder!()),
      'dsh-desktop-plugin: native workspace browse fallback suppressor',
    )
  }

  ctx.effect(() => setupTraySessionSync(sessions), 'dsh-desktop-plugin: tray sessions')
  ctx.effect(() => setupNotificationWatcher(sessions, t, (id) => sessions.open(id)), 'dsh-desktop-plugin: notifications')
  ctx.effect(() => setupPetStateEngine(sessions, t), 'dsh-desktop-plugin: pet state engine')
  ctx.effect(setupPetNavIcon, 'dsh-desktop-plugin: pet settings nav icon')

  ctx.effect(() => ctx.conversationViews.register(canvasViewDefinition), 'dsh-desktop-plugin: canvas view')

  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    {
      name: 'conversation.view',
      id: CANVAS_VIEW,
      order: 20,
      locale: NS,
      label: () => t('canvas.title'),
      inject: (): CanvasInjected => ({ open: (id) => sessions.open(id) }),
    },
    MultiAgentCanvas,
  ))

  // Native Settings Integration: Register Desktop & Pet Companion settings section
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: SETTINGS_SECTION_ID,
      order: 30,
      locale: NS,
      label: () => t('settings.title'),
      inject: () => ({ t }),
    },
    DesktopSettingsSection,
  ))

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: UPDATE_SETTINGS_SECTION_ID,
      order: 40,
      locale: NS,
      label: () => t('settings.update.title'),
      inject: () => ({ t }),
    },
    AppUpdateSettingsSection,
  ))
}
