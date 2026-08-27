import path from 'node:path'

declare const __dirname: string

export function getCurrentDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname
  }
  return process.cwd()
}

export function getPackageRoot(): string {
  return path.resolve(getCurrentDir(), '..')
}
