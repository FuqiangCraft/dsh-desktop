import assert from 'node:assert/strict'
import test from 'node:test'
import { zh } from '../src/client/locales.ts'
import { setupNotificationWatcher } from '../src/client/notifier.ts'

function createMockSessions(initialState = { ids: [], byId: {} }) {
  let state = initialState
  const listeners = new Set()

  return {
    list: {
      getSnapshot: () => state,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    setState(newState) {
      state = newState
      for (const listener of listeners) {
        listener()
      }
    },
    listenerCount: () => listeners.size,
  }
}

test('setupNotificationWatcher returns gracefully when window.Notification is absent', () => {
  const originalWindow = globalThis.window
  try {
    delete globalThis.window
    const sessions = createMockSessions()
    const unsubscribe = setupNotificationWatcher(sessions, (k) => zh[k] ?? k, () => {})
    assert.equal(typeof unsubscribe, 'function')
    unsubscribe()
  } finally {
    globalThis.window = originalWindow
  }
})
test('notification state machine seeds baseline and avoids notifying pre-existing interactions', () => {
  const fired = []

  class MockNotification {
    static permission = 'granted'
    constructor(title, options) {
      this.title = title
      this.options = options
      fired.push({ title, options })
    }
  }

  const originalWindow = globalThis.window
  try {
    globalThis.window = {
      Notification: MockNotification,
      focus: () => {},
    }

    const sessions = createMockSessions({
      ids: ['s1'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
      },
    })

    const unsubscribe = setupNotificationWatcher(sessions, (k) => zh[k] ?? k, () => {})

    // Pre-existing session interaction should NOT trigger a notification
    assert.equal(fired.length, 0, 'Must seed initial interactions without firing notification')

    // Transition a new session s2 to approval
    sessions.setState({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
        s2: { id: 's2', displayTitle: 'Task Session', pendingInteraction: 'approval' },
      },
    })

    assert.equal(fired.length, 1, 'New interaction must fire exactly one notification')
    assert.ok(fired[0].title.includes('Task Session'))
    assert.equal(fired[0].options.tag, 'dsh-desktop-s2-approval')

    // Same state repeated must NOT fire duplicate notification
    sessions.setState({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
        s2: { id: 's2', displayTitle: 'Task Session', pendingInteraction: 'approval' },
      },
    })
    assert.equal(fired.length, 1, 'Duplicate state should not fire new notification')

    // s2 pending interaction resolved
    sessions.setState({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
        s2: { id: 's2', displayTitle: 'Task Session', pendingInteraction: undefined },
      },
    })

    // s2 later gets a new question -> should fire again
    sessions.setState({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
        s2: { id: 's2', displayTitle: 'Task Session', pendingInteraction: 'question' },
      },
    })
    assert.equal(fired.length, 2, 'Subsequent interaction after resolution must fire notification')
    assert.equal(fired[1].options.tag, 'dsh-desktop-s2-question')

    // Unsubscribe
    assert.equal(sessions.listenerCount(), 1)
    unsubscribe()
    assert.equal(sessions.listenerCount(), 0, 'Disposer must unwind store subscription')
  } finally {
    globalThis.window = originalWindow
  }
})

test('notification watcher delegates to __DSH_DESKTOP_BRIDGE__ when available', () => {
  const bridgeCalls = []
  const originalWindow = globalThis.window
  try {
    globalThis.window = {
      __DSH_DESKTOP_BRIDGE__: {
        notify: (payload) => bridgeCalls.push(payload),
      },
    }

    const sessions = createMockSessions({
      ids: ['s1'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
      },
    })

    const unsubscribe = setupNotificationWatcher(sessions, (k) => zh[k] ?? k, () => {})

    sessions.setState({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Initial Session', pendingInteraction: 'question' },
        s2: { id: 's2', displayTitle: 'Approval Session', pendingInteraction: 'approval' },
      },
    })

    assert.equal(bridgeCalls.length, 1)
    assert.equal(bridgeCalls[0].id, 's2')
    assert.equal(bridgeCalls[0].title, 'Approval Session')
    assert.equal(bridgeCalls[0].kind, 'approval')

    unsubscribe()
  } finally {
    globalThis.window = originalWindow
  }
})
