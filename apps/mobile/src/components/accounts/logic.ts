// Pure helpers for the add-account and settings sheets (ported from desktop AccountsShared.tsx). No React Native imports: unit tested.
import { CALDAV_PRESETS } from '@mysticals/core/shared/presets'

/** Where each provider hands out the password Mysticals needs; shown under the password field. */
const HINTS: Record<string, string> = {
  privateemail: 'Use your Private Email mailbox password.',
  icloud: 'Create an app-specific password at account.apple.com → Sign-In and Security.',
  fastmail: 'Create an app password in Fastmail → Settings → Privacy & Security.',
  custom: "Use an app password from your provider's security settings if it offers one."
}

export const PRESETS = [...CALDAV_PRESETS, { id: 'custom', name: 'Custom', url: '' }].map((p) => ({ ...p, hint: HINTS[p.id] }))
export type Preset = (typeof PRESETS)[number]

const PERSONAL_DOMAINS = /^(gmail|googlemail|icloud|me|mac|outlook|hotmail|live|yahoo|fastmail|proton|protonmail|aol|gmx|ukr)\./i

/** "Personal" for well-known consumer mail domains, otherwise "Work". */
export function suggestLabel(email: string): string {
  const domain = email.split('@')[1] ?? ''
  if (!domain) return ''
  return PERSONAL_DOMAINS.test(domain) ? 'Personal' : 'Work'
}

const NETWORK = /network request failed|fetch failed|TimeoutError|aborted|could not be found|offline|timed out|could not connect/i

/** Message for the user: strips Electron-style wrappers and native noise, and turns network failures into one plain sentence. */
export function errorText(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '')
  if (NETWORK.test(msg)) {
    const host = /https?:\/\/([^/\s:]+)/i.exec(msg)?.[1]
    return `Couldn't reach ${host ?? 'the server'}. Check the server address and your connection.`
  }
  return msg.replace(/\w*Exception: /g, '').replace(/ \(at [^)]*\)$/, '')
}

/** Host part of a server URL, for "Signing in to caldav.icloud.com…" (regex: Hermes' URL is partial). */
export const hostOf = (url: string): string => /^[a-z]+:\/\/([^/?#]+)/i.exec(url)?.[1] ?? url

/** Form can be submitted: a http(s) server, an email-ish username and a password. */
export const canConnect = (f: { serverUrl: string; username: string; password: string }): boolean =>
  /^https?:\/\/[^/\s]+/i.test(f.serverUrl.trim()) && f.username.trim().length > 0 && f.password.length > 0
