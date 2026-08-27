import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface DesktopSettings {
  petEnabled: boolean
  petCharacter: string
  petSize: number
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  petEnabled: false,
  petCharacter: 'robot',
  petSize: 100,
}

export interface PetPosition {
  x: number
  y: number
}

export interface RecentSession {
  id: string
  title: string
}

export class DesktopSettingsStore {
  private readonly configDir: string
  private readonly settingsFile: string
  private readonly petPositionFile: string
  private readonly petsDir: string
  private cachedSettings: DesktopSettings | null = null

  constructor(customConfigDir?: string) {
    const home = customConfigDir || process.env.DSH_DESKTOP_HOME || path.join(os.homedir(), '.dsh-desktop')
    this.configDir = home
    this.settingsFile = path.join(this.configDir, 'desktop-settings.json')
    this.petPositionFile = path.join(this.configDir, 'pet-position.json')
    this.petsDir = path.join(this.configDir, 'pets')
    this.ensureDir(this.configDir)
    this.ensureDir(this.petsDir)
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch {
        // ignore
      }
    }
  }

  public getSettings(): DesktopSettings {
    if (this.cachedSettings) return { ...this.cachedSettings }
    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = fs.readFileSync(this.settingsFile, 'utf8')
        const parsed = JSON.parse(raw) as Partial<DesktopSettings>
        this.cachedSettings = {
          petEnabled: typeof parsed.petEnabled === 'boolean' ? parsed.petEnabled : DEFAULT_SETTINGS.petEnabled,
          petCharacter: typeof parsed.petCharacter === 'string' ? parsed.petCharacter : DEFAULT_SETTINGS.petCharacter,
          petSize: typeof parsed.petSize === 'number' ? Math.max(60, Math.min(140, parsed.petSize)) : DEFAULT_SETTINGS.petSize,
        }
        return { ...this.cachedSettings }
      }
    } catch {
      // ignore
    }
    this.cachedSettings = { ...DEFAULT_SETTINGS }
    return { ...this.cachedSettings }
  }

  public saveSettings(patch: Partial<DesktopSettings>): DesktopSettings {
    const current = this.getSettings()
    const updated: DesktopSettings = {
      petEnabled: typeof patch.petEnabled === 'boolean' ? patch.petEnabled : current.petEnabled,
      petCharacter: typeof patch.petCharacter === 'string' ? patch.petCharacter : current.petCharacter,
      petSize: typeof patch.petSize === 'number' ? Math.max(60, Math.min(140, patch.petSize)) : current.petSize,
    }
    this.cachedSettings = updated
    try {
      this.ensureDir(this.configDir)
      fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2), 'utf8')
    } catch {
      // ignore write errors
    }
    return { ...updated }
  }

  public getPetPosition(): PetPosition | null {
    try {
      if (fs.existsSync(this.petPositionFile)) {
        const raw = fs.readFileSync(this.petPositionFile, 'utf8')
        const parsed = JSON.parse(raw) as Partial<PetPosition>
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return { x: parsed.x, y: parsed.y }
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  public savePetPosition(pos: PetPosition): void {
    try {
      this.ensureDir(this.configDir)
      fs.writeFileSync(this.petPositionFile, JSON.stringify(pos, null, 2), 'utf8')
    } catch {
      // ignore
    }
  }

  public getPetsDir(): string {
    this.ensureDir(this.petsDir)
    return this.petsDir
  }

  public listPetResources(): string[] {
    const pets: string[] = []
    const checkDir = (dir: string) => {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir)
          for (const file of files) {
            if (file.toLowerCase().endsWith('.png')) {
              const stem = path.basename(file, path.extname(file))
              if (!pets.includes(stem)) {
                pets.push(stem)
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
    checkDir(this.petsDir)
    // Also check legacy ~/.dsh/pets for backward compatibility
    const legacyPetsDir = path.join(os.homedir(), '.dsh', 'pets')
    checkDir(legacyPetsDir)
    pets.sort()
    return pets
  }

  public readPetResource(name: string): string | null {
    const safe = name
      .replace(/[/\\..]/g, '_')
      .slice(0, 80)
    
    const candidates = [
      path.join(this.petsDir, `${safe}.png`),
      path.join(os.homedir(), '.dsh', 'pets', `${safe}.png`),
    ]

    for (const file of candidates) {
      if (fs.existsSync(file)) {
        try {
          const bytes = fs.readFileSync(file)
          return `data:image/png;base64,${bytes.toString('base64')}`
        } catch {
          // ignore
        }
      }
    }
    return null
  }
}
