import { describe, expect, it } from 'vitest'
import { iosClientConfig, iosRedirectUri } from './googleClient'

describe('iOS Google client', () => {
  it('derives the reversed-client-id redirect', () => {
    expect(iosRedirectUri('123-abc.apps.googleusercontent.com')).toBe('com.googleusercontent.apps.123-abc:/oauth2redirect')
  })

  it('builds a secret-less config, or none without a client id', () => {
    expect(iosClientConfig('cid.apps.googleusercontent.com')).toEqual({ clientId: 'cid.apps.googleusercontent.com', noSecret: true })
    expect(iosClientConfig(undefined)).toEqual({})
    expect(iosClientConfig('')).toEqual({})
  })
})
