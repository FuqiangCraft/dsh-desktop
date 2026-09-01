import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('target/release/bundle')
const artifactBudget = 110 * 1024 * 1024

try {
  for (const entry of await readdir(output, { withFileTypes: true })) {
    const target = path.join(output, entry.name)
    if (entry.isFile() && /\.(exe|msi|dmg|zip|AppImage)$/i.test(entry.name)) {
      const bytes = (await stat(target)).size
      if (bytes > artifactBudget) throw new Error(`${entry.name} exceeds 110 MiB (${(bytes / 1024 / 1024).toFixed(1)} MiB)`)
    }
  }
  console.log('Tauri package size budget passed')
} catch (error) {
  if (error?.code === 'ENOENT') console.log('Package size check skipped: no Tauri packaged output')
  else throw error
}
