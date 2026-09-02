import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adoptNativeWorkspace,
  findWorkspacePickerTarget,
  installNativeWorkspacePickerInterceptor,
  isWorkspacePickerDescriptor,
} from '../src/client/workspacePicker.ts'

test('intercepts the add-workspace control for the native folder dialog', () => {
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: '添加工作区',
    title: '',
    text: '',
    dataAction: null,
    className: '',
  }), true)
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: 'Add Workspace',
    title: '',
    text: '',
    dataAction: null,
    className: '',
  }), true)
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: '',
    title: '',
    text: '添加工作区…',
    dataAction: null,
    className: '',
  }), true)
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: '',
    title: 'Open Workspace',
    text: '',
    dataAction: null,
    className: '',
  }), true)
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: '',
    title: '',
    text: '',
    dataAction: 'add-workspace',
    className: '',
  }), true)
})

test('finds the add-workspace menu item when the click lands on its icon', () => {
  const OriginalElement = globalThis.Element
  class FakeElement {}
  globalThis.Element = FakeElement

  const menuItem = new FakeElement()
  menuItem.getAttribute = (name) => name === 'role' ? 'menuitem' : null
  menuItem.textContent = '添加工作区…'
  menuItem.className = ''
  const icon = new FakeElement()
  icon.closest = (selector) => selector.includes('[role="menuitem"]') ? menuItem : null

  try {
    assert.equal(findWorkspacePickerTarget(icon), menuItem)
  } finally {
    if (OriginalElement === undefined) delete globalThis.Element
    else globalThis.Element = OriginalElement
  }
})

test('installs the native picker above document-level workspace handlers', () => {
  const OriginalElement = globalThis.Element
  class FakeElement {}
  globalThis.Element = FakeElement

  const button = new FakeElement()
  button.getAttribute = (name) => name === 'aria-label' ? '添加工作区' : null
  button.textContent = ''
  button.className = ''
  button.closest = (selector) => selector === '#dsh-shell-titlebar' ? null : button

  const icon = new FakeElement()
  icon.closest = () => button
  const listeners = new Map()
  const root = {
    addEventListener(type, listener, capture) {
      listeners.set(type, { listener, capture })
    },
    removeEventListener(type) {
      listeners.delete(type)
    },
  }
  let opened = 0
  const cleanup = installNativeWorkspacePickerInterceptor(root, async () => {
    opened += 1
    return 'D:\\projects\\demo'
  })
  const event = {
    target: icon,
    detail: 1,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  }

  try {
    assert.equal(listeners.get('pointerdown')?.capture, true)
    assert.equal(listeners.get('click')?.capture, true)
    listeners.get('pointerdown').listener(event)
    assert.equal(opened, 1)
    cleanup()
    assert.equal(listeners.size, 0)
  } finally {
    if (OriginalElement === undefined) delete globalThis.Element
    else globalThis.Element = OriginalElement
  }
})

test('does not intercept the existing-workspace selector or workspace menus', () => {
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: '选择工作区',
    title: '',
    text: 'Contacts',
    dataAction: null,
    className: '',
  }), false)
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: 'Select Workspace',
    title: '',
    text: 'Contacts',
    dataAction: null,
    className: '',
  }), false)
  assert.equal(isWorkspacePickerDescriptor({
    ariaLabel: '工作区“Contacts”的操作',
    title: '',
    text: '',
    dataAction: null,
    className: '',
  }), false)
})

test('registers a native-picked directory and enters the resulting workspace', async () => {
  const calls = []
  const workspaces = {
    async create(input) {
      calls.push(['create', input])
      return { workspaceId: 'workspace-1' }
    },
    startSession(workspaceId) {
      calls.push(['startSession', workspaceId])
    },
  }

  await adoptNativeWorkspace(workspaces, 'D:\\projects\\demo')

  assert.deepEqual(calls, [
    ['create', { path: 'D:\\projects\\demo' }],
    ['startSession', 'workspace-1'],
  ])
})
