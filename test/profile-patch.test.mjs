import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const sidecar = await readFile(new URL('../packages/dsh-desktop-sidecar/src/main.ts', import.meta.url), 'utf8')
const rust = await readFile(new URL('../packages/dsh-desktop-rust/src/profile.rs', import.meta.url), 'utf8')

function extractSidecarPatch(source) {
  const match = source.match(/const DESKTOP_PROFILE_PATCH = `([^`]*)`/)
  return match ? match[1] : null
}

function extractRustPatch(source) {
  const rawMatch = source.match(/const PATCH: &str = r#"([\s\S]*?)"#;/)
  if (rawMatch) return rawMatch[1]
  const strMatch = source.match(/const PATCH: &str = "([\s\S]*?)";/)
  return strMatch ? strMatch[1] : null
}

function normalizePatch(text) {
  if (!text) return null
  return text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
}

test('sidecar and Rust ship the same native directory-picker profile patch', () => {
  const sidecarPatch = extractSidecarPatch(sidecar)
  const rustPatch = extractRustPatch(rust)
  assert.ok(sidecarPatch, 'sidecar main.ts must define DESKTOP_PROFILE_PATCH')
  assert.ok(rustPatch, 'profile.rs must define PATCH')
  assert.equal(
    normalizePatch(sidecarPatch),
    normalizePatch(rustPatch),
    'the profile patch source of truth must not drift between main.ts and profile.rs',
  )
  assert.ok(sidecarPatch.includes('directory-picker-native'), 'canonical patch must mount the native directory picker')
  assert.ok(sidecarPatch.includes("'@deepseek-ai/dsh-host-directory-picker-native'"), 'canonical patch must name the native host plugin')
  assert.ok(sidecarPatch.includes("'@deepseek-ai/dsh-client-ui-directory-picker-native'"), 'canonical patch must name the native client plugin')
})

test('neither source ever ships the legacy browse backend', () => {
  assert.ok(!sidecar.includes('directory-picker-browse'), 'main.ts must not reintroduce the legacy browse picker')
  assert.ok(!rust.includes('directory-picker-browse'), 'profile.rs must not reintroduce the legacy browse picker')
})
