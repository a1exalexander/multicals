import type { Directory, File } from 'expo-file-system'
import type { StoreFs } from '@mysticals/core/accounts/store'

/** expo-file-system's classes, injected so this file runs under vitest (tests pass in-memory fakes). */
export type FsApi = { File: typeof File; Directory: typeof Directory }

/**
 * `StoreFs` on expo-file-system (file:// URIs). There is no atomic replace (move with overwrite = delete + move), so a write
 * goes `x.tmp` (may be torn by a crash) -> rename to `x.new` (complete) -> replace `x`. A leftover `x.new` is always
 * complete and newer than `x`, so reads prefer it; the next write replaces both.
 */
export function expoStoreFs({ File, Directory }: FsApi): StoreFs {
  /** The newest complete copy of `file`, if any. */
  const current = (file: string): File | undefined => [new File(`${file}.new`), new File(file)].find((f) => f.exists)
  return {
    // Collapses doubled slashes but keeps the `file:///` scheme intact.
    join: (...parts) => parts.join('/').replace(/([^:/])\/{2,}/g, '$1/'),
    readText: (file) => current(file)?.textSync(),
    readBytes(file) {
      const f = current(file)
      if (!f) throw new Error(`File not found: ${file}`)
      return f.bytesSync()
    },
    mkdir: async (dir) => {
      new Directory(dir).create({ intermediates: true, idempotent: true })
    },
    writeAtomic: async (file, data) => {
      const tmp = new File(`${file}.tmp`)
      tmp.write(data)
      const next = new File(`${file}.new`)
      tmp.moveSync(next, { overwrite: true })
      next.moveSync(new File(file), { overwrite: true })
    },
    rmdir: async (dir) => {
      const d = new Directory(dir)
      if (d.exists) d.delete()
    }
  }
}
