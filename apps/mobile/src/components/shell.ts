import { addHours, format, getISOWeek, isSameDay, isSameMonth } from 'date-fns'
import { rangeLabel, viewDays, ymd, type View } from '@mysticals/core/logic/layout'
import { pickNowNext } from '@mysticals/core/logic/status'
import type { CalEvent } from '@mysticals/core/shared/types'

// Pure helpers for the calendar screen shell (header, status line); no React Native here so vitest can run them.

/** Toolbar title + mono subline, same wording as the desktop toolbar. */
export function titleParts(view: View, date: Date): { title: string; sub: string } {
  const days = viewDays(view, date)
  const week = `W${getISOWeek(date)}`
  if (view === 'day') return { title: format(date, 'd MMMM'), sub: `${format(date, 'yyyy · EEE')} · ${week}` }
  if (view === '3day') return { title: rangeLabel(days[0], days[2]), sub: [...new Set(days.map((d) => `W${getISOWeek(d)}`))].join('–') }
  return { title: format(date, 'MMMM'), sub: view === 'week' ? `${format(date, 'yyyy')} · ${week}` : format(date, 'yyyy') }
}

/** Changes when the shown period does; keys the title so a step fades the new one in. */
export const periodKey = (view: View, date: Date): string => `${view}/${ymd(viewDays(view, date)[0])}`

/** Whether `now` is inside the shown period (the Today button hides then). Month means the month itself, not the padding days. */
export const showsToday = (view: View, date: Date, now: Date): boolean =>
  view === 'month' ? isSameMonth(date, now) : viewDays(view, date).some((d) => isSameDay(d, now))

/** Status line: events happening now plus the next one if it starts within 24h (desktop status bar). */
export function nowNext(events: CalEvent[], now: Date): { current: CalEvent[]; next?: CalEvent } {
  const { current, next } = pickNowNext(events, now)
  return { current, next: next && Date.parse(next.start) <= addHours(now, 24).getTime() ? next : undefined }
}
