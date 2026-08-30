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
await build({ ...common, entryPoints: ['src/runtime/port-probe.ts'], outfile: 'dist/runtime/port-probe.js', format: 'esm' })
await build({
  ...common,
  entryPoints: ['src/runtime/profile-manager.ts'],
  outfile: 'dist/runtime/profile-manager.js',
  format: 'esm',
  banner: {
    js: "import { fileURLToPath as __dshFileURLToPath } from 'node:url'; import { dirname as __dshDirname } from 'node:path'; const __filename = __dshFileURLToPath(import.meta.url); const __dirname = __dshDirname(__filename);",
  },
})
await build({ ...common, entryPoints: ['src/runtime/settings-store.ts'], outfile: 'dist/runtime/settings-store.js', format: 'esm' })
