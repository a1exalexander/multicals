// Pure month-grid geometry. Functions marked 'worklet' also run on the UI thread inside gesture callbacks.
import { addDays, format, parseISO } from 'date-fns'
import type { CalEvent } from '@mysticals/core/shared/types'

/** Cell geometry (pt): padding, day-number row, chip height and the gap between chips. */
export const CELL = { pad: 2, num: 20, chip: 15, gap: 1 } as const
const STRIDE = CELL.chip + CELL.gap

/** Month as a whole number (year * 12 + month) so pages can be keyed and positioned by it. */
export const monthIndex = (d: Date): number => d.getFullYear() * 12 + d.getMonth()
export const fromMonthIndex = (i: number): Date => new Date(Math.floor(i / 12), ((i % 12) + 12) % 12, 1)

/** Cell (0..41) under a point of the 7x6 grid body, or -1 outside it. */
export function cellAt(x: number, y: number, w: number, h: number): number {
  'worklet'
  if (x < 0 || y < 0 || x >= w || y >= h) return -1
  return Math.floor(y / (h / 6)) * 7 + Math.floor(x / (w / 7))
}

/** How many chip rows fit under the day number. */
export const chipRows = (cellH: number): number => Math.max(0, Math.floor((cellH - CELL.pad * 2 - CELL.num + CELL.gap) / STRIDE))

/** Chips shown and the "+N" count: when the day overflows, the last row becomes "+N" (desktop MAX_PER_DAY rule). */
export function fitChips(count: number, rows: number): { shown: number; more: number } {
  if (count <= rows) return { shown: count, more: 0 }
  const shown = Math.max(0, rows - 1)
  return { shown, more: count - shown }
}

export type CellHit = { kind: 'chip'; index: number } | { kind: 'more' } | { kind: 'cell' }

/** What a point `y` (relative to the cell top) lands on, given the cell's `shown` chips and `more` overflow. */
export function hitInCell(y: number, shown: number, more: number): CellHit {
  const row = Math.floor((y - CELL.pad - CELL.num) / STRIDE)
  if (row >= 0 && row < shown) return { kind: 'chip', index: row }
  if (row === shown && more > 0) return { kind: 'more' }
  return { kind: 'cell' }
}

/** Page to settle on after a horizontal swipe: +1 next month (swiped left), -1 previous, 0 stay. */
export function snapPage(dx: number, vx: number, w: number): -1 | 0 | 1 {
  'worklet'
  // A flick counts even when short; a slow drag has to cross a third of the page.
  const past = Math.abs(dx) > w / 3 || (Math.abs(vx) > 500 && Math.sign(vx) === Math.sign(dx))
  if (!past || dx === 0) return 0
  return dx < 0 ? 1 : -1
}

/** The event moved by whole days, keeping its wall-clock times (all-day events stay date-only). Desktop drag.ts. */
export function shiftDays(e: Pick<CalEvent, 'start' | 'end' | 'allDay'>, days: number): { start: string; end: string } {
  if (e.allDay) {
    const d = (iso: string): string => format(addDays(parseISO(iso), days), 'yyyy-MM-dd')
    return { start: d(e.start), end: d(e.end) }
  }
  return { start: addDays(new Date(e.start), days).toISOString(), end: addDays(new Date(e.end), days).toISOString() }
}
