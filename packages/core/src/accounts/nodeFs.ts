import { existsSync, readFileSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type { StoreFs } from './store'

/** `StoreFs` on Node's fs (desktop main process, terminal daemon). */
export const nodeStoreFs: StoreFs = {
  join,
  readText: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined),
  readBytes: (file) => readFileSync(file),
  mkdir: async (dir) => {
    await mkdir(dir, { recursive: true })
  },
  async writeAtomic(file, data) {
    const tmp = `${file}.${crypto.randomUUID()}.tmp`
    await writeFile(tmp, data, { mode: 0o600 })
    await rename(tmp, file)
  },
  rmdir: (dir) => rm(dir, { recursive: true, force: true })
}
