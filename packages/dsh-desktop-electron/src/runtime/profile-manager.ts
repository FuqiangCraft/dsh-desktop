import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { healProfilesModuleFallback } from '@deepseek-ai/dsh-app-boot'
import { getPackageRoot } from './paths.ts'

export const DESKTOP_PROFILE_NAME = 'desktop'

export const DEFAULT_DESKTOP_PROFILE_MANIFEST = {
  name: 'dsh-desktop-profile',
  private: true,
  dsh: {
    profile: {
      bundles: [
        '@deepseek-ai/dsh-base',
        '@deepseek-ai/dsh-web-app',
        '@mixian/dsh-desktop-plugin',
      ],
    },
  },
}

export const DEFAULT_DESKTOP_PATCH = `# Desktop profile cordis patch
- id: directory-picker
  disabled: true
- insert:
    - id: directory-picker-native
      name: '@deepseek-ai/dsh-host-directory-picker-native'
    - id: ui-directory-picker-native
      name: '@deepseek-ai/dsh-client-ui-directory-picker-native'
- id: web-runtime
  config:
    openBrowser: false
    printUrl: false
`

export const PROFILE_ROOT_CONFIG = `# dsh profile root
[]
`

export interface ProfilePaths {
  homeDir: string
  profilesDir: string
  profileDir: string
  manifestPath: string
  patchPath: string
  rootConfigPath: string
  checkpointPath: string
}

export class DesktopProfileManager {
  public readonly paths: ProfilePaths

  constructor(customHomeDir?: string) {
    const homeDir = customHomeDir || process.env.DSH_DESKTOP_HOME || path.join(os.homedir(), '.dsh-desktop')
    const profilesDir = path.join(homeDir, 'profiles')
    const profileDir = path.join(profilesDir, DESKTOP_PROFILE_NAME)
    this.paths = {
      homeDir,
      profilesDir,
      profileDir,
      manifestPath: path.join(profileDir, 'package.json'),
      patchPath: path.join(profileDir, 'cordis.patch.yml'),
      rootConfigPath: path.join(profileDir, 'cordis.yml'),
      checkpointPath: path.join(profileDir, '.checkpoint.json'),
    }
  }

  public ensureProfile(): void {
    if (!fs.existsSync(this.paths.profileDir)) {
      fs.mkdirSync(this.paths.profileDir, { recursive: true })
    }

    if (!fs.existsSync(this.paths.manifestPath)) {
      fs.writeFileSync(
        this.paths.manifestPath,
        JSON.stringify(DEFAULT_DESKTOP_PROFILE_MANIFEST, null, 2) + '\n',
        'utf8',
      )
    } else {
      try {
        const raw = fs.readFileSync(this.paths.manifestPath, 'utf8')
        const parsed = JSON.parse(raw)
        const bundles: string[] = parsed.dsh?.profile?.bundles || []
        let changed = false
        for (const req of DEFAULT_DESKTOP_PROFILE_MANIFEST.dsh.profile.bundles) {
          if (!bundles.includes(req)) {
            bundles.unshift(req)
            changed = true
          }
        }
        if (changed) {
          if (!parsed.dsh) parsed.dsh = {}
          if (!parsed.dsh.profile) parsed.dsh.profile = {}
          parsed.dsh.profile.bundles = bundles
          fs.writeFileSync(this.paths.manifestPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
        }
      } catch {
        // ignore parse error, will be handled by checkpoint restore
      }
    }

    if (!fs.existsSync(this.paths.patchPath)) {
      fs.writeFileSync(this.paths.patchPath, DEFAULT_DESKTOP_PATCH, 'utf8')
    }

    // cordis.yml is always written as empty root entry list
    fs.writeFileSync(this.paths.rootConfigPath, PROFILE_ROOT_CONFIG, 'utf8')

    this.saveCheckpoint()
    this.healFallback()
  }

  public healFallback(): void {
    try {
      // Find package.json of @deepseek-ai/dsh or dsh-desktop-electron as installAnchor
      const packageJsonPath = path.join(getPackageRoot(), 'package.json')
      healProfilesModuleFallback(packageJsonPath, this.paths.homeDir)
    } catch {
      // ignore fallback healing failure if run standalone
    }
  }

  public saveCheckpoint(): void {
    try {
      if (fs.existsSync(this.paths.manifestPath) && fs.existsSync(this.paths.patchPath)) {
        const manifest = fs.readFileSync(this.paths.manifestPath, 'utf8')
        const patch = fs.readFileSync(this.paths.patchPath, 'utf8')
        fs.writeFileSync(
          this.paths.checkpointPath,
          JSON.stringify({ manifest, patch, timestamp: Date.now() }, null, 2),
          'utf8',
        )
      }
    } catch {
      // ignore
    }
  }

  public restoreFromCheckpoint(): boolean {
    try {
      if (fs.existsSync(this.paths.checkpointPath)) {
        const raw = fs.readFileSync(this.paths.checkpointPath, 'utf8')
        const checkpoint = JSON.parse(raw) as { manifest?: string; patch?: string }
        if (checkpoint.manifest && checkpoint.patch) {
          fs.writeFileSync(this.paths.manifestPath, checkpoint.manifest, 'utf8')
          fs.writeFileSync(this.paths.patchPath, checkpoint.patch, 'utf8')
          fs.writeFileSync(this.paths.rootConfigPath, PROFILE_ROOT_CONFIG, 'utf8')
          return true
        }
      }
    } catch {
      // ignore
    }
    return this.resetProfile()
  }

  public resetProfile(): boolean {
    try {
      if (!fs.existsSync(this.paths.profileDir)) {
        fs.mkdirSync(this.paths.profileDir, { recursive: true })
      }
      fs.writeFileSync(
        this.paths.manifestPath,
        JSON.stringify(DEFAULT_DESKTOP_PROFILE_MANIFEST, null, 2) + '\n',
        'utf8',
      )
      fs.writeFileSync(this.paths.patchPath, DEFAULT_DESKTOP_PATCH, 'utf8')
      fs.writeFileSync(this.paths.rootConfigPath, PROFILE_ROOT_CONFIG, 'utf8')
      this.saveCheckpoint()
      this.healFallback()
      return true
    } catch {
      return false
    }
  }
}
