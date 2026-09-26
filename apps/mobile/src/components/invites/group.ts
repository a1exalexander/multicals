import { addDays, format, isSameDay, parseISO } from 'date-fns'
import type { CalEvent } from '@mysticals/core/shared/types'
import { formatWhen } from '@mysticals/core/logic/details'

export interface InviteDay {
  /** Local 'yyyy-MM-dd' of the invites' start. */
  day: string
  label: string
  events: CalEvent[]
}

const startOf = (e: CalEvent): Date => (e.allDay ? parseISO(e.start) : new Date(e.start))

/** Stable identity of an invite across accounts (ids are only unique per account). */
export const inviteKey = (e: CalEvent): string => `${e.accountId}/${e.id}`

/** Buckets already-sorted invites by local start day; labels read "Today", "Tomorrow" or "Thu, 1 Oct". */
export function groupByDay(invites: CalEvent[], now = new Date()): InviteDay[] {
  const out: InviteDay[] = []
  for (const e of invites) {
    const s = startOf(e)
    const day = format(s, 'yyyy-MM-dd')
    const last = out[out.length - 1]
    if (last?.day === day) {
      last.events.push(e)
      continue
    }
    const label = isSameDay(s, now) ? 'Today' : isSameDay(s, addDays(now, 1)) ? 'Tomorrow' : format(s, 'EEE, d MMM')
    out.push({ day, label, events: [e] })
  }
  return out
}

/** Time line under a day header: the date is already shown, so only times unless the invite spans days. */
export function inviteTime(e: CalEvent): string {
  if (e.allDay) return e.end > format(addDays(parseISO(e.start), 1), 'yyyy-MM-dd') ? formatWhen(e) : 'all day'
  const s = new Date(e.start)
  const t = new Date(e.end)
  return isSameDay(s, t) ? `${format(s, 'HH:mm')} – ${format(t, 'HH:mm')}` : formatWhen(e)
}
