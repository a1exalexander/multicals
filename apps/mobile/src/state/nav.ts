import { useSyncExternalStore } from 'react'
import type { View } from '@mysticals/core/logic/layout'

/** Current date + view, shared by the calendar screen, header and views (desktop views/nav.ts). */
export interface NavState {
  date: Date
  view: View
}

let state: NavState = { date: new Date(), view: 'day' }
const subs = new Set<() => void>()

export const nav = {
  get: (): NavState => state,
  set(patch: Partial<NavState>): void {
    state = { ...state, ...patch }
    subs.forEach((f) => f())
  }
}

const subscribe = (cb: () => void): (() => void) => {
  subs.add(cb)
  return () => void subs.delete(cb)
}

export const useNav = (): NavState => useSyncExternalStore(subscribe, nav.get)
