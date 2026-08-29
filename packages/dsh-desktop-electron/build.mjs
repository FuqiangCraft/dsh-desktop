import { build } from 'esbuild'
import { rmSync } from 'node:fs'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  external: ['electron', '@deepseek-ai/*', '@mixian/*', 'electron-updater'],
  logLevel: 'info',
}

// Start from a clean dist so stale artifacts (e.g. leftovers from the source
// recovery incident) can never ship inside the packaged app.
rmSync('dist', { recursive: true, force: true })
await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.cjs', format: 'cjs' })
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.cjs', format: 'cjs' })
await build({ ...common, entryPoints: ['src/tray-preload.ts'], outfile: 'dist/tray-preload.cjs', format: 'cjs' })
