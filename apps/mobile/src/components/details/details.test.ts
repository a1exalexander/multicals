import { describe, expect, it } from 'vitest'
import type { CalEvent } from '@mysticals/core/shared/types'
import { findLive, followRange } from './details'

const ev = (p: Partial<CalEvent> = {}): CalEvent => ({
  id: 'e1', accountId: 'a', calendarId: 'c', title: 'T', start: '2026-09-26T10:00:00.000Z', end: '2026-09-26T11:00:00.000Z',
  allDay: false, attendees: [], ...p
})

describe('followRange', () => {
  it('spans 60 days either side of the event', () => {
    const r = followRange(ev())
    const days = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) // DST-safe
    expect(days(r.start, '2026-09-26T10:00:00.000Z')).toBe(60)
    expect(days('2026-09-26T11:00:00.000Z', r.end)).toBe(60)
  })
})

describe('findLive', () => {
  it('matches by account and id, not by id alone', () => {
    const other = ev({ accountId: 'b', title: 'other' })
    const fresh = ev({ title: 'renamed' })
    expect(findLive([other, fresh], ev())).toBe(fresh)
    expect(findLive([other], ev())).toBeUndefined()
  })
})
