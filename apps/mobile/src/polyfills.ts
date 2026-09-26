// Web globals @mysticals/core expects (it runs on Node too); Hermes lacks some of them.
import { getRandomValues, randomUUID } from 'expo-crypto'

const g = globalThis as Record<string, any>

g.crypto ??= {}
g.crypto.randomUUID ??= randomUUID
g.crypto.getRandomValues ??= getRandomValues

// core/providers/http.ts: request timeouts combined with caller signals.
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number): AbortSignal => {
    const c = new AbortController()
    setTimeout(() => c.abort(new Error('TimeoutError')), ms)
    return c.signal
  }
}
if (!(AbortSignal as any).any) {
  ;(AbortSignal as any).any = (signals: AbortSignal[]): AbortSignal => {
    const c = new AbortController()
    for (const s of signals) {
      if (s.aborted) {
        c.abort(s.reason)
        break
      }
      s.addEventListener('abort', () => c.abort(s.reason), { once: true })
    }
    return c.signal
  }
}

// core/providers/google/token.ts decodes id_token payloads (UTF-8).
g.TextDecoder ??= class {
  decode(bytes: Uint8Array): string {
    return decodeURIComponent(escape(String.fromCharCode(...bytes)))
  }
}
