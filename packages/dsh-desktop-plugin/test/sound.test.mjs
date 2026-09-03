import assert from 'node:assert/strict'
import test from 'node:test'
import { playNotificationSound } from '../src/client/sound.ts'

test('playNotificationSound runs safely in non-window environment', () => {
  assert.doesNotThrow(() => {
    playNotificationSound('notify', 80)
    playNotificationSound('complete', 100)
    playNotificationSound('alert', 0)
  })
})

test('playNotificationSound works with mocked AudioContext', () => {
  let createdOscillators = 0
  let createdGains = 0

  class MockGainNode {
    constructor() {
      this.gain = {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      }
    }
    connect() {}
  }

  class MockOscillatorNode {
    constructor() {
      this.frequency = { setValueAtTime() {} }
      this.type = 'sine'
    }
    connect() {}
    start() { createdOscillators++ }
    stop() {}
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 100
      this.destination = {}
      this.state = 'running'
    }
    createGain() {
      createdGains++
      return new MockGainNode()
    }
    createOscillator() {
      return new MockOscillatorNode()
    }
    resume() { return Promise.resolve() }
  }

  globalThis.window = {
    AudioContext: MockAudioContext,
  }

  playNotificationSound('notify', 80)
  assert.ok(createdOscillators > 0, 'Notification should trigger oscillators')
  assert.ok(createdGains > 0, 'Notification should trigger gain nodes')

  const oscBeforeComplete = createdOscillators
  playNotificationSound('complete', 90)
  assert.ok(createdOscillators > oscBeforeComplete, 'Complete should trigger triad oscillators')

  delete globalThis.window
})
