import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/windows/application-menu.ts', import.meta.url), 'utf8')

test('application menu follows Chinese system locales', () => {
  assert.match(source, /startsWith\('zh'\)/)
  assert.match(source, /zh: \{/)
})

test('application menu falls back to English for other locales', () => {
  assert.match(source, /: 'en'/)
  assert.match(source, /locales\[menuLanguage\(locale\)\]/)
})

test('application menu has the ChatGPT-style top-level order and key actions', () => {
  assert.match(source, /label: copy\.file/)
  assert.match(source, /label: copy\.edit/)
  assert.match(source, /label: copy\.view/)
  assert.match(source, /label: copy\.window/)
  assert.match(source, /label: copy\.help/)
  assert.match(source, /role: 'undo'/)
  assert.doesNotMatch(source, /role: 'toggleDevTools'/)
  assert.match(source, /shell\.openExternal\(PROJECT_URL\)/)
})
