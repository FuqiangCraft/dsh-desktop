/**
 * Desktop pet settings store with LocalStorage persistence and bridge sync.
 */

export interface DesktopSettings {
  /** Whether the desktop pet / companion floating widget is enabled. */
  petEnabled: boolean
  /** Selected character: one of 'robot' | 'whale' | 'cat', or 'custom:<name>' for a PNG in ~/.dsh/pets. */
  petCharacter: string
  /** Character size as a percentage of the default sprite size (60 - 140). */
  petSize: number
  /** Whether the companion window stays pinned on top of all desktop windows. */
  petAlwaysOnTop: boolean
  /** Opacity of the companion window (50 - 100). */
  petOpacity: number
  /** Whether mouse clicks pass through the companion window to windows underneath. */
  petClickThrough: boolean
  /** Whether global shortcut (Alt+Space) brings DSH to focus. */
  globalShortcutEnabled: boolean
  /** Whether notification sounds play on interactions and completions. */
  soundEnabled: boolean
  /** Notification sound volume percentage (0 - 100). */
  soundVolume: number
  /** Whether screen capture tool is authorized/enabled. */
  screenCaptureEnabled: boolean
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  petEnabled: true,
  petCharacter: 'robot',
  petSize: 100,
  petAlwaysOnTop: true,
  petOpacity: 100,
  petClickThrough: false,
  globalShortcutEnabled: true,
  soundEnabled: true,
  soundVolume: 80,
  screenCaptureEnabled: false,
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
      // Respect the persisted preference; default to enabled so a fresh
      // install shows the companion on first run.
      petEnabled: typeof parsed.petEnabled === 'boolean' ? parsed.petEnabled : DEFAULT_SETTINGS.petEnabled,
      petCharacter: typeof parsed.petCharacter === 'string' ? parsed.petCharacter : DEFAULT_SETTINGS.petCharacter,
      petSize: typeof parsed.petSize === 'number' ? Math.max(60, Math.min(140, parsed.petSize)) : DEFAULT_SETTINGS.petSize,
      petAlwaysOnTop: typeof parsed.petAlwaysOnTop === 'boolean' ? parsed.petAlwaysOnTop : DEFAULT_SETTINGS.petAlwaysOnTop,
      petOpacity: typeof parsed.petOpacity === 'number' ? Math.max(50, Math.min(100, parsed.petOpacity)) : DEFAULT_SETTINGS.petOpacity,
      petClickThrough: typeof parsed.petClickThrough === 'boolean' ? parsed.petClickThrough : DEFAULT_SETTINGS.petClickThrough,
      globalShortcutEnabled: typeof parsed.globalShortcutEnabled === 'boolean' ? parsed.globalShortcutEnabled : DEFAULT_SETTINGS.globalShortcutEnabled,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      soundVolume: typeof parsed.soundVolume === 'number' ? Math.max(0, Math.min(100, parsed.soundVolume)) : DEFAULT_SETTINGS.soundVolume,
      screenCaptureEnabled: typeof parsed.screenCaptureEnabled === 'boolean' ? parsed.screenCaptureEnabled : DEFAULT_SETTINGS.screenCaptureEnabled,
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

/** Push a settings snapshot to the native shell through the desktop bridge. */
export function syncDesktopSettingsToHost(settings: DesktopSettings): void {
  if (typeof window === 'undefined') return
  const bridge = (window as unknown as { __DSH_DESKTOP_BRIDGE__?: { syncSettings?: (settings: DesktopSettings) => void } }).__DSH_DESKTOP_BRIDGE__
  if (bridge?.syncSettings) {
    try {
      bridge.syncSettings(settings)
    } catch {
      // bridge invocation failure is non-fatal
    }
  }
}

/** Replace the renderer snapshot with the main-process source of truth. */
export function applyDesktopSettingsFromHost(settings: DesktopSettings): void {
  currentSettings = {
    petEnabled: settings.petEnabled === true,
    petCharacter: typeof settings.petCharacter === 'string' ? settings.petCharacter : DEFAULT_SETTINGS.petCharacter,
    petSize: typeof settings.petSize === 'number' ? Math.max(60, Math.min(140, settings.petSize)) : DEFAULT_SETTINGS.petSize,
    petAlwaysOnTop: typeof settings.petAlwaysOnTop === 'boolean' ? settings.petAlwaysOnTop : DEFAULT_SETTINGS.petAlwaysOnTop,
    petOpacity: typeof settings.petOpacity === 'number' ? Math.max(50, Math.min(100, settings.petOpacity)) : DEFAULT_SETTINGS.petOpacity,
    petClickThrough: typeof settings.petClickThrough === 'boolean' ? settings.petClickThrough : DEFAULT_SETTINGS.petClickThrough,
    globalShortcutEnabled: typeof settings.globalShortcutEnabled === 'boolean' ? settings.globalShortcutEnabled : DEFAULT_SETTINGS.globalShortcutEnabled,
    soundEnabled: typeof settings.soundEnabled === 'boolean' ? settings.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    soundVolume: typeof settings.soundVolume === 'number' ? Math.max(0, Math.min(100, settings.soundVolume)) : DEFAULT_SETTINGS.soundVolume,
    screenCaptureEnabled: typeof settings.screenCaptureEnabled === 'boolean' ? settings.screenCaptureEnabled : DEFAULT_SETTINGS.screenCaptureEnabled,
  }
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(currentSettings))
  } catch {}
  for (const listener of listeners) listener(currentSettings)
}

/** Reset settings to defaults. */
export function resetDesktopSettings(): DesktopSettings {
  return updateDesktopSettings(DEFAULT_SETTINGS)
}

if (typeof window !== 'undefined') {
  const bridge = (window as unknown as {
    __DSH_DESKTOP_BRIDGE__?: { onSettingsChanged?: (listener: (settings: DesktopSettings) => void) => void }
  }).__DSH_DESKTOP_BRIDGE__
  bridge?.onSettingsChanged?.((hostSettings) => {
    applyDesktopSettingsFromHost(hostSettings)
  })
}

