// Pure half of iOS Google sign-in (no Expo imports, so vitest can load it).
import type { ClientConfig } from '@mysticals/core/providers/google/token'

export const NOT_CONFIGURED =
  'Google sign-in is not configured in this build: add a CalDAV account, or build from source with EXPO_PUBLIC_MYSTICALS_GOOGLE_IOS_CLIENT_ID set'

/** iOS OAuth clients have no secret; `{}` when the build has no client id (sign-in then fails with NOT_CONFIGURED). */
export function iosClientConfig(clientId: string | undefined): Partial<ClientConfig> {
  return clientId ? { clientId, noSecret: true } : {}
}

/** Google's iOS client redirect: the reversed client id as scheme, e.g. com.googleusercontent.apps.123-abc:/oauth2redirect. */
export function iosRedirectUri(clientId: string): string {
  return `${clientId.split('.').reverse().join('.')}:/oauth2redirect`
}
