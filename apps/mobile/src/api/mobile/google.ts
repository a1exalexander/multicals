import type { ApiDeps } from '@mysticals/core/api'

/** Google OAuth on iOS (system auth session + PKCE). Stub; replaced by the Google sign-in work unit. */
export const googleSignIn: ApiDeps['googleSignIn'] = async () => {
  throw new Error('Google sign-in is not available yet')
}
