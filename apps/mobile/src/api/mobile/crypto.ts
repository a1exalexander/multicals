import { gcm } from '@noble/ciphers/aes.js'
import { managedNonce, randomBytes } from '@noble/ciphers/utils.js'
import type { SecretCrypto } from '@mysticals/core/accounts/store'

/** The slice of expo-secure-store (iOS Keychain) the key needs; injected so this file runs under vitest. */
export interface KeyStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const KEY_NAME = 'mysticals.credentials-key'
const aes = managedNonce(gcm)

const toB64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b))
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/**
 * Credentials are AES-256-GCM encrypted (random nonce per write, authenticated) with a random per-install key that
 * lives only in the Keychain (this device only: a backup restored elsewhere can't decrypt, the user re-adds the account).
 * A Keychain error (e.g. locked) propagates: nothing is ever written in plaintext and an existing key is never replaced.
 */
export function keychainCrypto(keys: KeyStore): SecretCrypto {
  let key: Uint8Array | undefined
  const getKey = (): Uint8Array => {
    if (key) return key
    const stored = keys.getItem(KEY_NAME)
    let k: Uint8Array
    if (stored) k = fromB64(stored)
    else {
      k = randomBytes(32)
      keys.setItem(KEY_NAME, toB64(k))
    }
    if (k.length !== 32) throw new Error('Credentials key in the Keychain is invalid')
    return (key = k)
  }
  return {
    encrypt: (plain) => aes(getKey()).encrypt(new TextEncoder().encode(plain)),
    decrypt(data) {
      let plain: Uint8Array
      try {
        plain = aes(getKey()).decrypt(data)
      } catch (e) {
        if (!key) throw e // Keychain unavailable: not the data's fault
        throw new Error('Saved credentials could not be decrypted (restored from another device?). Remove the account and add it again.')
      }
      return new TextDecoder().decode(plain)
    }
  }
}
