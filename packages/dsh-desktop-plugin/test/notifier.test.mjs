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

test('notification generates correct titles, bodies and tags for all 3 interaction kinds', () => {
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

    const sessions = createMockSessions()
    const unsubscribe = setupNotificationWatcher(sessions, (k) => zh[k] ?? k, () => {})

    // 1. Approval
    sessions.setState({
      ids: ['s-appr'],
      byId: {
        's-appr': { id: 's-appr', displayTitle: 'Approval Task', pendingInteraction: 'approval' },
      },
    })
    assert.equal(fired.length, 1)
    assert.equal(fired[0].title, '桌面 · Approval Task')
    assert.equal(fired[0].options.body, 'DSH 需要你的审批')
    assert.equal(fired[0].options.tag, 'dsh-desktop-s-appr-approval')
    assert.equal(fired[0].options.requireInteraction, true)

    // 2. Question
    sessions.setState({
      ids: ['s-appr', 's-q'],
      byId: {
        's-appr': { id: 's-appr', displayTitle: 'Approval Task', pendingInteraction: 'approval' },
        's-q': { id: 's-q', displayTitle: 'Question Task', pendingInteraction: 'question' },
      },
    })
    assert.equal(fired.length, 2)
    assert.equal(fired[1].title, '桌面 · Question Task')
    assert.equal(fired[1].options.body, 'DSH 需要你的回答')
    assert.equal(fired[1].options.tag, 'dsh-desktop-s-q-question')

    // 3. Plan Review
    sessions.setState({
      ids: ['s-appr', 's-q', 's-plan'],
      byId: {
        's-appr': { id: 's-appr', displayTitle: 'Approval Task', pendingInteraction: 'approval' },
        's-q': { id: 's-q', displayTitle: 'Question Task', pendingInteraction: 'question' },
        's-plan': { id: 's-plan', displayTitle: 'Plan Task', pendingInteraction: 'plan-review' },
      },
    })
    assert.equal(fired.length, 3)
    assert.equal(fired[2].title, '桌面 · Plan Task')
    assert.equal(fired[2].options.body, 'DSH 需要你评审计划')
    assert.equal(fired[2].options.tag, 'dsh-desktop-s-plan-plan-review')

    unsubscribe()
  } finally {
    globalThis.window = originalWindow
  }
})

test('clicking notification focuses window, opens target session and closes notification', () => {
  let focused = false
  let openedSessionId = null
  const instances = []

  class MockNotification {
    static permission = 'granted'
    constructor(title, options) {
      this.title = title
      this.options = options
      this.closed = false
      this.onclick = null
      instances.push(this)
    }
    close() {
      this.closed = true
    }
  }

  const originalWindow = globalThis.window
  try {
    globalThis.window = {
      Notification: MockNotification,
      focus: () => {
        focused = true
      },
    }

    const sessions = createMockSessions()
    const unsubscribe = setupNotificationWatcher(
      sessions,
      (k) => zh[k] ?? k,
      (id) => {
        openedSessionId = id
      },
    )

    sessions.setState({
      ids: ['s-target'],
      byId: {
        's-target': { id: 's-target', displayTitle: 'Target Session', pendingInteraction: 'question' },
      },
    })

    assert.equal(instances.length, 1)
    const notif = instances[0]
    assert.equal(typeof notif.onclick, 'function')

    // Trigger notification click
    notif.onclick()

    assert.equal(focused, true, 'Window must be focused on click')
    assert.equal(openedSessionId, 's-target', 'Target session ID must be passed to open()')
    assert.equal(notif.closed, true, 'Notification must be closed on click')

    unsubscribe()
  } finally {
    globalThis.window = originalWindow
  }
})

test('handles notification permissions correctly (granted, default with prompt, denied)', async () => {
  const fired = []
  let requested = false

  class MockNotification {
    static permission = 'default'
    static async requestPermission() {
      requested = true
      MockNotification.permission = 'granted'
      return 'granted'
    }
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

    const sessions = createMockSessions()
    const unsubscribe = setupNotificationWatcher(sessions, (k) => zh[k] ?? k, () => {})

    sessions.setState({
      ids: ['s1'],
      byId: {
        s1: { id: 's1', displayTitle: 'Permission Test', pendingInteraction: 'approval' },
      },
    })

    // Allow promise tick for requestPermission
    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.equal(requested, true, 'Should request permission when permission is default')
    assert.equal(fired.length, 1, 'Should fire notification after permission is granted')

    // When denied
    MockNotification.permission = 'denied'
    sessions.setState({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Permission Test', pendingInteraction: 'approval' },
        s2: { id: 's2', displayTitle: 'Denied Test', pendingInteraction: 'approval' },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(fired.length, 1, 'Should not fire notification when permission is denied')

    unsubscribe()
  } finally {
    globalThis.window = originalWindow
  }
})

test('falls back to browser notification when bridge throws', () => {
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
      __DSH_DESKTOP_BRIDGE__: {
        notify: () => {
          throw new Error('Bridge failed')
        },
      },
    }

    const sessions = createMockSessions()
    const unsubscribe = setupNotificationWatcher(sessions, (k) => zh[k] ?? k, () => {})

    sessions.setState({
      ids: ['s1'],
      byId: {
        s1: { id: 's1', displayTitle: 'Fallback Session', pendingInteraction: 'question' },
      },
    })

    assert.equal(fired.length, 1, 'Should fallback to browser notification when bridge throws')
    assert.equal(fired[0].options.tag, 'dsh-desktop-s1-question')

    unsubscribe()
  } finally {
    globalThis.window = originalWindow
  }
})
