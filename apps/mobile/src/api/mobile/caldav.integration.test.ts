// Mobile data layer (store on the expo-file-system adapter + Keychain crypto) against a real CalDAV server with at least
// one writable calendar and an email username. Skipped unless MYSTICALS_CALDAV_URL/USER/PASS are set, e.g. Radicale with --auth-type none:
//   MYSTICALS_CALDAV_URL=http://127.0.0.1:5232/ MYSTICALS_CALDAV_USER=tester@example.com MYSTICALS_CALDAV_PASS=x pnpm vitest run caldav
import { describe, expect, it } from 'vitest'
import { createApi } from '@mysticals/core/api'
import { AccountStore } from '@mysticals/core/accounts/store'
import { SyncEngine } from '@mysticals/core/sync/engine'
import { createCaldavProvider, verifyCaldav } from '@mysticals/core/providers/caldav'
import { expoStoreFs, type FsApi } from './fs'
import { keychainCrypto } from './crypto'

const { MYSTICALS_CALDAV_URL: url, MYSTICALS_CALDAV_USER: username, MYSTICALS_CALDAV_PASS: password } = process.env

function memoryFs(): FsApi {
  const files = new Map<string, string | Uint8Array>()
  class File {
    constructor(readonly uri: string) {}
    get exists() {
      return files.has(this.uri)
    }
    textSync() {
      return files.get(this.uri) as string
    }
    bytesSync() {
      return files.get(this.uri) as Uint8Array
    }
    write(d: string | Uint8Array) {
      files.set(this.uri, d)
    }
    moveSync(to: File) {
      files.set(to.uri, files.get(this.uri)!)
      files.delete(this.uri)
    }
  }
  class Directory {
    constructor(readonly uri: string) {}
    exists = false
    create() {}
    delete() {}
  }
  return { File, Directory } as unknown as FsApi
}

describe.skipIf(!url || !username || !password)('mobile data layer against a real CalDAV server', () => {
  it('adds the account, syncs, creates/lists/deletes an event, removes the account', async () => {
    const items = new Map<string, string>()
    const store = new AccountStore(
      'file:///docs/mysticals',
      { caldav: createCaldavProvider, google: createCaldavProvider },
      keychainCrypto({ getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) }),
      expoStoreFs(memoryFs())
    )
    const sync = new SyncEngine(store, () => {})
    const api = createApi(store, sync, { verifyCaldav, googleSignIn: () => Promise.reject(new Error('n/a')) })

    await expect(api.accounts.addCaldav({ label: 'x', serverUrl: 'https://nonexistent.invalid/', username: 'u', password: 'p' })).rejects.toThrow()
    const acc = await api.accounts.addCaldav({ label: 'Test', serverUrl: url!, username: username!, password: password! })
    await sync.syncNow(acc.id)
    const cal = (await api.calendars.list()).find((c) => !c.readOnly)
    expect(cal).toBeDefined()

    const start = new Date(Date.now() + 864e5)
    start.setUTCMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 36e5)
    const ev = await api.events.create({
      accountId: acc.id,
      calendarId: cal!.id,
      title: `mobile-it ${crypto.randomUUID()}`,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false
    })
    const range = { start: new Date(start.getTime() - 864e5).toISOString(), end: new Date(end.getTime() + 864e5).toISOString() }
    await sync.syncNow(acc.id, { fresh: true })
    expect((await api.events.list(range)).map((e) => e.title)).toContain(ev.title)

    await api.events.delete(ev)
    await sync.syncNow(acc.id, { fresh: true })
    expect((await api.events.list(range)).map((e) => e.id)).not.toContain(ev.id)
    sync.stop()
    await api.accounts.remove(acc.id)
    expect(await api.accounts.list()).toEqual([])
  }, 60_000)
})
