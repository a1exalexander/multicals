import type { Account } from '@mysticals/core/shared/types'
import type { Note } from '@mysticals/core/sync/notify'

/** Asks for permission and wires notification taps + background refresh. Called once from the root layout. Stub. */
export function setupNotifications(): void {}

/** Local notifications for changes a sync found (new invite, changed, cancelled); SyncEngine onEvents calls this. Stub. */
export function notifyChanges(_account: Account, _notes: Note[]): void {}
