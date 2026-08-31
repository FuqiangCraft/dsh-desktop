import { rmSync } from 'node:fs'
import path from 'node:path'

const outputDir = path.resolve(import.meta.dirname, '../../../dist-electron')
rmSync(outputDir, { recursive: true, force: true })
