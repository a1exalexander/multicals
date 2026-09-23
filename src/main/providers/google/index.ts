import type { Credentials } from '@shared/types'
import type { ProviderFactory } from '../types'

// Unit 2 (Google provider + OAuth) implements this.
export const createGoogleProvider: ProviderFactory = () => {
  throw new Error('TODO: Google provider')
}

/** Runs OAuth (system browser, loopback, PKCE). Returns identity + credentials. */
export async function googleSignIn(): Promise<{ email: string; credentials: Extract<Credentials, { kind: 'google' }> }> {
  throw new Error('TODO: googleSignIn')
}
