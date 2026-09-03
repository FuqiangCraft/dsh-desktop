import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { boot, healProfilesModuleFallback, loadProfile } from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import {
  createLaunchEnvironmentSnapshot,
  DSH_LAUNCH_ENVIRONMENT_KEY,
} from '@deepseek-ai/dsh-launch-environment'
import type { Context } from '@deepseek-ai/cordis'

const PROTOCOL = 1
const NAME = 'dsh-desktop'
const PROFILE = 'desktop'
// Resolve the profile dependency graph from the standalone sidecar bundle.
const moduleAnchor = typeof __filename === 'string' ? __filename : import.meta.url
const require = createRequire(moduleAnchor)

// Stdout is a machine-readable protocol channel. Runtime diagnostics belong
// on stderr so dependencies cannot corrupt the native host handshake.
console.log = (...args: unknown[]) => console.error(...args)
console.info = (...args: unknown[]) => console.error(...args)

function emit(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ ...event, protocol: PROTOCOL })}\n`)
}

// Canonical desktop profile patch. It disables the in-app directory picker and
// mounts the OS-native backend (real folder dialog, drive-root enumeration on
// Windows), so "add workspace" behaves like the File menu's "open workspace".
// Keep in sync with DesktopProfile::PATCH in
// packages/dsh-desktop-rust/src/profile.rs.
const DESKTOP_PROFILE_PATCH = `- id: directory-picker\n  disabled: true\n- insert:\n    - id: directory-picker-native\n      name: '@deepseek-ai/dsh-host-directory-picker-native'\n    - id: ui-directory-picker-native\n      name: '@deepseek-ai/dsh-client-ui-directory-picker-native'\n`

function healDesktopPluginFallback(homeDir: string): void {
  try {
    const pluginPkg = require.resolve('@mixian/dsh-desktop-plugin/package.json')
    const targetDir = path.dirname(pluginPkg)
    const linkDir = path.join(homeDir, 'profiles', 'node_modules', '@mixian', 'dsh-desktop-plugin')
    fs.mkdirSync(path.dirname(linkDir), { recursive: true })
    if (fs.existsSync(linkDir) || fs.lstatSync(linkDir, { throwIfNoEntry: false })) {
      try {
        if (fs.readlinkSync(linkDir) === targetDir) return
      } catch {
        // Not a link or readlink failed; remove it to re-create
      }
      try {
        fs.unlinkSync(linkDir)
      } catch {
        try {
          fs.rmdirSync(linkDir)
        } catch {
          // ignore cleanup errors
        }
      }
    }
    fs.symlinkSync(targetDir, linkDir, 'junction')
  } catch (error) {
    console.error('Failed to heal @mixian/dsh-desktop-plugin fallback link:', error)
  }
}

function ensureProfile(homeDir: string, installAnchor: string): string {
  const profileDir = path.join(homeDir, 'profiles', PROFILE)
  fs.mkdirSync(profileDir, { recursive: true })
  const manifestPath = path.join(profileDir, 'package.json')
  const patchPath = path.join(profileDir, 'cordis.patch.yml')
  const rootPath = path.join(profileDir, 'cordis.yml')

  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, `${JSON.stringify({
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
    }, null, 2)}\n`)
  }
  // Written once for fresh installs; upgrading pre-existing profiles is out
  // of scope (they can reset the profile to pick up the canonical patch).
  if (!fs.existsSync(patchPath)) {
    fs.writeFileSync(patchPath, DESKTOP_PROFILE_PATCH)
  }
  fs.writeFileSync(rootPath, '[]\n')
  healProfilesModuleFallback(installAnchor, homeDir)
  healDesktopPluginFallback(homeDir)
  return rootPath
}

async function probePort(start = 3080): Promise<number> {
  for (let port = start; port < start + 100; port += 1) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer()
      server.once('error', () => resolve(false))
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
    })
    if (available) return port
  }
  throw new Error(`No free loopback port in range ${start}-${start + 99}`)
}

function environmentSnapshot() {
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) values[key] = value
  }
  return createLaunchEnvironmentSnapshot([{ source: 'process', values }])
}

async function start(): Promise<Context> {
  const requestedProtocol = Number(process.env.DSH_SIDECAR_PROTOCOL || PROTOCOL)
  if (requestedProtocol !== PROTOCOL) {
    throw new Error(`Unsupported native protocol ${requestedProtocol}; sidecar supports ${PROTOCOL}`)
  }

  const installAnchor = require.resolve('@deepseek-ai/dsh/package.json')
  const homeDir = process.env.DSH_DESKTOP_HOME || path.join(os.homedir(), '.dsh-desktop')
  process.env.DSH_HOME = homeDir
  process.env.BROWSER = 'none'
  const rootConfig = ensureProfile(homeDir, installAnchor)
  const profile = loadProfile(NAME, PROFILE, installAnchor, homeDir)
  const port = await probePort()
  const presetRoot = path.join(path.dirname(installAnchor), 'config', 'agent-presets')
  const patches = [
    ...profile.layers.flatMap((layer) => layer.patches),
    ...profile.patches,
    { id: 'web-runtime', config: { openBrowser: false, printUrl: false, surfaceContext: true, trustedHosts: ['127.0.0.1', 'localhost'] } },
    { id: 'webserver', config: { host: '127.0.0.1', port } },
    { id: 'agent-presets', config: { default: 'standard', roots: [{ path: presetRoot, trust: 'system' }] } },
  ]

  const ctx = await boot(
    NAME,
    rootConfig,
    structuredClone(patches),
    (hostCtx) => {
      hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, environmentSnapshot())
      provideCmdline(hostCtx, { args: [], exit: () => undefined })
    },
    pathToFileURL(installAnchor).href,
  )
  const boundPort = (ctx as Context & { webServer?: { port?: number } }).webServer?.port || port
  emit({
    type: 'ready',
    origin: `http://127.0.0.1:${boundPort}`,
    port: boundPort,
    generation: crypto.randomUUID(),
  })
  console.error(`[dsh-desktop-sidecar] ready port=${boundPort}`)
  return ctx
}

let context: Context | undefined
let stopping = false
async function stop(exitCode = 0): Promise<void> {
  if (stopping) return
  stopping = true
  try {
    await context?.fiber.dispose()
    emit({ type: 'stopped' })
  } catch (error) {
    console.error(error)
    exitCode = 1
  } finally {
    process.exit(exitCode)
  }
}

async function main(): Promise<void> {
  try {
    context = await start()
    const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
    lines.on('line', (line) => {
      try {
        const command = JSON.parse(line) as { type?: string, protocol?: number }
        if (command.protocol !== PROTOCOL) return
        if (command.type === 'shutdown') void stop(0)
      } catch (error) {
        console.error('Invalid native host command', error)
      }
    })
    process.once('SIGINT', () => void stop(0))
    process.once('SIGTERM', () => void stop(0))
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    emit({ type: 'error', message })
    process.exit(1)
  }
}

void main()
