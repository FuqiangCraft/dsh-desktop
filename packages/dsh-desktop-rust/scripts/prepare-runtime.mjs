import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = path.resolve(packageRoot, '..', '..')
// Keep the staging path close to the workspace root. NSIS still encounters the
// legacy Windows path limit while walking dependency trees with long filenames.
const outputRoot = path.join(workspaceRoot, '.tauri-runtime')

function run(command, args, extraEnv = {}) {
  const useBundledCorepack = process.platform === 'win32' && command === 'pnpm'
  const executable = useBundledCorepack ? process.execPath : command
  const commandArgs = useBundledCorepack
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'pnpm.js'), ...args]
    : args
  const result = spawnSync(executable, commandArgs, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...extraEnv },
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

if (Number(process.versions.node.split('.')[0]) < 22) {
  throw new Error(`Node.js 22 or newer is required, found ${process.version}`)
}

fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(outputRoot, { recursive: true })

run('pnpm', ['--filter', '@dsh-community/dsh-desktop-sidecar', 'build'])
run('pnpm', [
  '--config.inject-workspace-packages=true',
  '--config.node-linker=hoisted',
  '--config.virtual-store-dir-max-length=24',
  '--filter', '@dsh-community/dsh-desktop-sidecar',
  '--prod', 'deploy', outputRoot,
], { CI: 'true' })

// Type declarations and source maps are development artifacts. Besides wasting
// installer space, some generated SDK declarations exceed NSIS' path limit.
for (const directory of [path.join(outputRoot, 'node_modules')]) {
  const pending = [directory]
  while (pending.length > 0) {
    const current = pending.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) pending.push(target)
      else if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.map')) fs.rmSync(target)
    }
  }
}

const sidecarSource = path.join(workspaceRoot, 'packages', 'dsh-desktop-sidecar', 'dist', 'main.mjs')
const sidecarTarget = path.join(outputRoot, 'sidecar.mjs')
const binDir = path.join(outputRoot, 'bin')
const nodeTarget = path.join(binDir, process.platform === 'win32' ? 'dsh-node.exe' : 'dsh-node')
fs.mkdirSync(binDir, { recursive: true })
fs.copyFileSync(sidecarSource, sidecarTarget)
fs.copyFileSync(process.execPath, nodeTarget)

const requiredPackages = [
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-app-boot',
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@mixian/dsh-desktop-plugin',
]
for (const packageName of requiredPackages) {
  const packageJson = path.join(outputRoot, 'node_modules', ...packageName.split('/'), 'package.json')
  if (!fs.existsSync(packageJson)) throw new Error(`Production runtime is missing ${packageName}`)
}

const manifest = {
  schemaVersion: 1,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  nodeSha256: sha256(nodeTarget),
  sidecarSha256: sha256(sidecarTarget),
  requiredPackages,
}
fs.writeFileSync(path.join(outputRoot, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Prepared Tauri runtime at ${outputRoot}`)
