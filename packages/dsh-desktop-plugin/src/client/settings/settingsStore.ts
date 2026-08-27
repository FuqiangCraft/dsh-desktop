/**
 * Desktop pet settings store with LocalStorage persistence and bridge sync.
 */

export interface DesktopSettings {
  /** Whether the desktop pet / companion floating widget is enabled. */
  petEnabled: boolean
  /** Selected character: one of 'robot' | 'whale' | 'cat', or 'custom:<name>' for a PNG in ~/.dsh/pets. */
  petCharacter: string
  /** Character size as a percentage of the default sprite size. */
  petSize: number
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  petEnabled: true,
  petCharacter: 'robot',
  petSize: 100,
}

const STORAGE_KEY = 'dsh.desktop.settings'

type Listener = (settings: DesktopSettings) => void
const listeners = new Set<Listener>()

let currentSettings: DesktopSettings = loadInitialSettings()

function loadInitialSettings(): DesktopSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<DesktopSettings>
    const settings: DesktopSettings = {
      petEnabled: typeof parsed.petEnabled === 'boolean' ? parsed.petEnabled : DEFAULT_SETTINGS.petEnabled,
      petCharacter: typeof parsed.petCharacter === 'string' ? parsed.petCharacter : DEFAULT_SETTINGS.petCharacter,
      petSize: typeof parsed.petSize === 'number' ? Math.max(60, Math.min(140, parsed.petSize)) : DEFAULT_SETTINGS.petSize,
    }
    // Migrate the retired wooden-fish character to the default companion.
    if (settings.petCharacter === 'woodfish') settings.petCharacter = DEFAULT_SETTINGS.petCharacter
    return settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Get current settings snapshot. */
export function getDesktopSettings(): DesktopSettings {
  return currentSettings
}

/** Subscribe to settings changes. */
export function subscribeDesktopSettings(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Update partial settings and notify subscribers + native bridge. */
export function updateDesktopSettings(patch: Partial<DesktopSettings>): DesktopSettings {
  currentSettings = {
    ...currentSettings,
    ...patch,
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings))
    } catch {
      // ignore storage quota errors
    }
  }

  syncDesktopSettingsToHost(currentSettings)

  for (const listener of listeners) {
    try {
      listener(currentSettings)
    } catch {
      // listener error should not break others
    }
  }

  return currentSettings
}

/** Push a settings snapshot to the native shell through either supported IPC seam. */
export function syncDesktopSettingsToHost(settings: DesktopSettings): void {
  if (typeof window !== 'undefined') {
    const bridge = (window as unknown as { __DSH_DESKTOP_BRIDGE__?: { syncSettings?: (settings: DesktopSettings) => void } }).__DSH_DESKTOP_BRIDGE__
    if (bridge?.syncSettings) {
      try {
        bridge.syncSettings(settings)
      } catch {
        // bridge invocation failure is non-fatal
      }
      return
    }
    const invoke = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__?.invoke
    if (typeof invoke === 'function') {
      void invoke('sync_desktop_settings', { settings })
    }
  }
}

/** Reset settings to defaults. */
export function resetDesktopSettings(): DesktopSettings {
  return updateDesktopSettings(DEFAULT_SETTINGS)
}
