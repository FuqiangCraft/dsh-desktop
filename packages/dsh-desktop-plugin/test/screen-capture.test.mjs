import assert from 'node:assert/strict'
import test from 'node:test'
import {
  captureCommand,
  formatScreenCaptureOutput,
  screenRefFromValue,
} from '../src/tool-screen-capture.ts'

test('captureCommand resolves appropriate command and args for Windows', () => {
  const tempPath = 'C:\\temp\\capture test.png'
  const result = captureCommand(tempPath, 'win32')

  assert.equal(result.command, 'powershell')
  assert.ok(result.args.includes('-NoProfile'))
  assert.ok(result.args.includes('-NonInteractive'))
  const script = result.args[result.args.length - 1]
  assert.ok(script.includes('SetProcessDPIAware'))
  assert.ok(script.includes('System.Windows.Forms'))
  assert.ok(script.includes('CopyFromScreen'))
})

test('captureCommand resolves screencapture for macOS', () => {
  const tempPath = '/tmp/capture-123.png'
  const result = captureCommand(tempPath, 'darwin')

  assert.equal(result.command, 'screencapture')
  assert.deepEqual(result.args, ['-x', '-t', 'png', tempPath])
})

test('captureCommand resolves scrot for Linux X11', () => {
  const tempPath = '/tmp/capture-123.png'
  const result = captureCommand(tempPath, 'linux', {})

  assert.equal(result.command, 'scrot')
  assert.deepEqual(result.args, [tempPath])
})

test('captureCommand resolves grim for Linux Wayland', () => {
  const tempPath = '/tmp/capture-123.png'
  const result = captureCommand(tempPath, 'linux', { WAYLAND_DISPLAY: 'wayland-0' })

  assert.equal(result.command, 'grim')
  assert.deepEqual(result.args, [tempPath])
})

test('formatScreenCaptureOutput generates structured XML-tagged model representation', () => {
  const formatted = formatScreenCaptureOutput({
    attachmentId: 'att_123',
    mediaType: 'image/png',
    bytes: 102400,
    width: 1920,
    height: 1080,
  })

  assert.ok(formatted.includes('<source>screen</source>'))
  assert.ok(formatted.includes('<type>image</type>'))
  assert.ok(formatted.includes('1920x1080 px'))
  assert.ok(formatted.includes('102400 bytes'))
  assert.ok(formatted.includes('image/png image'))
})

test('screenRefFromValue constructs valid durable attachment reference', () => {
  const ref = screenRefFromValue({
    attachmentId: 'att_test_abc',
    mediaType: 'image/png',
    bytes: 4096,
    width: 800,
    height: 600,
    name: 'screenshot.png',
  })

  assert.equal(ref.attachmentId, 'att_test_abc')
  assert.equal(ref.mediaType, 'image/png')
  assert.equal(ref.bytes, 4096)
  assert.equal(ref.width, 800)
  assert.equal(ref.height, 600)
  assert.equal(ref.name, 'screenshot.png')
})
