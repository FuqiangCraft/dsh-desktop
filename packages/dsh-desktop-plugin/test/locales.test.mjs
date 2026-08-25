import assert from 'node:assert/strict'
import test from 'node:test'
import { en, zh } from '../src/client/locales.ts'

test('locales dictionary exports', () => {
  assert.ok(zh && typeof zh === 'object', 'zh locale dictionary must be an object')
  assert.ok(en && typeof en === 'object', 'en locale dictionary must be an object')
})

test('locales key parity between Chinese (zh) and English (en)', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()

  assert.deepEqual(
    enKeys,
    zhKeys,
    'English dictionary must have exact 1:1 key parity with Chinese dictionary',
  )
})

test('locales values are non-empty strings with no leftover TODOs', () => {
  for (const [key, val] of Object.entries(zh)) {
    assert.equal(typeof val, 'string', `zh[${key}] must be a string`)
    assert.ok(val.trim().length > 0, `zh[${key}] must not be empty`)
    assert.ok(!val.includes('TODO'), `zh[${key}] must not contain TODO`)
  }

  for (const [key, val] of Object.entries(en)) {
    assert.equal(typeof val, 'string', `en[${key}] must be a string`)
    assert.ok(val.trim().length > 0, `en[${key}] must not be empty`)
    assert.ok(!val.includes('TODO'), `en[${key}] must not contain TODO`)
  }
})

test('critical UI keys exist and have expected semantics', () => {
  const requiredKeys = [
    'nav',
    'attention.title',
    'attention.subtitle',
    'attention.kind.approval',
    'attention.kind.question',
    'attention.kind.plan-review',
    'notify.titleApproval',
    'notify.titleQuestion',
    'notify.titlePlanReview',
    'canvas.title',
    'canvas.empty',
    // Desktop & Pet Settings
    'settings.title',
    'settings.subtitle',
    'settings.group.pet',
    'settings.petEnabled.label',
    'settings.petCharacter.label',
  ]

  for (const key of requiredKeys) {
    assert.ok(key in zh, `zh must contain key "${key}"`)
    assert.ok(key in en, `en must contain key "${key}"`)
  }
})
