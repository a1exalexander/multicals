import { describe, expect, it } from 'vitest'
import type { CalEvent } from '@mysticals/core/shared/types'
import { nowNext, periodKey, showsToday, titleParts } from './shell'

const d = (s: string): Date => new Date(`${s}T12:00:00`)
const ev = (title: string, start: string, end: string): CalEvent => ({
  id: title, accountId: 'a', calendarId: 'c', title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), allDay: false, attendees: []
})

describe('titleParts', () => {
  it('matches the desktop toolbar per view', () => {
    expect(titleParts('day', d('2026-09-26'))).toEqual({ title: '26 September', sub: '2026 · Sat · W39' })
    expect(titleParts('3day', d('2026-09-27'))).toEqual({ title: '27 – 29 Sep 2026', sub: 'W39–W40' })
    expect(titleParts('week', d('2026-09-26'))).toEqual({ title: 'September', sub: '2026 · W39' })
    expect(titleParts('month', d('2026-09-26'))).toEqual({ title: 'September', sub: '2026' })
  })
})

describe('periodKey', () => {
  it('is stable inside a week and changes across weeks', () => {
    expect(periodKey('week', d('2026-09-21'))).toBe(periodKey('week', d('2026-09-27')))
    expect(periodKey('week', d('2026-09-28'))).not.toBe(periodKey('week', d('2026-09-27')))
  })
})

describe('showsToday', () => {
  const now = d('2026-09-26')
  it('checks the shown days for time views', () => {
    expect(showsToday('day', now, now)).toBe(true)
    expect(showsToday('day', d('2026-09-27'), now)).toBe(false)
    expect(showsToday('3day', d('2026-09-24'), now)).toBe(true)
    expect(showsToday('week', d('2026-09-21'), now)).toBe(true)
  })
  it('uses the month itself, not the grid padding', () => {
    expect(showsToday('month', d('2026-10-15'), now)).toBe(false) // Oct grid starts on 28 Sep, still "not today"
    expect(showsToday('month', d('2026-09-01'), now)).toBe(true)
  })
})

describe('nowNext', () => {
  const now = new Date('2026-09-26T10:00:00')
  it('drops a next event more than 24h away', () => {
    const r = nowNext([ev('now', '2026-09-26T09:30:00', '2026-09-26T10:30:00'), ev('far', '2026-09-27T11:00:00', '2026-09-27T12:00:00')], now)
    expect(r.current.map((e) => e.title)).toEqual(['now'])
    expect(r.next).toBeUndefined()
  })
  it('keeps one within 24h', () => {
    expect(nowNext([ev('soon', '2026-09-26T14:00:00', '2026-09-26T15:00:00')], now).next?.title).toBe('soon')
  })
})
