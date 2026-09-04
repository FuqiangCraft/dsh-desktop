import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(packageRoot, '..', '..')
const runtimeSidecar = path.join(workspaceRoot, '.tauri-runtime', 'sidecar.mjs')
const sidecarEntry = fs.existsSync(runtimeSidecar)
  ? runtimeSidecar
  : path.join(workspaceRoot, 'packages', 'dsh-desktop-sidecar', 'dist', 'main.mjs')
const developmentTarget = path.join(workspaceRoot, 'target', 'dev')
const useBundledCorepack = process.platform === 'win32'
const executable = useBundledCorepack ? process.execPath : 'pnpm'
const commandArgs = useBundledCorepack
  ? [path.join(path.dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'pnpm.js')]
  : []

const targetArgs = process.platform === 'win32'
  ? ['--target', process.env.TAURI_TARGET || 'x86_64-pc-windows-gnu']
  : []

const child = spawn(
  executable,
  [...commandArgs, 'exec', 'tauri', 'dev', '--config', 'packages/dsh-desktop-rust/tauri.conf.json', '--features', 'tauri-shell', ...targetArgs],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: developmentTarget,
      DSH_SIDECAR_ENTRY: sidecarEntry,
    },
    stdio: 'inherit',
    shell: false,
  },
)

child.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
