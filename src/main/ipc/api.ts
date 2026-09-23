import type { Api } from '@shared/ipc'
import type { AccountStore } from '../accounts/store'
import type { SyncEngine } from '../sync/engine'

// Unit 5 implements this: real Api over AccountStore + SyncEngine, zod-validated,
// enforcing that calendarId belongs to accountId on every write.
export function createApi(_store: AccountStore, _sync: SyncEngine): Omit<Api, 'onChanged' | 'onMenu'> {
  throw new Error('TODO: createApi')
}
