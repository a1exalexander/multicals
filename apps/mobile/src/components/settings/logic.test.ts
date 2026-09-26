import { describe, expect, it } from 'vitest'
import { syncedText } from './logic'

describe('syncedText', () => {
  const now = new Date(2026, 8, 26, 15, 0).getTime()
  it('prefers live state over the timestamp', () => {
    expect(syncedText({ syncing: true }, now, now)).toBe('syncing…')
    expect(syncedText({ error: 'x' }, now, now)).toBe('last sync failed')
  })
  it('falls back to the synced flag without a timestamp', () => {
    expect(syncedText({ synced: true }, undefined, now)).toBe('synced')
    expect(syncedText({}, undefined, now)).toBe('not synced yet')
  })
  it('formats relative, then clock time', () => {
    expect(syncedText({}, now - 30_000, now)).toBe('synced just now')
    expect(syncedText({}, now - 5 * 60_000, now)).toBe('synced 5 min ago')
    expect(syncedText({}, now - 2 * 3600_000, now)).toBe('synced at 13:00')
    expect(syncedText({}, now - 24 * 3600_000, now)).toBe('synced 25 Sep at 15:00')
  })
})
