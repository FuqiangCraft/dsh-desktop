import path from 'node:path'
import crypto from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import {
  boot,
  loadProfile,
} from '@deepseek-ai/dsh-app-boot'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { DesktopProfileManager, DESKTOP_PROFILE_NAME } from './profile-manager.ts'
import { probeFreePort } from './port-probe.ts'
import { getPackageRoot } from './paths.ts'

export interface HostInstance {
  origin: string
  port: number
  generation: string
  ctx: Context
  dispose: () => Promise<void>
}

const NAME = 'dsh-desktop'

export class DesktopHostRunner {
  private currentInstance: HostInstance | null = null
  private readonly profileManager: DesktopProfileManager

  constructor(profileManager?: DesktopProfileManager) {
    this.profileManager = profileManager || new DesktopProfileManager()
  }

  public async start(): Promise<HostInstance> {
    if (this.currentInstance) {
      await this.stop()
    }

    // 1. Ensure Profile files exist
    this.profileManager.ensureProfile()

    // 2. Set process environment
    process.env.DSH_HOME = this.profileManager.paths.homeDir
    process.env.BROWSER = 'none'

    // 3. Probe dynamic available port
    const port = await probeFreePort(3080, '127.0.0.1')

    const installAnchor = path.join(getPackageRoot(), 'package.json')

    // 4. Load Profile
    const profile = loadProfile(
      NAME,
      DESKTOP_PROFILE_NAME,
      installAnchor,
      this.profileManager.paths.homeDir,
    )

    const bundlePatches = profile.layers.flatMap((layer) => layer.patches)
    const profilePatches = profile.patches

    // Overlay to enforce port and no browser opening
    const runtimeOverlay = [
      {
        id: 'web-runtime',
        config: {
          openBrowser: false,
          printUrl: false,
        },
      },
      {
        id: 'webserver',
        config: {
          host: '127.0.0.1' as const,
          port,
        },
      },
    ]

    const allPatches = [
      ...bundlePatches,
      ...profilePatches,
      ...runtimeOverlay,
    ]

    const generation = crypto.randomUUID()
    const envValues: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        envValues[key] = value
      }
    }
    const envSnapshot = createLaunchEnvironmentSnapshot([
      {
        source: 'process',
        values: envValues,
      },
    ])

    let bootedContext: Context | null = null

    try {
      const rootConfig = this.profileManager.paths.rootConfigPath

      bootedContext = await boot(
        NAME,
        rootConfig,
        structuredClone(allPatches),
        (hostCtx) => {
          hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, envSnapshot)
          provideCmdline(hostCtx, {
            args: [],
            exit: () => {
              // App exit requested
            },
          })
        },
      )

      // Read listening port from webServer service or probed port
      const boundPort = (bootedContext as any).webServer?.port || port
      const origin = `http://127.0.0.1:${boundPort}`

      const instance: HostInstance = {
        origin,
        port: boundPort,
        generation,
        ctx: bootedContext,
        dispose: async () => {
          if (bootedContext) {
            try {
              await bootedContext.fiber.dispose()
            } catch {
              // ignore disposal errors
            }
          }
        },
      }

      this.currentInstance = instance
      return instance
    } catch (err) {
      if (bootedContext) {
        try {
          await (bootedContext as Context).fiber.dispose()
        } catch {
          // ignore
        }
      }
      throw err
    }
  }

  public async stop(): Promise<void> {
    if (this.currentInstance) {
      const inst = this.currentInstance
      this.currentInstance = null
      await inst.dispose()
    }
  }

  public getCurrentInstance(): HostInstance | null {
    return this.currentInstance
  }
}
