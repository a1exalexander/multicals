import { AuthRequest, Prompt } from 'expo-auth-session'
import type { ApiDeps } from '@mysticals/core/api'
import { AUTH_URL, SCOPES, postToken, setClientConfig, signInResult } from '@mysticals/core/providers/google/token'
import { NOT_CONFIGURED, iosClientConfig, iosRedirectUri } from './googleClient'

/** Build-time iOS OAuth client (no secret). Set at load so token refresh in the Google provider works too. */
export const googleClientConfig = iosClientConfig(process.env.EXPO_PUBLIC_MYSTICALS_GOOGLE_IOS_CLIENT_ID)
setClientConfig(googleClientConfig)

/** Google OAuth on iOS: ASWebAuthenticationSession + PKCE, redirect to the reversed client id; token exchange via core. */
export const googleSignIn: ApiDeps['googleSignIn'] = async () => {
  const { clientId } = googleClientConfig
  if (!clientId) throw new Error(NOT_CONFIGURED)
  const redirectUri = iosRedirectUri(clientId)
  const request = new AuthRequest({
    clientId,
    redirectUri,
    scopes: SCOPES.split(' '),
    usePKCE: true,
    prompt: Prompt.Consent, // otherwise Google omits the refresh token on repeat sign-ins
    extraParams: { access_type: 'offline' }
  })
  const result = await request.promptAsync({ authorizationEndpoint: AUTH_URL })
  if (result.type === 'error') throw new Error(`Google sign-in failed: ${result.params.error ?? result.error?.message ?? 'unknown error'}`)
  if (result.type !== 'success') throw new Error('Google sign-in cancelled')
  const tok = await postToken({
    grant_type: 'authorization_code',
    code: result.params.code,
    code_verifier: request.codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId
  })
  return signInResult(tok)
}
