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

const WORKSPACE_PICKER_LABELS = new Set([
  '添加工作区',
  '添加工作空间',
  '打开工作区',
  '打开工作空间',
  'add workspace',
  'open workspace',
])

const normalizeLabel = (value: string | null): string => value
  ?.trim()
  .toLowerCase()
  .replace(/(?:\.{3}|…)+$/, '')
  .trim() ?? ''

export function isWorkspacePickerDescriptor(descriptor: WorkspacePickerDescriptor): boolean {
  if (descriptor.dataAction === 'add-workspace') return true
  if (descriptor.className.split(/\s+/).includes('dsh-workspace-opener')) return true

  return [descriptor.ariaLabel, descriptor.title, descriptor.text]
    .map(normalizeLabel)
    .some((label) => WORKSPACE_PICKER_LABELS.has(label))
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

export async function adoptNativeWorkspace<WorkspaceId>(
  workspaces: NativeWorkspaceService<WorkspaceId>,
  path: string,
): Promise<void> {
  const workspace = await workspaces.create({ path })
  workspaces.startSession(workspace.workspaceId)
}
