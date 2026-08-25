/**
 * Desktop Pet State Engine: derives pet state from live sessions and
 * dispatches state/animation updates to Tauri floating companion window.
 */
import type { DesktopKey } from '../locales.ts'
import type { SessionsListFace, DesktopInteractionStatus } from '../notifier.ts'
import { getDesktopSettings } from '../settings/settingsStore.ts'

export type PetLiveState = 'idle' | 'thinking' | 'working' | 'alert' | 'success'

export interface PetStateUpdate {
  state: PetLiveState
  text?: string
}

type T = (key: DesktopKey) => string

/**
 * Drive the desktop pet state machine from the sessions store.
 * @param sessions - client sessions store face.
 * @param t - localized translator.
 * @returns teardown cleanup callback.
 */
export function setupPetStateEngine(sessions: SessionsListFace, t: T): () => void {
  let previousState: PetLiveState = 'idle'
  let successTimer: ReturnType<typeof setTimeout> | null = null

  const dispatchToHost = (state: PetLiveState, text?: string) => {
    if (typeof window === 'undefined') return
    const invoke = window.__TAURI_INTERNALS__?.invoke
    if (typeof invoke === 'function') {
      void invoke('update_pet_state', { state, text: text ?? '' })
    }
  }

  const update = () => {
    const snapshot = sessions.list.getSnapshot()
    const ids = snapshot.ids
    let nextState: PetLiveState = 'idle'
    let statusText = ''

    // 1. Check for pending human interaction (Highest priority: Alert)
    for (const id of ids) {
      const summary = snapshot.byId[id]
      const pending = summary?.pendingInteraction as DesktopInteractionStatus | undefined
      if (pending) {
        nextState = 'alert'
        if (pending === 'approval') statusText = t('attention.kind.approval')
        else if (pending === 'question') statusText = t('attention.kind.question')
        else if (pending === 'plan-review') statusText = t('attention.kind.plan-review')
        break
      }
    }

    // 2. Check for running session / subagents (Thinking / Working)
    if (nextState === 'idle') {
      let isAnyRunning = false
      for (const id of ids) {
        const summary = snapshot.byId[id]
        if (summary?.running) {
          isAnyRunning = true
          break
        }
      }

      if (isAnyRunning) {
        nextState = 'thinking'
        statusText = t('canvas.status.running')
      } else if (previousState === 'thinking' || previousState === 'working') {
        // Just transitioned from running to stopped -> show success celebration
        nextState = 'success'
        statusText = '已完成'
        if (successTimer) clearTimeout(successTimer)
        successTimer = setTimeout(() => {
          previousState = 'idle'
          dispatchToHost('idle', '')
        }, 3000)
      }
    }

    if (nextState !== 'success' && successTimer) {
      clearTimeout(successTimer)
      successTimer = null
    }

    if (nextState !== previousState || nextState === 'alert') {
      previousState = nextState
      const settings = getDesktopSettings()
      if (settings.petEnabled) {
        dispatchToHost(nextState, statusText)
      }
    }
  }

  // Initial seeding
  update()

  const unsubscribe = sessions.list.subscribe(update)
  return () => {
    if (successTimer) clearTimeout(successTimer)
    unsubscribe()
  }
}
