import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(packageRoot, '..', '..')
const source = path.join(workspaceRoot, '.tauri-runtime')
const releaseRoot = path.join(workspaceRoot, 'target', 'release')
const executable = path.join(releaseRoot, process.platform === 'win32' ? 'dsh-desktop-tauri.exe' : 'dsh-desktop-tauri')
const destination = path.join(releaseRoot, 'runtime')

if (!fs.existsSync(executable)) throw new Error(`Missing Tauri release executable: ${executable}`)
if (!fs.existsSync(path.join(source, 'runtime-manifest.json'))) {
  throw new Error(`Missing prepared production runtime: ${source}`)
}

fs.rmSync(destination, { recursive: true, force: true })
fs.cpSync(source, destination, { recursive: true })
console.log(`Prepared portable Tauri release resources at ${destination}`)
