import { describe, expect, it } from 'vitest'
import { addInvitees, fromPickerDate, takeDraft, toPickerDate } from './form'

describe('picker date mapping', () => {
  it('round-trips a local datetime', () => {
    expect(fromPickerDate(toPickerDate('2026-09-26T14:15'), '2026-01-01T00:00', false)).toBe('2026-09-26T14:15')
  })
  it('keeps the previous time on a date-only pick', () => {
    expect(fromPickerDate(toPickerDate('2026-10-03T00:00'), '2026-09-26T14:15', true)).toBe('2026-10-03T14:15')
  })
})

describe('takeDraft', () => {
  it('waits while typing', () => {
    expect(takeDraft('ann@x.io')).toEqual({ add: [], rest: 'ann@x.io' })
  })
  it('commits on a trailing separator', () => {
    expect(takeDraft('ann@x.io ')).toEqual({ add: ['ann@x.io'], rest: '' })
    expect(takeDraft('a@x.io, b@y.io,')).toEqual({ add: ['a@x.io', 'b@y.io'], rest: '' })
  })
  it('ignores a lone separator', () => {
    expect(takeDraft(' ')).toEqual({ add: [], rest: '' })
  })
})

describe('addInvitees', () => {
  it('dedupes case-insensitively and keeps order', () => {
    expect(addInvitees(['Ann@x.io'], ['ann@x.io', 'b@y.io', 'b@y.io'])).toEqual(['Ann@x.io', 'b@y.io'])
  })
})
