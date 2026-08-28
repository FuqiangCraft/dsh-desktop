import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'dist')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

// 1. Build main process
await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/main.ts')],
  outfile: path.join(outDir, 'main.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: [
    'electron',
    'electron-updater',
    'koffi',
    'node-pty',
    '@deepseek-ai/*',
    '@mixian/*',
    'js-yaml',
    'open',
  ],
})

// 2. Build preload script
await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/preload.ts')],
  outfile: path.join(outDir, 'preload.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['electron'],
})

await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/tray-preload.ts')],
  outfile: path.join(outDir, 'tray-preload.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['electron'],
})

// 3. Build runtime modules for unit testing
await esbuild.build({
  entryPoints: [
    path.join(__dirname, 'src/runtime/port-probe.ts'),
    path.join(__dirname, 'src/runtime/settings-store.ts'),
    path.join(__dirname, 'src/runtime/profile-manager.ts'),
    path.join(__dirname, 'src/runtime/host-runner.ts'),
    path.join(__dirname, 'src/runtime/paths.ts'),
  ],
  outdir: path.join(outDir, 'runtime'),
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
})

console.log('Build completed: dist/main.js, dist/preload.cjs, dist/tray-preload.cjs, dist/runtime/*.js')
