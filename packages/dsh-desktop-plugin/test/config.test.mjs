import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, inject, name } from '../src/index.ts'

test('plugin metadata declarations', () => {
  assert.equal(name, '@mixian/dsh-desktop-plugin', 'Plugin name must match package identifier')
  assert.deepEqual(inject, [], 'Host plugin must have no required service dependencies')
})

test('Config schema resolves default values when input is empty or undefined', () => {
  const emptyResult = Config({})
  assert.equal(emptyResult.screenCapture, false, 'Default screenCapture must be false for explicit opt-in')

  const undefinedResult = Config(undefined)
  assert.equal(undefinedResult.screenCapture, false, 'Undefined input must resolve to default configuration')
})

test('Config schema honors explicit boolean values', () => {
  const enabled = Config({ screenCapture: true })
  assert.equal(enabled.screenCapture, true, 'screenCapture: true must be preserved')

  const disabled = Config({ screenCapture: false })
  assert.equal(disabled.screenCapture, false, 'screenCapture: false must be preserved')
})
