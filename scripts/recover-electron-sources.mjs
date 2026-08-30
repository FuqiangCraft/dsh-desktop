import { access, cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extractAll } from '../node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar/lib/asar.js'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const outputRoot = path.join(root, 'packages', 'dsh-desktop-electron')

const mapPaths = ['main.cjs.map', 'main.js.map', 'preload.cjs.map', 'tray-preload.cjs.map']

let recovered = 0
for (const mapName of mapPaths) {
  const mapPath = path.join(outputRoot, 'dist', mapName)
  const map = JSON.parse(await readFile(mapPath, 'utf8'))
  for (let i = 0; i < map.sources.length; i += 1) {
    const source = map.sources[i]
    const content = map.sourcesContent?.[i]
    if (!content || !source.startsWith('../src/')) continue
    const relative = source.slice('../'.length)
    const target = path.join(outputRoot, relative)
    try { await access(target); continue } catch { /* restore missing source */ }
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')
    recovered += 1
  }
}

if (recovered === 0) throw new Error('No Electron source files found in sourcemap')
console.log(`Recovered ${recovered} Electron source files from ${mapPaths.length} sourcemaps`)

const asarPath = path.join(root, 'dist-electron', 'win-unpacked', 'resources', 'app.asar')
const assets = [
  '\\assets\\icons\\icon.ico',
  '\\assets\\icons\\icon.png',
  '\\assets\\pet\\dsh-companion-cat.png',
  '\\assets\\pet\\dsh-companion-whale.png',
  '\\assets\\pet\\dsh-companion.png',
  '\\assets\\pet\\pet.html',
  '\\assets\\recovery\\recovery.html',
  '\\assets\\tray\\menu.html',
]
const extractedRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-electron-recover-'))
await extractAll(asarPath, extractedRoot)
for (const asset of assets) {
  const relative = asset.replaceAll('\\\\', path.sep).replace(/^[/\\]/, '')
  const target = path.join(outputRoot, relative)
  await mkdir(path.dirname(target), { recursive: true })
  await cp(path.join(extractedRoot, relative), target, { recursive: true })
}
await rm(extractedRoot, { recursive: true, force: true })
console.log(`Recovered ${assets.length} Electron runtime assets`)
