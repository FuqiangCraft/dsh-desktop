import { build } from 'esbuild'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  external: ['electron', '@deepseek-ai/*', '@mixian/*', 'electron-updater'],
  logLevel: 'info',
}

await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.cjs', format: 'cjs' })
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.cjs', format: 'cjs' })
await build({ ...common, entryPoints: ['src/tray-preload.ts'], outfile: 'dist/tray-preload.cjs', format: 'cjs' })
