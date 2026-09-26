import type { View } from '@mysticals/core/logic/layout'
import type { Account, Calendar, CalEvent } from '@mysticals/core/shared/types'

/** Props every calendar view gets from the calendar screen. `events` are already filtered to visible calendars. */
export interface ViewProps {
  view: View
  date: Date
  events: CalEvent[]
  accounts: Account[]
  calendars: Calendar[]
  /** False until the first load settles (show skeletons, not "empty"). */
  loaded: boolean
}
