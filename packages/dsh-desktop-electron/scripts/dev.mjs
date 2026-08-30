import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgDir = path.resolve(__dirname, '..')

// 1. Run build
const buildProc = spawn(process.execPath, [path.join(pkgDir, 'build.mjs')], {
  cwd: pkgDir,
  stdio: 'inherit',
})

buildProc.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code || 1)
  }

  // 2. Launch electron
  const child = spawn(electronPath, ['.'], {
    cwd: pkgDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  })

  child.on('exit', (childCode) => {
    process.exit(childCode || 0)
  })
})
