import type { CaldavAccountInput } from '@shared/types'
import type { ProviderFactory } from '../types'

// Unit 1 (CalDAV provider) implements this.
export const createCaldavProvider: ProviderFactory = () => {
  throw new Error('TODO: CalDAV provider')
}

/** Validates credentials against the server and returns the account identity (email). */
export async function verifyCaldav(_input: CaldavAccountInput): Promise<{ email: string }> {
  throw new Error('TODO: verifyCaldav')
}
