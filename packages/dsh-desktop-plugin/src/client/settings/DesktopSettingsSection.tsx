import React, { useEffect, useState } from 'react'
import type { DesktopKey } from '../locales.ts'
import { getDesktopSettings, subscribeDesktopSettings, updateDesktopSettings, type DesktopSettings } from './settingsStore.ts'
import robotPreview from '../assets/dsh-companion.png'
import whalePreview from '../assets/dsh-companion-whale.png'
import catPreview from '../assets/dsh-companion-cat.png'

export interface DesktopSettingsSectionProps { t: (key: DesktopKey) => string; close?: () => void }

const PETS: Array<{ id: DesktopSettings['petCharacter']; name: DesktopKey; description: DesktopKey; image: string }> = [
  { id: 'robot', name: 'settings.petCharacter.robot', description: 'settings.petCharacter.robotDesc', image: robotPreview },
  { id: 'whale', name: 'settings.petCharacter.whale', description: 'settings.petCharacter.whaleDesc', image: whalePreview },
  { id: 'cat', name: 'settings.petCharacter.cat', description: 'settings.petCharacter.catDesc', image: catPreview },
]

const invoke = (command: string, args?: Record<string, unknown>) => (window as unknown as {
  __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> }
}).__TAURI_INTERNALS__?.invoke?.(command, args)

export const DesktopSettingsSection: React.FC<DesktopSettingsSectionProps> = ({ t }) => {
  const [settings, setSettings] = useState<DesktopSettings>(getDesktopSettings)
  const [resourcePath, setResourcePath] = useState('~\\.dsh\\pets')
  const [customPets, setCustomPets] = useState<Array<{ name: string; preview: string }>>([])

  useEffect(() => subscribeDesktopSettings(setSettings), [])
  useEffect(() => { void Promise.resolve(invoke('get_pet_resource_path')).then((path) => { if (typeof path === 'string') setResourcePath(path) }) }, [])
  useEffect(() => {
    let cancelled = false
    void Promise.resolve(invoke('list_pet_resources')).then(async (names) => {
      if (!Array.isArray(names) || cancelled) return
      const pets = await Promise.all((names as string[]).map(async (name) => ({
        name,
        preview: (await Promise.resolve(invoke('read_pet_resource', { name }))) as string,
      })))
      if (!cancelled) setCustomPets(pets)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="dsh_desktop_settingsSection dsh_desktop_petSettings">
      <div className="dsh_desktop_petPageHeader">
        <div>
          <h2 className="dsh_desktop_settingsTitle">宠物</h2>
          <p className="dsh_desktop_settingsSubtitle">宠物会感知 Agent 状态，并突出显示需要关注的事项</p>
        </div>
        <button className="dsh_desktop_petToolbarButton" type="button" onClick={() => updateDesktopSettings({ petEnabled: !settings.petEnabled })}>
          {settings.petEnabled ? '收起宠物' : '显示宠物'}
        </button>
      </div>

      <div>
        <div className="dsh_desktop_settingsLabel">选择宠物</div>
        <div className="dsh_desktop_settingsDesc">选择陪伴你的桌面角色</div>
      </div>

      <div className="dsh_desktop_settingsCard dsh_desktop_petCatalog" role="list">
        {PETS.map((pet) => {
          const selected = settings.petCharacter === pet.id
          return (
            <div className={`dsh_desktop_petRow${selected ? ' is-selected' : ''}`} role="listitem" key={pet.id}>
              <img className="dsh_desktop_petThumbnail" src={pet.image} alt="" />
              <div className="dsh_desktop_petMeta">
                <div className="dsh_desktop_petName">{t(pet.name)}</div>
                <div className="dsh_desktop_petDescription">{t(pet.description)}</div>
              </div>
              <button className="dsh_desktop_petSelect" type="button" disabled={selected} aria-pressed={selected} onClick={() => updateDesktopSettings({ petCharacter: pet.id, petEnabled: true })}>
                {selected ? '已选' : '选择'}
              </button>
            </div>
          )
        })}
        {customPets.map((pet) => {
          const id = `custom:${pet.name}`
          const selected = settings.petCharacter === id
          return (
            <div className={`dsh_desktop_petRow${selected ? ' is-selected' : ''}`} role="listitem" key={id}>
              {pet.preview ? <img className="dsh_desktop_petThumbnail" src={pet.preview} alt="" /> : <div className="dsh_desktop_petThumbnailPlaceholder">🐾</div>}
              <div className="dsh_desktop_petMeta">
                <div className="dsh_desktop_petName">{pet.name}</div>
                <div className="dsh_desktop_petDescription">自定义宠物</div>
              </div>
              <button className="dsh_desktop_petSelect" type="button" disabled={selected} aria-pressed={selected} onClick={() => updateDesktopSettings({ petCharacter: id, petEnabled: true })}>
                {selected ? '已选' : '选择'}
              </button>
            </div>
          )
        })}
        <div className="dsh_desktop_petResourceRow">
          <div><div className="dsh_desktop_petName">自定义宠物</div><div className="dsh_desktop_petPath">{resourcePath}</div></div>
          <button className="dsh_desktop_petFolderButton" type="button" onClick={() => { void invoke('open_pet_resource_folder') }}>打开文件夹 ↗</button>
        </div>
      </div>

      <div className="dsh_desktop_petAppearance">
        <div className="dsh_desktop_settingsLabel">外观</div>
        <div className="dsh_desktop_settingsCard dsh_desktop_petSizeRow">
          <div><div className="dsh_desktop_settingsLabel">宠物大小</div><div className="dsh_desktop_settingsDesc">调整桌面宠物比例大小</div></div>
          <div className="dsh_desktop_settingsSliderContainer">
            <input className="dsh_desktop_settingsSlider" aria-label="宠物大小" type="range" min="60" max="140" step="5" value={settings.petSize} onChange={(event) => updateDesktopSettings({ petSize: Number(event.target.value) })} />
            <span className="dsh_desktop_settingsSliderValue">{settings.petSize}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
