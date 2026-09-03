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

  // Always render the section; while the host has not yet reported a state
  // (e.g. first launch before getUpdateState resolves), fall back to a neutral
  // idle state so the "check for updates" button stays visible.
  const current: DesktopUpdateState = state ?? {
    phase: 'idle',
    currentVersion: '',
    message: undefined,
  }

  const buttonLabel = current.phase === 'checking'
    ? t('settings.update.checking')
    : current.phase === 'downloading'
      ? `${t('settings.update.downloading')} ${current.percent || 0}%`
      : current.phase === 'downloaded'
        ? t('settings.update.install')
        : current.phase === 'error'
          ? t('settings.update.retry')
          : t('settings.update.check')

  const handleUpdate = async () => {
    const bridge = getUpdateBridge()
    if (current.phase === 'downloaded') {
      if (!bridge?.installUpdate) return
      try {
        await bridge.installUpdate()
      } catch (error) {
        setState({
          ...current,
          phase: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    if (!bridge?.checkForUpdates) {
      setState({ ...current, phase: 'error', message: t('settings.update.unavailable') })
      return
    }

    setState({
      ...current,
      phase: 'checking',
      availableVersion: undefined,
      percent: undefined,
      message: t('settings.update.checking'),
    })
    try {
      setState(await bridge.checkForUpdates())
    } catch (error) {
      setState({
        ...current,
        phase: 'error',
        availableVersion: undefined,
        percent: undefined,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const statusMessage = current.phase === 'error'
    ? `${t('settings.update.failed')}：${current.message || t('settings.update.unavailable')}`
    : current.message || t('settings.update.hint')

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
          <div className={`dsh_desktop_settingsDesc${current.phase === 'error' ? ' dsh_desktop_updateError' : ''}`}>
            {current.currentVersion
              ? `${t('settings.update.current')} ${current.currentVersion} · ${statusMessage}`
              : statusMessage}
          </div>
        </div>
        <button
          className="dsh_desktop_petFolderButton"
          type="button"
          disabled={current.phase === 'checking' || current.phase === 'downloading' || current.phase === 'available'}
          onClick={() => void handleUpdate()}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
