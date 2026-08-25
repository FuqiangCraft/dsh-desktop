/**
 * Single-file client + ESM host build for @mixian/dsh-desktop-plugin.
 *
 * The web server serves exactly one file per plugin (/plugins/<id>/client.js),
 * so the client half is one CJS bundle wrapped in the ModuleLoader factory
 * handshake; @deepseek-ai/dsh-* and react stay external (the profile's healed
 * node_modules and the app's module system provide them). The host half is
 * plain ESM for Node, externalizing @deepseek-ai/dsh-* plus cordis while
 * bundling schemastery (the Loader validates Config against the schema).
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Resolve tsc's JS entry so the build works on Windows (the .bin shim is a shell script).
const tscBin = require.resolve('typescript/bin/tsc')

const PKG = '@mixian/dsh-desktop-plugin'
const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*', '@deepseek-ai/schemastery']

mkdirSync('lib', { recursive: true })

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external: dshExternal,
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  external: [...dshExternal, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PKG)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

execFileSync(process.execPath, [tscBin, '-p', 'tsconfig.json'], { stdio: 'inherit' })
