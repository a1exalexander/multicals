import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { api, MOCK } from './api'

export const SYNC_TASK = 'mysticals-sync'
/** iOS runs BGProcessing work in short windows; stop waiting well before it kills us. */
const BUDGET_MS = 25_000

// Must be defined at module scope: iOS may launch the JS bundle headless just to run this.
// A sync that finds invites/changes notifies through the SyncEngine's onEvents -> notifyChanges.
TaskManager.defineTask(SYNC_TASK, async () => {
  if (MOCK) return BackgroundTask.BackgroundTaskResult.Success
  try {
    await Promise.race([api.sync.now(), new Promise((_, reject) => setTimeout(() => reject(new Error('sync timed out')), BUDGET_MS))])
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

/** Asks iOS for periodic background syncs; ~15 min is a floor, iOS picks the real cadence. */
export async function registerBackgroundSync(): Promise<void> {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return
  if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return
  await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 })
}
