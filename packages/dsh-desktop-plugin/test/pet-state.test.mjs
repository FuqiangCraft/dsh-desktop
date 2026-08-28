import assert from 'node:assert/strict'
import test from 'node:test'
import { setupPetStateEngine } from '../src/client/pet/stateEngine.ts'
import { resetDesktopSettings, updateDesktopSettings } from '../src/client/settings/settingsStore.ts'

test('pet state engine seeds idle state and updates on sessions changes', () => {
  resetDesktopSettings()
  updateDesktopSettings({ petEnabled: true })

  let currentSnapshot = {
    ids: ['s1'],
    byId: {
      s1: { id: 's1', title: 'Test Session', running: false },
    },
  }

  let listener = null
  const fakeSessions = {
    list: {
      getSnapshot() {
        return currentSnapshot
      },
      subscribe(fn) {
        listener = fn
        return () => {
          listener = null
        }
      },
    },
  }

  const dispatched = []
  globalThis.window = {
    __DSH_DESKTOP_BRIDGE__: {
      updatePetState(state, text) {
        dispatched.push({ state, text })
      },
    },
  }

  const t = (k) => k

  const teardown = setupPetStateEngine(fakeSessions, t)

  // 1. Trigger running session -> thinking
  currentSnapshot = {
    ids: ['s1'],
    byId: {
      s1: { id: 's1', title: 'Test Session', running: true },
    },
  }
  listener?.()

  assert.ok(
    dispatched.some((d) => d.state === 'thinking'),
    'Must dispatch thinking state when session is running',
  )

  // 2. Trigger pending interaction -> alert
  currentSnapshot = {
    ids: ['s1'],
    byId: {
      s1: { id: 's1', title: 'Test Session', running: false, pendingInteraction: 'question' },
    },
  }
  listener?.()

  assert.ok(
    dispatched.some((d) => d.state === 'alert'),
    'Must dispatch alert state when pending interaction exists',
  )

  teardown()
  delete globalThis.window
})
