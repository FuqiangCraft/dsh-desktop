import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function getCurrentDir(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

export function getPackageRoot(): string {
  return path.resolve(getCurrentDir(), '..')
}
