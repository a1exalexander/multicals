import { describe, expect, it } from 'vitest'
import { keychainCrypto, type KeyStore } from './crypto'

const memory = (): KeyStore & { items: Map<string, string> } => {
  const items = new Map<string, string>()
  return { items, getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) }
}

describe('keychainCrypto', () => {
  it('round-trips with a random nonce and a key created once in the Keychain', () => {
    const keys = memory()
    const c = keychainCrypto(keys)
    const a = c.encrypt('{"password":"hunter2"}')
    const b = c.encrypt('{"password":"hunter2"}')
    expect(a).not.toEqual(b)
    expect(keys.items.size).toBe(1)
    expect(keychainCrypto(keys).decrypt(a)).toBe('{"password":"hunter2"}') // relaunch reuses the stored key
  })

  it('rejects tampered data and data from another install', () => {
    const keys = memory()
    const data = keychainCrypto(keys).encrypt('secret')
    const tampered = data.slice()
    tampered[tampered.length - 1] ^= 1
    expect(() => keychainCrypto(keys).decrypt(tampered)).toThrow(/could not be decrypted/)
    expect(() => keychainCrypto(memory()).decrypt(data)).toThrow(/could not be decrypted/)
  })

  it('refuses to encrypt when the Keychain is unavailable (never plaintext, never a replacement key)', () => {
    const keys = memory()
    keys.items.set('mysticals.credentials-key', btoa('x'.repeat(32)))
    const locked: KeyStore = {
      getItem: () => {
        throw new Error('User interaction is not allowed')
      },
      setItem: () => {
        throw new Error('should not write')
      }
    }
    expect(() => keychainCrypto(locked).encrypt('secret')).toThrow(/not allowed/)
    expect(() => keychainCrypto(locked).decrypt(new Uint8Array(40))).toThrow(/not allowed/)
  })
})
