import { describe, expect, it } from 'vitest'
import type { CalEvent } from '@shared/types'
import { dragRange, eventsOnDay, layoutDay, monthGrid, packColumns, slotAt, viewRange } from './layout'

const ev = (id: string, start: string, end: string, allDay = false): CalEvent => ({
  id, accountId: 'a', calendarId: 'c', title: id, start, end, allDay, attendees: []
})
const at = (h: number, m = 0): string => new Date(2026, 8, 23, h, m).toISOString()
const day = new Date(2026, 8, 23)

describe('packColumns', () => {
  it('places overlapping items side by side and keeps separate clusters full width', () => {
    const r = packColumns([
      { item: 'a', start: 60, end: 180 },
      { item: 'b', start: 120, end: 240 },
      { item: 'c', start: 200, end: 260 }, // overlaps b only -> reuses a's column
      { item: 'd', start: 300, end: 360 } // own cluster
    ])
    const by = Object.fromEntries(r.map((p) => [p.item, [p.col, p.cols]]))
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] })
  })

  it('treats short items as minDur tall', () => {
    const r = packColumns([
      { item: 'a', start: 0, end: 5 },
      { item: 'b', start: 10, end: 20 }
    ], 20)
    expect(r.map((p) => p.cols)).toEqual([2, 2])
  })
})

describe('layoutDay', () => {
  it('clips events crossing midnight and ignores all-day', () => {
    const r = layoutDay([
      ev('late', new Date(2026, 8, 22, 22).toISOString(), at(2)),
      ev('ad', '2026-09-23', '2026-09-24', true)
    ], day)
    expect(r).toHaveLength(1)
    expect([r[0].start, r[0].end]).toEqual([0, 120])
  })
})

describe('eventsOnDay', () => {
  it('puts all-day first and handles all-day with end == start', () => {
    const r = eventsOnDay([
      ev('t', at(9), at(10)),
      ev('h', '2026-09-23', '2026-09-23', true),
      ev('next', '2026-09-24', '2026-09-25', true)
    ], day)
    expect(r.map((e) => e.id)).toEqual(['h', 't'])
  })
})

describe('monthGrid', () => {
  it('is 42 days starting on the Monday on/before the 1st', () => {
    const g = monthGrid(new Date(2026, 8, 15))
    expect(g).toHaveLength(42)
    expect(g[0]).toEqual(new Date(2026, 7, 31)) // Mon Aug 31
    expect(viewRange('month', day).start).toBe(g[0].toISOString())
  })
})

describe('slots', () => {
  it('snaps to 15 minutes and drags both directions', () => {
    expect(slotAt(37)).toBe(30)
    expect(slotAt(-5)).toBe(0)
    expect(slotAt(2000)).toBe(1425)
    expect(dragRange(90, 30)).toEqual({ start: 30, end: 105 })
  })
})
