import { addDays, isSameDay, startOfDay } from 'date-fns'
import { eventBounds, layoutDay, type Placed } from '@mysticals/core/logic/layout'
import type { CalEvent } from '@mysticals/core/shared/types'
import { pxOf, type Rect } from './math'

export const keyOf = (e: Pick<CalEvent, 'accountId' | 'id'>): string => `${e.accountId}/${e.id}`

/** Wall-clock minute of `day` (DST-safe, unlike adding elapsed minutes). */
export function atMinute(day: Date, m: number): Date {
  const d = new Date(day)
  d.setHours(0, m, 0, 0)
  return d
}

const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes()

/** Minutes of `day` an event covers when it starts that day and ends that day (or at the next midnight); else null. */
export function sameDaySpan(e: CalEvent, day: Date): { start: number; end: number } | null {
  // Point-in-time events stay put: eventBounds widens them to a minute, which a move would save.
  if (e.allDay || Date.parse(e.end) <= Date.parse(e.start)) return null
  const b = eventBounds(e)
  if (!isSameDay(b.start, day)) return null
  if (isSameDay(b.end, day)) return { start: minutesOf(b.start), end: minutesOf(b.end) }
  return +b.end === +addDays(startOfDay(day), 1) ? { start: minutesOf(b.start), end: 1440 } : null
}

export interface Block extends Placed<CalEvent> {
  day: number
  rect: Rect
}

/**
 * Timed blocks of a page with their px rects (desktop geometry: 1px in from the column's left, 3px gap on
 * the right, 1px under). `canDrag` decides which blocks the long-press move/resize may pick up.
 */
export function pageBlocks(
  events: CalEvent[],
  days: Date[],
  colW: number,
  hourHeight: number,
  minDur: number,
  canDrag: (e: CalEvent) => boolean
): Block[] {
  const out: Block[] = []
  days.forEach((d, day) => {
    for (const p of layoutDay(events, d, minDur)) {
      const w = colW / p.cols
      const rect: Rect = {
        i: out.length,
        day,
        x: day * colW + p.col * w + 1,
        y: pxOf(p.start, hourHeight),
        w: w - 3,
        h: pxOf(Math.max(p.end - p.start, minDur), hourHeight) - 1,
        start: p.start,
        end: p.end,
        drag: canDrag(p.item) && !!sameDaySpan(p.item, d)
      }
      out.push({ ...p, day, rect })
    }
  })
  return out
}
