import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('LICENSE file exists and contains valid MIT license declaration', async () => {
  const content = await readFile(new URL('../LICENSE', import.meta.url), 'utf8')

  assert.ok(content.includes('MIT License'), 'LICENSE must specify MIT License')
  assert.ok(content.includes('Copyright (c) 2026'), 'LICENSE must include copyright year')
  assert.ok(content.includes('FuqiangCraft'), 'LICENSE must specify author FuqiangCraft')
  assert.ok(
    content.includes('Permission is hereby granted, free of charge'),
    'LICENSE must contain standard MIT permission grant',
  )
})
