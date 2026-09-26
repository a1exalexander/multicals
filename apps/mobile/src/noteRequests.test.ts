import { describe, expect, it } from 'vitest'
import type { Account, CalEvent } from '@mysticals/core/shared/types'
import type { Note } from '@mysticals/core/sync/notify'
import { lookupRange, noteRequests, readTarget } from './noteRequests'

const account = { id: 'a1', kind: 'caldav', label: 'Work', email: 'me@x.io', color: '#fff' } as Account
const ev = (id: string): CalEvent => ({
  id,
  accountId: 'a1',
  calendarId: 'c1',
  title: `T${id}`,
  start: '2026-09-28T10:00:00.000Z',
  end: '2026-09-28T11:00:00.000Z',
  allDay: false,
  attendees: []
})
const now = new Date('2026-09-26T09:00:00Z')

describe('noteRequests', () => {
  it('one request per note, targeting its event', () => {
    const notes: Note[] = [{ kind: 'invite', event: ev('e1') }, { kind: 'cancelled', event: ev('e2') }]
    const r = noteRequests(account, notes, now)
    expect(r.map((x) => x.identifier)).toEqual(['a1/c1/e1', 'a1/c1/e2'])
    expect(r[0].title).toBe('New invite: Te1')
    expect(r[0].data).toEqual({ accountId: 'a1', eventId: 'e1', calendarId: 'c1', start: ev('e1').start, allDay: false })
  })

  it('a burst collapses into one summary without an event target', () => {
    const notes: Note[] = ['1', '2', '3', '4'].map((id) => ({ kind: 'changed', event: ev(id) }))
    const r = noteRequests(account, notes, now)
    expect(r).toEqual([{ title: '4 calendar updates', body: 'Work', identifier: 'a1/summary', data: { accountId: 'a1' } }])
  })
})

describe('readTarget', () => {
  it('keeps well-formed targets only', () => {
    expect(readTarget(null)).toBeNull()
    expect(readTarget({ eventId: 'e' })).toBeNull()
    expect(readTarget({ accountId: 'a' })).toEqual({ accountId: 'a' })
    expect(readTarget({ accountId: 'a', eventId: 'e', calendarId: 'c', start: 's', allDay: true })).toEqual({ accountId: 'a', eventId: 'e', calendarId: 'c', start: 's', allDay: true })
  })
})

describe('lookupRange', () => {
  it('spans a day before to two days after the start', () => {
    expect(lookupRange('2026-09-28T10:00:00.000Z')).toEqual({ start: '2026-09-27T10:00:00.000Z', end: '2026-09-30T10:00:00.000Z' })
  })
})
