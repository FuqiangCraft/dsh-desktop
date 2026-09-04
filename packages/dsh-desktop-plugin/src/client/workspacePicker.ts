export interface WorkspacePickerDescriptor {
  ariaLabel: string | null
  title: string | null
  text: string | null
  dataAction: string | null
  className: string
}

export interface NativeWorkspaceService<WorkspaceId = string> {
  create(input: { path: string }): Promise<{ workspaceId: WorkspaceId }>
  startSession(workspaceId: WorkspaceId): void
}

export interface WorkspacePickerEventRoot {
  addEventListener(type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void
  removeEventListener(type: string, listener: EventListener, options?: boolean | EventListenerOptions): void
}

const WORKSPACE_PICKER_LABELS = new Set([
  '添加工作区',
  '添加工作空间',
  '打开工作区',
  '打开工作空间',
  'add workspace',
  'open workspace',
])

const CHOOSE_WORKSPACE_LABELS = new Set([
  '选择工作区',
  '选择工作空间',
  'choose workspace',
  'select workspace',
])

const normalizeLabel = (value: string | null): string => value
  ?.trim()
  .toLowerCase()
  .replace(/(?:\.{3}|…)+$/, '')
  .trim() ?? ''

export function isWorkspacePickerDescriptor(descriptor: WorkspacePickerDescriptor): boolean {
  if (descriptor.dataAction === 'add-workspace') return true
  if (descriptor.className.split(/\s+/).includes('dsh-workspace-opener')) return true

  const aria = normalizeLabel(descriptor.ariaLabel)
  const title = normalizeLabel(descriptor.title)
  const text = normalizeLabel(descriptor.text)

  if ([aria, title, text].some((label) => WORKSPACE_PICKER_LABELS.has(label))) {
    return true
  }

  // When no workspace is chosen yet, the central hero chip reads "选择工作区".
  // Intercept it to open the native folder chooser. When a workspace is already active
  // (e.g. text is "Contacts"), preserve the dropdown switcher behavior.
  if ([aria, title, text].some((label) => CHOOSE_WORKSPACE_LABELS.has(label))) {
    if (!text || CHOOSE_WORKSPACE_LABELS.has(text)) {
      return true
    }
  }

  return false
}

export function findWorkspacePickerTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const candidate = target.closest<HTMLElement>(
    'button, [role="button"], [role="menuitem"], [data-action="add-workspace"], .dsh-workspace-opener',
  )
  if (!candidate) return null

  return isWorkspacePickerDescriptor({
    ariaLabel: candidate.getAttribute('aria-label'),
    title: candidate.getAttribute('title'),
    text: candidate.textContent,
    dataAction: candidate.getAttribute('data-action'),
    className: candidate.className,
  }) ? candidate : null
}

/**
 * Intercept add-workspace activation before the web client's document-level
 * handlers can replace it with the in-page path picker. The caller passes
 * `window`, which is earlier than `document` in the capture path.
 */
export function installNativeWorkspacePickerInterceptor(
  root: WorkspacePickerEventRoot,
  selectWorkspaceFolder: () => Promise<string | null>,
): () => void {
  let inFlight = false
  const triggerNativePick = async () => {
    if (inFlight) return
    inFlight = true
    try {
      await selectWorkspaceFolder()
    } finally {
      setTimeout(() => {
        inFlight = false
      }, 400)
    }
  }

  const handleActivation: EventListener = (event) => {
    const wsButton = findWorkspacePickerTarget(event.target)
    if (!wsButton || wsButton.closest('#dsh-shell-titlebar')) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    void triggerNativePick().catch(console.error)
  }

  root.addEventListener('pointerdown', handleActivation, true)
  root.addEventListener('click', handleActivation, true)
  return () => {
    root.removeEventListener('pointerdown', handleActivation, true)
    root.removeEventListener('click', handleActivation, true)
  }
}

/**
 * Defense-in-depth: if an in-page directory browser dialog ever attempts to render,
 * close it immediately and launch the OS-native folder chooser instead.
 */
export function installWebDirectoryPickerFallbackSuppressor(
  selectWorkspaceFolder: () => Promise<string | null>,
): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {}
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        const hasBrowseTitle = node.textContent?.includes('选择工作区目录')
          || node.querySelector?.('.ZuhsRW_title, [class*="DirectoryBrowser_title"]')?.textContent?.includes('选择工作区目录')
        const hasBrowsePlugin = node.querySelector?.('[data-plugin-css*="ui-directory-picker-browse"]') != null

        if (hasBrowseTitle || hasBrowsePlugin) {
          node.style.display = 'none'
          const closeBtn = Array.from(node.querySelectorAll<HTMLElement>('button'))
            .find((b) => b.textContent?.trim() === '取消' || b.textContent?.trim() === 'Cancel')
          if (closeBtn) closeBtn.click()
          else if (typeof (node as HTMLDialogElement).close === 'function') {
            try {
              ;(node as HTMLDialogElement).close()
            } catch {
              // ignore
            }
          }
          void selectWorkspaceFolder().catch(console.error)
          return
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}

export async function adoptNativeWorkspace<WorkspaceId>(
  workspaces: NativeWorkspaceService<WorkspaceId>,
  path: string,
): Promise<void> {
  const workspace = await workspaces.create({ path })
  workspaces.startSession(workspace.workspaceId)
}
