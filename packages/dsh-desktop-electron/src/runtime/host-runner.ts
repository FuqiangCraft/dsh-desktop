import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
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
const require = createRequire(import.meta.url)

function resolveShippedAgentPresets(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'agent-presets')
  return path.join(path.dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'config', 'agent-presets')
}

function rebuildClientGraphFromInstallation(ctx: any, installAnchor: string): void {
  const registry = ctx.clientModules
  if (!registry || typeof registry.graph !== 'function') {
    throw new Error('dsh-desktop: 客户端插件清单服务未加载')
  }

  const packagedRequire = createRequire(installAnchor)
  registry.resolvePkgJson = (specifier: string) => packagedRequire.resolve(`${specifier}/package.json`)
  registry.pkgMeta.clear()
  registry.table.clear()
  for (const entry of ctx.loader.entries()) {
    if (entry.fiber !== undefined && !entry.disabled && typeof entry.options?.name === 'string') {
      registry.dirty.add(entry.options.name)
    }
  }

  const failures: Error[] = []
  registry.flush((error: Error) => failures.push(error))
  if (failures.length > 0) {
    throw new AggregateError(failures, 'dsh-desktop: 客户端插件清单重建失败')
  }

  const ids = new Set(registry.graph().entries.map((entry: any) => entry.id))
  for (const required of ['@deepseek-ai/dsh-client-modules', '@mixian/dsh-desktop-plugin']) {
    if (!ids.has(required)) {
      throw new Error(`dsh-desktop: 客户端插件清单缺少 ${required}`)
    }
  }
}

function assertAgentPresetRuntimePackages(installAnchor: string): void {
  const installedRequire = createRequire(installAnchor)
  for (const packageName of [
    '@deepseek-ai/dsh-persona',
    '@deepseek-ai/dsh-workflow',
    '@deepseek-ai/dsh-tool-ask-user',
  ]) {
    try {
      installedRequire.resolve(`${packageName}/package.json`)
    } catch {
      throw new Error(`dsh-desktop: Agent 预设运行依赖缺失：${packageName}`)
    }
  }
}

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
          surfaceContext: true,
          trustedHosts: ['127.0.0.1', 'localhost'],
        },
      },
      {
        id: 'webserver',
        config: {
          host: '127.0.0.1' as const,
          port,
        },
      },
      {
        id: 'agent-presets',
        config: {
          default: 'standard',
          roots: [
            {
              path: resolveShippedAgentPresets(),
              trust: 'system' as const,
            },
          ],
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
        pathToFileURL(installAnchor).href,
      )

      const agentPresets = (bootedContext as any).agentPresets
      if (!agentPresets || typeof agentPresets.list !== 'function') {
        throw new Error('dsh-desktop: Agent 预设服务未加载')
      }
      const presetRoster = await agentPresets.list()
      if (!Array.isArray(presetRoster) || !presetRoster.some((preset: any) => preset?.id === 'standard')) {
        throw new Error(`dsh-desktop: 内置 Agent 预设加载失败（目录：${resolveShippedAgentPresets()}）`)
      }

      assertAgentPresetRuntimePackages(installAnchor)
      rebuildClientGraphFromInstallation(bootedContext, installAnchor)


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
