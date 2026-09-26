import { describe, expect, it } from 'vitest'
import type { CalEvent } from '@mysticals/core/shared/types'
import { groupByDay, inviteTime } from './group'

const ev = (id: string, start: string, end: string, allDay = false): CalEvent => ({
  id, accountId: 'a', calendarId: 'c', title: id, start, end, allDay, attendees: []
})
const local = (d: number, h: number, m = 0): string => new Date(2026, 8, d, h, m).toISOString()
const now = new Date(2026, 8, 26, 9)

describe('groupByDay', () => {
  it('buckets by local start day with relative labels', () => {
    const g = groupByDay(
      [ev('x', local(26, 10), local(26, 11)), ev('y', local(26, 14), local(26, 15)), ev('z', '2026-09-27', '2026-09-28', true), ev('w', local(29, 9), local(29, 10))],
      now
    )
    expect(g.map((d) => [d.day, d.label, d.events.map((e) => e.id)])).toEqual([
      ['2026-09-26', 'Today', ['x', 'y']],
      ['2026-09-27', 'Tomorrow', ['z']],
      ['2026-09-29', 'Tue, 29 Sep', ['w']]
    ])
  })
  it('is empty for no invites', () => expect(groupByDay([], now)).toEqual([]))
})

describe('inviteTime', () => {
  it('shows only times for same-day, full range otherwise', () => {
    expect(inviteTime(ev('a', local(26, 14), local(26, 15, 30)))).toBe('14:00 – 15:30')
    expect(inviteTime(ev('a', '2026-09-26', '2026-09-27', true))).toBe('all day')
    expect(inviteTime(ev('a', '2026-09-26', '2026-09-28', true))).toBe('Sat, 26 Sep – Sun, 27 Sep · all day')
    expect(inviteTime(ev('a', local(26, 22), local(27, 1)))).toBe('Sat, 26 Sep 22:00 – Sun, 27 Sep 01:00')
  })
})
