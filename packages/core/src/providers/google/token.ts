// Platform-free half of Google OAuth (config, token endpoint); the loopback flow lives in oauth.ts (Node only).
import type { Credentials } from '../../shared/types'
import { timedFetch } from '../http'

export type GoogleCredentials = Extract<Credentials, { kind: 'google' }>

export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const SCOPES = 'openid email https://www.googleapis.com/auth/calendar'

export interface ClientConfig {
  clientId: string
  clientSecret: string
}

let clientConfig: Partial<ClientConfig> = {}

/** Set once at startup by the app (both from build-time MYSTICALS_GOOGLE_CLIENT_ID/SECRET). */
export function setClientConfig(cfg: Partial<ClientConfig>): void {
  clientConfig = cfg
}

export function getClientConfig(): ClientConfig {
  const { clientId, clientSecret } = clientConfig
  if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured in this build: add a CalDAV account, or build from source with MYSTICALS_GOOGLE_CLIENT_ID/SECRET set')
  return { clientId, clientSecret }
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent'
  }).toString()
  return url.toString()
}

/** Decodes the id_token payload. No signature check: the token came straight from Google's token endpoint over TLS. */
export function emailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(base64UrlDecode(idToken.split('.')[1]))
    return typeof payload.email === 'string' ? payload.email : undefined
  } catch {
    return undefined
  }
}

export interface TokenResult {
  accessToken: string
  expiresAt: number
  refreshToken?: string
  email?: string
}

export function parseTokenResponse(json: unknown, now = Date.now()): TokenResult {
  const j = (json ?? {}) as Record<string, unknown>
  if (typeof j.error === 'string') throw new Error(`Google token error: ${j.error}${j.error_description ? ` (${j.error_description})` : ''}`)
  if (typeof j.access_token !== 'string') throw new Error('Google token response has no access_token')
  const expiresIn = typeof j.expires_in === 'number' ? j.expires_in : 3600
  return {
    accessToken: j.access_token,
    expiresAt: now + expiresIn * 1000,
    refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : undefined,
    email: typeof j.id_token === 'string' ? emailFromIdToken(j.id_token) : undefined
  }
}

export async function postToken(params: Record<string, string>): Promise<TokenResult> {
  const res = await timedFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  })
  const json = await res.json().catch(() => ({ error: `http_${res.status}` }))
  if (!res.ok && !json.error) json.error = `http_${res.status}`
  return parseTokenResponse(json)
}

/** base64url -> UTF-8 text with web globals only (atob, TextDecoder), so it runs in Node and React Native alike. */
function base64UrlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
