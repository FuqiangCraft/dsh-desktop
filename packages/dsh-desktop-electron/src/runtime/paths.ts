import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(__filename)

export function getCurrentDir(): string {
  return __dirname
}

export function getPackageRoot(): string {
  try {
    const electron = require('electron')
    if (electron && typeof electron === 'object' && electron.app && electron.app.isPackaged) {
      return electron.app.getAppPath()
    }
  } catch {
    // running in pure Node.js or test environment
  }
  const current = getCurrentDir()
  if (current.endsWith('runtime') || current.endsWith('windows')) {
    return path.resolve(current, '../..')
  }
  return path.resolve(current, '..')
}
