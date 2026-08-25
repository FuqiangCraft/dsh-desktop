/**
 * Notification watcher (client half): watches the sessions list for a
 * session entering a pending user interaction (approval, question, or plan
 * review) and fires a browser desktop notification. This is the desktop-grade
 * signal the stock web UI lacks — questions surface only inside the composer.
 * The watcher is a plain subscription over the sessions store (no React), so
 * it runs even while no conversation is mounted.
 */
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { DesktopKey } from './locales.ts'

/** The pending-interaction statuses dsh surfaces on a session row. */
export type DesktopInteractionStatus = 'approval' | 'plan-review' | 'question'

/** The slice of the client sessions store this plugin reads (see dsh-notification). */
export interface SessionListStateLike {
  ids: readonly SessionId[]
  byId: Record<SessionId, SessionSummary>
}

/** The sessions-service read face used for the subscription. */
export interface SessionsListFace {
  list: {
    getSnapshot(): SessionListStateLike
    subscribe(listener: () => void): () => void
  }
}

type TauriInternals = {
  invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>
}

/** Locale keys for each interaction kind's notification title. */
const KIND_TITLE: Record<DesktopInteractionStatus, DesktopKey> = {
  approval: 'notify.titleApproval',
  question: 'notify.titleQuestion',
  'plan-review': 'notify.titlePlanReview',
}

type T = (key: DesktopKey) => string

/** Typed Native Desktop Bridge interface. */
export interface DshDesktopBridge {
  notify(payload: { id: string; title: string; kind: DesktopInteractionStatus; label: string }): void
}

declare global {
  interface Window {
    __DSH_DESKTOP_BRIDGE__?: DshDesktopBridge
    __TAURI_INTERNALS__?: TauriInternals
    __DSH_DESKTOP_OPEN_SESSION__?: (id: string) => void
    __DSH_DESKTOP_NEW_CHAT__?: () => void
  }
}

/** Keep the native tray's recent-session submenu aligned with the client store. */
export function setupTraySessionSync(sessions: SessionsListFace): () => void {
  const invoke = window.__TAURI_INTERNALS__?.invoke
  if (typeof invoke !== 'function') return () => {}

  const update = (): void => {
    const snapshot = sessions.list.getSnapshot()
    const recent = snapshot.ids
      .map((id) => snapshot.byId[id])
      .filter((row): row is SessionSummary => row !== undefined)
      .slice(0, 5)
      .map((row) => ({ id: row.id, title: row.displayTitle }))
    void invoke('sync_recent_sessions', { sessions: recent })
  }

  update()
  return sessions.list.subscribe(update)
}

/** Browser Notification availability shim. */
function notifications(): typeof Notification | undefined {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined'
    ? window.Notification
    : undefined
}

/**
 * Subscribe to the sessions store and fire a notification whenever any session
 * enters a pending-interaction state it was not previously in. The first
 * snapshot seeds the baseline (history is never re-notified). Returns the
 * subscription disposer for the plugin fiber's effect unwinding.
 */
export function setupNotificationWatcher(
  sessions: SessionsListFace,
  t: T,
  open: (id: SessionId) => void,
): () => void {
  const Notif = notifications()
  const hasBridge = typeof window !== 'undefined' && (Boolean(window.__DSH_DESKTOP_BRIDGE__) || Boolean(window.__TAURI_INTERNALS__))
  if (Notif === undefined && !hasBridge) return () => {}

  const seen = new Map<SessionId, DesktopInteractionStatus>()

  const update = (): void => {
    const snap = sessions.list.getSnapshot()
    for (const id of snap.ids) {
      const row = snap.byId[id]
      const status = row?.pendingInteraction as DesktopInteractionStatus | undefined
      if (status === undefined) {
        seen.delete(id)
        continue
      }
      if (seen.get(id) === status) continue
      seen.set(id, status)
      fire(Notif, row, status, t, open)
    }
  }

  // Seed the baseline without notifying for interactions that pre-date plugin
  // activation. Only subsequent state transitions should alert the operator.
  const initial = sessions.list.getSnapshot()
  for (const id of initial.ids) {
    const status = initial.byId[id]?.pendingInteraction as DesktopInteractionStatus | undefined
    if (status !== undefined) seen.set(id, status)
  }
  return sessions.list.subscribe(update)
}

/** Create one browser or native notification, requesting permission on first use. */
function fire(
  Notif: typeof Notification | undefined,
  row: SessionSummary,
  status: DesktopInteractionStatus,
  t: T,
  open: (id: SessionId) => void,
): void {
  const title = `${t('nav')} · ${row.displayTitle}`
  const body = t(KIND_TITLE[status])

  if (typeof window !== 'undefined' && window.__DSH_DESKTOP_BRIDGE__) {
    try {
      window.__DSH_DESKTOP_BRIDGE__.notify({
        id: row.id,
        title: row.displayTitle,
        kind: status,
        label: body,
      })
      return
    } catch {
      // Graceful fallback to web notification if bridge call fails
    }
  }

  if (Notif === undefined) return

  const show = (): void => {
    const notif = new Notif(title, { body, tag: `dsh-desktop-${row.id}-${status}`, requireInteraction: true })
    notif.onclick = () => {
      window.focus()
      open(row.id)
      notif.close()
    }
  }
  if (Notif.permission === 'granted') {
    show()
  } else if (Notif.permission !== 'denied') {
    void Notif.requestPermission().then((permission) => {
      if (permission === 'granted') show()
    })
  }
}
