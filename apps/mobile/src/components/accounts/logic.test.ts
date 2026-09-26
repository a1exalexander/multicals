import { describe, expect, it } from 'vitest'
import { PRESETS, canConnect, errorText, hostOf, suggestLabel } from './logic'

describe('accounts logic', () => {
  it('offers the core presets plus Custom, each with a password hint', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['privateemail', 'icloud', 'fastmail', 'custom'])
    expect(PRESETS.every((p) => p.hint)).toBe(true)
  })

  it('suggests Personal for consumer domains, Work otherwise, nothing without a domain', () => {
    expect(suggestLabel('me@icloud.com')).toBe('Personal')
    expect(suggestLabel('me@GMAIL.com')).toBe('Personal')
    expect(suggestLabel('me@acme.io')).toBe('Work')
    expect(suggestLabel('me')).toBe('')
  })

  it('cleans error messages', () => {
    expect(errorText(new Error("Error invoking remote method 'x': Error: bad"))).toBe('bad')
    expect(errorText(new TypeError('Network request failed'))).toBe("Couldn't reach the server. Check the server address and your connection.")
    expect(
      errorText(
        new Error(
          'Could not find a CalDAV service at https://dav.bogus.invalid/: fetch failed: UnexpectedException: A server with the specified hostname could not be found. (at ExpoModulesCore/Promise.swift:56)'
        )
      )
    ).toBe("Couldn't reach dav.bogus.invalid. Check the server address and your connection.")
    expect(errorText(new Error('CalDAV login failed: wrong username or password'))).toBe('CalDAV login failed: wrong username or password')
    expect(errorText(new Error('x: UnexpectedException: boom (at Foo.swift:1)'))).toBe('x: boom')
    expect(errorText('plain')).toBe('plain')
  })

  it('extracts the host', () => {
    expect(hostOf('https://caldav.icloud.com/')).toBe('caldav.icloud.com')
    expect(hostOf('http://h:8080/dav?x')).toBe('h:8080')
    expect(hostOf('nope')).toBe('nope')
  })

  it('requires url, username and password to connect', () => {
    const ok = { serverUrl: 'https://x.y/', username: 'a@b.c', password: 'p' }
    expect(canConnect(ok)).toBe(true)
    expect(canConnect({ ...ok, serverUrl: 'x.y' })).toBe(false)
    expect(canConnect({ ...ok, username: ' ' })).toBe(false)
    expect(canConnect({ ...ok, password: '' })).toBe(false)
  })
})
