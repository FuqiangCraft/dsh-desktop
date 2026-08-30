import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const electronPkgPath = path.join(rootDir, 'packages/dsh-desktop-electron/package.json')
const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'))

console.log('[verify-runtime-closure] Checking package dependencies...')

const deps = electronPkg.dependencies || {}
const pinnedVersion = '0.1.1-rc.2'

let hasError = false

for (const [pkgName, version] of Object.entries(deps)) {
  if (pkgName.startsWith('@deepseek-ai/dsh')) {
    if (version !== pinnedVersion) {
      console.error(`[FAIL] ${pkgName} has version "${version}", expected pinned "${pinnedVersion}"`)
      hasError = true
    } else {
      console.log(`[OK] ${pkgName} @ ${version}`)
    }
  }
}

// Verify that key runtime dependencies exist
const requiredPackages = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-app-boot',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-launch-environment',
  '@deepseek-ai/dsh-cmdline',
  '@mixian/dsh-desktop-plugin',
]

for (const req of requiredPackages) {
  if (!deps[req]) {
    console.error(`[FAIL] Missing required runtime dependency: ${req}`)
    hasError = true
  }
}

if (hasError) {
  console.error('[verify-runtime-closure] Verification failed.')
  process.exit(1)
} else {
  console.log('[verify-runtime-closure] Runtime closure verification passed successfully.')
}
