import { addDays, subDays } from 'date-fns'
import type { CalEvent, DeleteScope, PartStat, TimeRange } from '@mysticals/core/shared/types'
import { eventBounds } from '@mysticals/core/logic/layout'

export type Reply = Exclude<PartStat, 'needsAction'>
export const REPLIES: [Reply, string][] = [['accepted', 'Accept'], ['tentative', 'Maybe'], ['declined', 'Decline']]
export const SCOPES: [DeleteScope, string][] = [['one', 'This event'], ['following', 'This and following'], ['all', 'All events']]

/** Window around the event (desktop: ±60 days): still finds it after small moves without loading every event. */
export function followRange(e: CalEvent): TimeRange {
  const b = eventBounds(e)
  return { start: subDays(b.start, 60).toISOString(), end: addDays(b.end, 60).toISOString() }
}

/** The live copy of `e` (same account + id), if it still exists. */
export const findLive = (events: CalEvent[], e: CalEvent): CalEvent | undefined =>
  events.find((x) => x.accountId === e.accountId && x.id === e.id)
