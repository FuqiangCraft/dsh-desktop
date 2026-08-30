import React, { useEffect, useState } from 'react'
import type { DesktopKey } from '../locales.ts'

interface DesktopUpdateState {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  currentVersion: string
  availableVersion?: string
  percent?: number
  message?: string
}

interface UpdateBridge {
  getUpdateState?: () => Promise<DesktopUpdateState>
  checkForUpdates?: () => Promise<DesktopUpdateState>
  installUpdate?: () => Promise<boolean>
  onUpdateState?: (callback: (state: DesktopUpdateState) => void) => () => void
}

const getUpdateBridge = () => (window as unknown as { __DSH_DESKTOP_BRIDGE__?: UpdateBridge }).__DSH_DESKTOP_BRIDGE__

export const AppUpdateSettingsSection: React.FC<{ t: (key: DesktopKey) => string }> = ({ t }) => {
  const [state, setState] = useState<DesktopUpdateState | null>(null)

  useEffect(() => {
    const bridge = getUpdateBridge()
    if (!bridge?.getUpdateState) return
    void bridge.getUpdateState().then(setState)
    return bridge.onUpdateState?.(setState)
  }, [])

  if (!state) {
    return <div className="dsh_desktop_settingsSection">{t('settings.update.unavailable')}</div>
  }

  const buttonLabel = state.phase === 'checking'
    ? t('settings.update.checking')
    : state.phase === 'downloading'
      ? `${t('settings.update.downloading')} ${state.percent || 0}%`
      : state.phase === 'downloaded'
        ? t('settings.update.install')
        : t('settings.update.check')

  const handleUpdate = () => {
    const bridge = getUpdateBridge()
    if (state.phase === 'downloaded') void bridge?.installUpdate?.()
    else void bridge?.checkForUpdates?.().then(setState)
  }

  return (
    <div className="dsh_desktop_settingsSection dsh_desktop_petSettings">
      <div className="dsh_desktop_petPageHeader">
        <div>
          <h2 className="dsh_desktop_settingsTitle">{t('settings.update.title')}</h2>
          <p className="dsh_desktop_settingsSubtitle">{t('settings.update.subtitle')}</p>
        </div>
      </div>
      <div className="dsh_desktop_settingsCard dsh_desktop_petSizeRow">
        <div>
          <div className="dsh_desktop_settingsLabel">DeepSeek Harness {t('settings.update.desktop')}</div>
          <div className="dsh_desktop_settingsDesc">
            {t('settings.update.current')} {state.currentVersion} · {state.message || t('settings.update.hint')}
          </div>
        </div>
        <button
          className="dsh_desktop_petFolderButton"
          type="button"
          disabled={state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'available'}
          onClick={handleUpdate}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
