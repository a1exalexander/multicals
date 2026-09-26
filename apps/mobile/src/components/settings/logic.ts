// Pure helpers for the settings sheet. No React Native imports: unit tested.
import { format, isSameDay } from 'date-fns'

/** Sync status line of an account; `at` is when this device last finished a sync of it (ms), if known. */
export function syncedText(a: { syncing?: boolean; synced?: boolean; error?: string }, at: number | undefined, now = Date.now()): string {
  if (a.syncing) return 'syncing…'
  if (a.error) return 'last sync failed'
  if (at === undefined) return a.synced ? 'synced' : 'not synced yet'
  const min = Math.floor((now - at) / 60_000)
  if (min < 1) return 'synced just now'
  if (min < 60) return `synced ${min} min ago`
  return `synced ${format(at, isSameDay(at, now) ? "'at' HH:mm" : "d MMM 'at' HH:mm")}`
}
