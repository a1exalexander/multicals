import type { Api } from '@mysticals/core/shared/ipc'

/** Real backend: core AccountStore + SyncEngine + CalDAV/Google providers on device storage. */
export function createMobileApi(): Api {
  const todo = (): never => {
    throw new Error('Mobile data layer not implemented yet; run with EXPO_PUBLIC_MYSTICALS_MOCK=1')
  }
  return {
    accounts: { list: async () => [], addGoogle: todo, addCaldav: todo, update: todo, remove: todo },
    calendars: { list: async () => [], setVisible: todo },
    events: { list: async () => [], create: todo, update: todo, delete: todo, respond: todo },
    sync: { now: async () => {} },
    onChanged: () => () => {},
    onMenu: () => () => {}
  }
}
