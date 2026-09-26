// Dev-only hook for scripts/e2e.mjs: lets a test drive the app over the Hermes debugger without taps
// (simulator touch injection is unreliable on the iOS 27 SDK). Never included in release bundles' behaviour.
import { router } from 'expo-router'
import { DevSettings } from 'react-native'
import { api } from './api'
import { googleSignIn } from './api/mobile/google'
import { bus, toast } from './state/bus'
import { nav } from './state/nav'
import { sheets } from './state/sheets'
import { setTheme } from './theme'

if (__DEV__) {
  ;(globalThis as Record<string, unknown>).__e2e = { router, api, googleSignIn, bus, toast, nav, sheets, setTheme, reload: () => DevSettings.reload() }
}
