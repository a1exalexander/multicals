import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { AppState } from 'react-native'
import type { Account } from '@mysticals/core/shared/types'
import type { Note } from '@mysticals/core/sync/notify'
import { api } from './api'
import { registerBackgroundSync, SYNC_TASK } from './background'
import { lookupRange, noteRequests, readTarget } from './noteRequests'
import { sheets } from './state/sheets'

let asking: Promise<boolean> | null = null

/** Asks at most once (iOS won't prompt twice), and only while the app is on screen (a background sync can't show the prompt). */
function allowed(): Promise<boolean> {
  if (asking) return asking
  const p = (async () => {
    const now = await Notifications.getPermissionsAsync()
    if (now.granted || !now.canAskAgain || AppState.currentState !== 'active') return now.granted
    const res = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })
    return res.granted
  })()
  // Share only the in-flight check: iOS remembers the answer, and the user may flip it in Settings meanwhile.
  asking = p.finally(() => (asking = null))
  return asking
}

const handled = new Set<string>()

/** Tap on a banner: open the event's details if it still exists; otherwise the app simply comes forward. */
async function open(response: Notifications.NotificationResponse): Promise<void> {
  const id = response.notification.request.identifier + response.notification.date
  if (handled.has(id)) return // the cold-start response can also reach the listener
  handled.add(id)
  Notifications.clearLastNotificationResponse()
  const target = readTarget(response.notification.request.content.data)
  if (!target?.eventId || !target.start) return
  const events = await api.events.list(lookupRange(target.start, target.allDay)).catch(() => [])
  const event = events.find((e) => e.id === target.eventId && e.calendarId === target.calendarId && e.accountId === target.accountId)
  if (!event) return
  // A cold start delivers the response before the root navigator mounts; retry until it can navigate.
  for (let i = 0; i < 50; i++) {
    try {
      return sheets.openEvent(event)
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}

/** Asks for permission and wires notification taps + background refresh. Called once from the root layout. */
export function setupNotifications(): void {
  // iOS hides banners of a foreground app unless told otherwise; show them like any other app would, quietly.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
  })
  Notifications.addNotificationResponseReceivedListener((r) => void open(r))
  const last = Notifications.getLastNotificationResponse()
  if (last) void open(last)
  // Polite: no prompt on a fresh install; ask once an account exists (now, or when the first one starts syncing).
  void api.accounts.list().then((a) => { if (a.length) void allowed() }).catch(() => {})
  const off = api.onChanged(() => {
    off()
    void allowed()
  })
  void registerBackgroundSync().catch((e) => console.warn('background sync unavailable', e))
  if (__DEV__) {
    const e2e = (globalThis as Record<string, unknown>).__e2e as Record<string, unknown> | undefined
    if (e2e) {
      e2e.notify = notifyChanges
      e2e.openNotification = open
      e2e.notifyPermission = allowed
      e2e.backgroundRegistered = () => TaskManager.isTaskRegisteredAsync(SYNC_TASK)
    }
  }
}

/** Local notifications for changes a sync found (new invite, changed, cancelled); SyncEngine onEvents calls this. */
export function notifyChanges(account: Account, notes: Note[]): void {
  void (async () => {
    // Like desktop: events in hidden calendars stay silent.
    const hidden = new Set((await api.calendars.list()).filter((c) => c.accountId === account.id && c.visible === false).map((c) => c.id))
    const shown = notes.filter((n) => !hidden.has(n.event.calendarId))
    if (!shown.length || !(await allowed())) return
    // ponytail: no threadIdentifier (expo-notifications 57 doesn't pass it for local notifications); iOS groups by app.
    for (const { identifier, title, body, data } of noteRequests(account, shown)) {
      await Notifications.scheduleNotificationAsync({ identifier, content: { title, body, data: { ...data } }, trigger: null })
    }
  })().catch((e) => console.warn('notification failed', e))
}
