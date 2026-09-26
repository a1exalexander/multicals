import { describe, expect, it } from 'vitest'
import { AccountStore } from '@mysticals/core/accounts/store'
import { expoStoreFs, type FsApi } from './fs'
import { keychainCrypto } from './crypto'

/** In-memory stand-in for expo-file-system: path -> contents; directories are implicit. */
function fakeFs() {
  const files = new Map<string, string | Uint8Array>()
  class File {
    constructor(readonly uri: string) {}
    get exists() {
      return files.has(this.uri)
    }
    textSync() {
      const v = files.get(this.uri)
      if (typeof v !== 'string') throw new Error('not text')
      return v
    }
    bytesSync() {
      const v = files.get(this.uri)
      if (!(v instanceof Uint8Array)) throw new Error('not bytes')
      return v
    }
    write(data: string | Uint8Array) {
      files.set(this.uri, data)
    }
    moveSync(to: File, { overwrite }: { overwrite: boolean }) {
      if (!overwrite && to.exists) throw new Error('exists')
      files.set(to.uri, files.get(this.uri)!)
      files.delete(this.uri)
    }
  }
  class Directory {
    constructor(readonly uri: string) {}
    get exists() {
      return [...files.keys()].some((k) => k.startsWith(`${this.uri}/`))
    }
    create() {}
    delete() {
      for (const k of files.keys()) if (k.startsWith(`${this.uri}/`)) files.delete(k)
    }
  }
  return { files, api: { File, Directory } as unknown as FsApi }
}

describe('expoStoreFs', () => {
  it('joins file URIs without breaking the scheme', () => {
    const fs = expoStoreFs(fakeFs().api)
    expect(fs.join('file:///docs/mysticals/', 'accounts', 'a')).toBe('file:///docs/mysticals/accounts/a')
  })

  it('writes atomically, leaving no temp files, and reads back', async () => {
    const { files, api } = fakeFs()
    const fs = expoStoreFs(api)
    await fs.writeAtomic('file:///d/x.json', 'one')
    await fs.writeAtomic('file:///d/x.json', 'two')
    expect([...files.keys()]).toEqual(['file:///d/x.json'])
    expect(fs.readText('file:///d/x.json')).toBe('two')
    expect(fs.readText('file:///d/missing.json')).toBeUndefined()
    expect(() => fs.readBytes('file:///d/missing.bin')).toThrow(/not found/)
  })

  it('recovers the new copy after a crash between rename and replace, ignores a torn temp file', () => {
    const { files, api } = fakeFs()
    const fs = expoStoreFs(api)
    files.set('file:///d/x.json', 'old')
    files.set('file:///d/x.json.new', 'new')
    expect(fs.readText('file:///d/x.json')).toBe('new')
    files.delete('file:///d/x.json') // crashed after deleting the old copy
    expect(fs.readText('file:///d/x.json')).toBe('new')
    files.clear()
    files.set('file:///d/x.json.tmp', '{"torn')
    expect(fs.readText('file:///d/x.json')).toBeUndefined()
  })

  it('backs AccountStore: accounts persist, creds are encrypted at rest, remove wipes the account dir', async () => {
    const { files, api } = fakeFs()
    const keychain = new Map<string, string>()
    const keys = { getItem: (k: string) => keychain.get(k) ?? null, setItem: (k: string, v: string) => void keychain.set(k, v) }
    const factories = { caldav: () => ({}) as never, google: () => ({}) as never }
    const open = () => new AccountStore('file:///docs/mysticals', factories, keychainCrypto(keys), expoStoreFs(api))

    const creds = { kind: 'caldav' as const, serverUrl: 'https://dav.example.com/', username: 'me', password: 'hunter2' }
    const a = await open().add({ kind: 'caldav', label: 'Work', email: 'me@example.com', color: '#50fa7b' }, creds)
    const credFile = `file:///docs/mysticals/accounts/${a.id}/creds.bin`
    expect(new TextDecoder().decode(files.get(credFile) as Uint8Array)).not.toContain('hunter2')

    const reopened = open() // relaunch: same disk + Keychain
    expect(reopened.list()).toEqual([a])
    let seen: unknown
    reopened.factories.caldav = (ctx) => ((seen = ctx.credentials), {}) as never
    reopened.getProvider(a.id)
    expect(seen).toEqual(creds)

    await reopened.remove(a.id)
    expect(files.has(credFile)).toBe(false)
    expect(open().list()).toEqual([])
  })
})
