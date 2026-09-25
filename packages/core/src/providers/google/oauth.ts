import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { timedFetch } from '../http'
import { buildAuthUrl, getClientConfig, postToken, type GoogleCredentials } from './token'

export * from './token'

const TIMEOUT_MS = 5 * 60 * 1000

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const DONE_HTML = (msg: string, returnUrl?: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Mysticals</title><body style="font:15px -apple-system,sans-serif;text-align:center;padding-top:80px"><h2>${msg}</h2>` +
  (returnUrl
    ? `<p>Returning to Mysticals…</p><p><a href="${returnUrl}" style="display:inline-block;padding:8px 16px;border-radius:6px;background:#bd93f9;color:#0b0b10;font-weight:600;text-decoration:none">Open Mysticals</a></p><p style="color:#888">You can close this tab.</p><script>location.href=${JSON.stringify(returnUrl)}</script></body>`
    : `<p>You can close this tab and return to Mysticals.</p></body>`)

export interface OAuthOptions {
  /** The browser came back with a code: the rest (token exchange, email) takes a moment more. */
  onCode?: () => void
  /** App link (e.g. mysticals://) the success page opens so the browser hands focus back to the app. */
  returnUrl?: string
}

/**
 * OAuth for installed apps: system browser + loopback redirect + PKCE.
 * `openUrl` opens the system browser; injected so core stays platform-free.
 */
export async function runOAuthFlow(
  openUrl: (url: string) => Promise<void>,
  opts: OAuthOptions = {}
): Promise<{ email: string; credentials: GoogleCredentials }> {
  const cfg = getClientConfig()
  const { verifier, challenge } = createPkce()
  const state = randomBytes(16).toString('base64url')
  const server = createServer()

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Google sign-in timed out')), TIMEOUT_MS)
      const finish = (err: Error | null, value?: string): void => {
        clearTimeout(timer)
        if (err) reject(err)
        else resolve(value!)
      }
      server.on('request', (req, res) => {
        const params = new URL(req.url ?? '/', redirectUri).searchParams
        // Settle only after the page is flushed, so closing the server can't cut it off.
        const reply = (status: number, msg: string, then: () => void): void => {
          res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
          res.end(DONE_HTML(msg, status === 200 ? opts.returnUrl : undefined), then)
        }
        if (!params.has('code') && !params.has('error')) {
          res.writeHead(404, { Connection: 'close' }).end()
          return
        }
        if (params.get('state') !== state) {
          reply(400, 'Sign-in failed', () => finish(new Error('Google sign-in failed: state mismatch')))
        } else if (params.has('error')) {
          reply(400, 'Sign-in cancelled', () => finish(new Error(`Google sign-in failed: ${params.get('error')}`)))
        } else {
          const code = params.get('code')!
          reply(200, 'Signed in', () => finish(null, code))
        }
      })
      openUrl(buildAuthUrl({ clientId: cfg.clientId, redirectUri, state, codeChallenge: challenge })).catch((e) =>
        finish(e instanceof Error ? e : new Error(String(e)))
      )
    })

    opts.onCode?.()
    const tok = await postToken({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret
    })
    if (!tok.refreshToken) throw new Error('Google did not return a refresh token')
    const email = tok.email ?? (await fetchUserEmail(tok.accessToken))
    return { email, credentials: { kind: 'google', refreshToken: tok.refreshToken, accessToken: tok.accessToken, expiresAt: tok.expiresAt } }
  } finally {
    server.closeAllConnections()
    server.close()
  }
}

async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await timedFetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
  const json = (await res.json().catch(() => ({}))) as { email?: unknown }
  if (!res.ok || typeof json.email !== 'string') throw new Error('Could not read Google account email')
  return json.email
}
