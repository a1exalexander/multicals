import { addDays, parseISO } from 'date-fns'
import { noteText, type Note } from '@mysticals/core/sync/notify'
import type { Account, TimeRange } from '@mysticals/core/shared/types'

/** What a tapped banner needs to find its event again. Absent on the "N calendar updates" summary. */
export interface NoteTarget {
  accountId: string
  eventId?: string
  calendarId?: string
  start?: string
  allDay?: boolean
}

export interface NoteRequest {
  /** Stable per event, so a newer change to the same event replaces its banner instead of stacking. */
  identifier: string
  title: string
  body: string
  data: NoteTarget
}

/** Local notification requests for one sync's notes: one per note, or one summary for a burst (desktop behaviour via noteText). */
export function noteRequests(account: Account, notes: Note[], now = new Date()): NoteRequest[] {
  const texts = noteText(notes, account.label, now)
  if (texts.length !== notes.length) {
    return texts.map((t) => ({ ...t, identifier: `${account.id}/summary`, data: { accountId: account.id } }))
  }
  return texts.map((t, i) => {
    const e = notes[i].event
    return {
      ...t,
      identifier: `${account.id}/${e.calendarId}/${e.id}`,
      data: { accountId: account.id, eventId: e.id, calendarId: e.calendarId, start: e.start, allDay: e.allDay }
    }
  })
}

/** Range to look the tapped event up in: a day either side of its start covers time zones and all-day values. */
export function lookupRange(start: string, allDay = false): TimeRange {
  const s = allDay ? parseISO(start) : new Date(start)
  return { start: addDays(s, -1).toISOString(), end: addDays(s, 2).toISOString() }
}

/** Notification payloads arrive as untyped JSON; keep only a well-formed target. */
export function readTarget(data: unknown): NoteTarget | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.accountId !== 'string') return null
  if (typeof d.eventId !== 'string' || typeof d.calendarId !== 'string' || typeof d.start !== 'string') return { accountId: d.accountId }
  return { accountId: d.accountId, eventId: d.eventId, calendarId: d.calendarId, start: d.start, allDay: d.allDay === true }
}
