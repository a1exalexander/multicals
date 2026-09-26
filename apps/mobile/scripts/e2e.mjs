#!/usr/bin/env node
import { createRequire } from 'module'
// Evaluates JS inside the running dev app (via Metro's Hermes inspector) and prints the result.
//   node scripts/e2e.mjs [--port 8081] [--device "iPhone 18 Pro"] '<expression>'
// The app exposes globalThis.__e2e = { router, api, bus, toast, nav, sheets, setTheme } (src/e2e.ts).
// Example: node scripts/e2e.mjs "__e2e.sheets.openSettings()"
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i < 0 ? fallback : args.splice(i, 2)[1]
}
const port = opt('--port', process.env.RCT_METRO_PORT ?? '8081')
const device = opt('--device', undefined)
const expression = args.join(' ')
// Node's built-in WebSocket can't set Origin, which Metro's inspector requires; borrow the `ws` package Expo CLI ships.
const fromExpo = createRequire(createRequire(import.meta.url).resolve('expo/package.json'))
const WebSocket = createRequire(fromExpo.resolve('@expo/cli/package.json'))('ws')
const host = `http://127.0.0.1:${port}`
if (!expression) {
  console.error('usage: e2e.mjs [--port N] [--device NAME] <expression>')
  process.exit(2)
}

const targets = await (await fetch(`${host}/json/list`)).json()
const target = targets.find((t) => t.reactNative && (!device || t.deviceName === device))
if (!target) {
  console.error(`no app connected to Metro on :${port}${device ? ` for ${device}` : ''}`)
  process.exit(1)
}

// Metro only accepts inspector sockets from its own origin.
const ws = new WebSocket(target.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'), { origin: host })
const timer = setTimeout(() => {
  console.error('timed out')
  process.exit(1)
}, 15000)
// Hermes ignores `awaitPromise`, so the result is parked on a global and polled.
const send = (id, expr) => ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }))
ws.on('open', () =>
  send(
    1,
    `globalThis.__e2eOut = undefined; Promise.resolve().then(() => (${expression})).then(` +
      `(v) => { globalThis.__e2eOut = JSON.stringify({ v: v === undefined ? null : v }) }, ` +
      `(e) => { globalThis.__e2eOut = JSON.stringify({ e: String(e && e.stack || e) }) }); 0`
  )
)
let poll = 1
ws.on('message', (data) => {
  const msg = JSON.parse(String(data))
  if (msg.id !== poll) return
  const { result, exceptionDetails } = msg.result ?? {}
  if (exceptionDetails) {
    console.error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    process.exit(1)
  }
  if (poll > 1 && typeof result?.value === 'string') {
    clearTimeout(timer)
    const out = JSON.parse(result.value)
    if ('e' in out) {
      console.error(out.e)
      process.exit(1)
    }
    console.log(JSON.stringify(out.v, null, 2))
    process.exit(0)
  }
  setTimeout(() => send(++poll, 'globalThis.__e2eOut'), poll > 1 ? 100 : 0)
})
