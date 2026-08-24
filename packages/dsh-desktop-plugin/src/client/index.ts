/**
 * @dsh-community/dsh-desktop-plugin — browser half.
 *
 * Registers the `desktop` dictionaries, the notification watcher (fires a
 * desktop notification when a session enters a pending interaction), and the
 * multi-agent tiling canvas as a `conversation.view` tab. All registrations
 * are fiber effects, so unloading unwinds them.
 *
 * The floating attention HUD (AttentionCard) targets the `shell.overlay`
 * frame-wide slot, which exists in dsh master but is not yet in the published
 * client runtime; it is registered here once that slot ships.
 */
import type { ClientContext, ConversationViewDefinition } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotMap merge declaring `conversation.view`.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh, type DesktopKey } from './locales.ts'
import { MultiAgentCanvas, type CanvasInjected } from './MultiAgentCanvas.tsx'
import { setupNotificationWatcher, type SessionsListFace } from './notifier.ts'
import { adoptStyles } from './styles.ts'

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

/** Required services: the sessions store, slot registry, locale, and view registry. */
export const inject = ['sessions', 'slots', 'locale', 'conversationViews']

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
  ctx.effect(() => setupNotificationWatcher(sessions, t, (id) => sessions.open(id)), 'dsh-desktop-plugin: notifications')

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
}
