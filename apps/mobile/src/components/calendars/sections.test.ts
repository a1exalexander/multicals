import { describe, expect, it } from 'vitest'
import { accountSections } from './sections'

describe('accountSections', () => {
  const acc = (id: string, extra = {}) => ({ id, kind: 'caldav' as const, label: id, email: `${id}@x`, color: '#fff', ...extra })
  const cal = (accountId: string, id: string) => ({ id, accountId, name: id, color: '#fff', readOnly: false })
  it('splits calendars per account and flags first-sync loading', () => {
    const s = accountSections([acc('a', { synced: true }), acc('b', { syncing: true }), acc('c', { syncing: true })], [cal('a', '1'), cal('c', '2')])
    expect(s.map((x) => [x.account.id, x.calendars.map((c) => c.id), x.loading])).toEqual([
      ['a', ['1'], false],
      ['b', [], true],
      ['c', ['2'], false]
    ])
  })
})
