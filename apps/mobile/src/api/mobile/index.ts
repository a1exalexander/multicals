import { AppState } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import type { Api } from '@mysticals/core/shared/ipc'
import { createApi } from '@mysticals/core/api'
import { AccountStore } from '@mysticals/core/accounts/store'
import { SyncEngine } from '@mysticals/core/sync/engine'
import { createCaldavProvider, verifyCaldav } from '@mysticals/core/providers/caldav'
// Not the google index: it pulls the Node loopback OAuth flow.
import { createGoogleProviderImpl as createGoogleProvider } from '@mysticals/core/providers/google/provider'
import { notifyChanges } from '../../notifications'
import { expoStoreFs } from './fs'
import { keychainCrypto } from './crypto'
// ./google also sets the Google client config on load (iOS client, no secret), so it is not set here.
import { googleSignIn } from './google'

// AFTER_FIRST_UNLOCK: background refresh must still decrypt while the phone is locked; THIS_DEVICE_ONLY: never in backups.
const keychain = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

/** Real backend: core AccountStore + SyncEngine + CalDAV/Google providers on device storage (Documents/mysticals). */
export function createMobileApi(): Api {
  const subs = new Set<(accountId: string) => void>()
  const broadcast = (accountId: string): void => subs.forEach((f) => f(accountId))
  const base = {
    onChanged(cb: (accountId: string) => void) {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    onMenu: () => () => {}
  }

  let store: AccountStore
  try {
    store = new AccountStore(
      new Directory(Paths.document, 'mysticals').uri,
      { caldav: createCaldavProvider, google: createGoogleProvider },
      keychainCrypto({
        getItem: (k) => SecureStore.getItem(k, keychain),
        setItem: (k, v) => SecureStore.setItem(k, v, keychain)
      }),
      expoStoreFs({ File, Directory })
    )
  } catch (e) {
    // Unreadable accounts.json: every call rejects with the reason instead of crashing at launch; the file is left as is.
    console.error('failed to load accounts', e)
    const fail = async (): Promise<never> => {
      throw e
    }
    return {
      ...base,
      accounts: { list: fail, addGoogle: fail, addCaldav: fail, update: fail, remove: fail },
      calendars: { list: fail, setVisible: fail },
      events: { list: fail, create: fail, update: fail, delete: fail, respond: fail },
      sync: { now: fail }
    }
  }

  const sync = new SyncEngine(store, broadcast, {
    // Coming back to the foreground; the engine's own 2-min timers cover the rest while the app is open.
    triggers: (fire) => {
      const sub = AppState.addEventListener('change', (s) => s === 'active' && fire())
      return () => sub.remove()
    },
    onEvents: (id, notes) => {
      const account = store.get(id)
      if (!account) return
      // Events in hidden calendars stay silent, like desktop.
      const hidden = new Set(store.hiddenCalendars(id))
      const shown = notes.filter((n) => !hidden.has(n.event.calendarId))
      if (shown.length) notifyChanges(account, shown)
    },
    onSyncing: broadcast // the UI re-reads accounts.list for the `syncing` flag
  })
  const api = { ...base, ...createApi(store, sync, { verifyCaldav, googleSignIn, onChanged: broadcast }) }
  sync.start()
  return api
}
