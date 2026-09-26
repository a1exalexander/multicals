import { describe, expect, it } from 'vitest'
import type { CalEvent } from '@mysticals/core/shared/types'
import { atMinute, pageBlocks, sameDaySpan } from './logic'

const day = new Date(2026, 8, 26)
const at = (h: number, m = 0, d = 0): string => new Date(2026, 8, 26 + d, h, m).toISOString()
const ev = (id: string, start: string, end: string, extra: Partial<CalEvent> = {}): CalEvent => ({
  id, accountId: 'a', calendarId: 'c', title: id, start, end, allDay: false, attendees: [], ...extra
})

describe('timegrid logic', () => {
  it('builds wall-clock times', () => {
    expect(atMinute(day, 615).getHours()).toBe(10)
    expect(atMinute(day, 615).getMinutes()).toBe(15)
  })

  it('only drags events that start and end on the day', () => {
    expect(sameDaySpan(ev('x', at(10), at(11)), day)).toEqual({ start: 600, end: 660 })
    expect(sameDaySpan(ev('x', at(23), at(0, 0, 1)), day)).toEqual({ start: 1380, end: 1440 })
    expect(sameDaySpan(ev('x', at(23), at(1, 0, 1)), day)).toBeNull()
    expect(sameDaySpan(ev('x', at(10, 0, -1), at(11)), day)).toBeNull()
    expect(sameDaySpan(ev('x', at(10), at(10)), day)).toBeNull()
  })

  it('packs overlapping events side by side (mock data: standup vs 1:1 at 10:00, run at 07:00)', () => {
    const events = [
      ev('run', at(7), at(7, 45)),
      ev('standup', at(10), at(10, 15)),
      ev('one', at(10), at(11)),
      ev('ro', at(12), at(13), { calendarId: 'holidays' })
    ]
    const blocks = pageBlocks(events, [day], 300, 56, 22, (e) => e.calendarId !== 'holidays')
    const by = Object.fromEntries(blocks.map((b) => [b.item.id, b]))
    expect(by.run.rect).toMatchObject({ x: 1, y: 7 * 56, w: 297, drag: true })
    // standup is shorter but still gets min 22 minutes of height
    expect(by.standup.rect.h).toBeCloseTo((22 / 60) * 56 - 1)
    expect([by.one.col, by.standup.col].sort()).toEqual([0, 1])
    expect(by.one.rect.w).toBe(147)
    expect(by.ro.rect.drag).toBe(false)
    blocks.forEach((b, i) => expect(b.rect.i).toBe(i))
  })

  it('offsets later days by the column width', () => {
    const next = new Date(2026, 8, 27)
    const blocks = pageBlocks([ev('x', at(9, 0, 1), at(10, 0, 1))], [day, next], 100, 56, 22, () => true)
    expect(blocks[0]).toMatchObject({ day: 1, rect: { x: 101, day: 1 } })
  })
})
