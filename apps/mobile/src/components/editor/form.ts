import { format, parseISO } from 'date-fns'
import { splitEmails } from '@mysticals/core/logic/editor'

/** Form value ('YYYY-MM-DDTHH:mm', local) -> Date for the native picker. */
export const toPickerDate = (local: string): Date => parseISO(local)

/** Picker Date -> form value. A date-only pick keeps the old time so toggling all-day off restores it. */
export const fromPickerDate = (d: Date, prev: string, dateOnly: boolean): string =>
  dateOnly ? `${format(d, 'yyyy-MM-dd')}${prev.slice(10)}` : format(d, "yyyy-MM-dd'T'HH:mm")

/**
 * Invitee field typing: a trailing separator (space, comma, semicolon) commits what was typed as chips.
 * Returns the emails to add and the text left in the field.
 */
export function takeDraft(text: string): { add: string[]; rest: string } {
  if (!/[\s,;]$/.test(text)) return { add: [], rest: text }
  return { add: splitEmails(text), rest: '' }
}

/** Adds emails to the invitee list without duplicates (case-insensitive), keeping order. */
export function addInvitees(list: string[], add: string[]): string[] {
  const seen = new Set(list.map((m) => m.toLowerCase()))
  const out = [...list]
  for (const m of add) {
    if (seen.has(m.toLowerCase())) continue
    seen.add(m.toLowerCase())
    out.push(m)
  }
  return out
}
