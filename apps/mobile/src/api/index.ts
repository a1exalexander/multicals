import type { Api } from '@mysticals/core/shared/ipc'
import { createMockApi } from '@mysticals/core/mock/mockApi'
import { createMobileApi } from './mobile'

/** Mock backend (two fake accounts, no network), like MYSTICALS_MOCK=1 on desktop. */
export const MOCK = process.env.EXPO_PUBLIC_MYSTICALS_MOCK === '1'

function mockApi(): Api {
  const subs = new Set<(accountId: string) => void>()
  return {
    ...createMockApi((id) => subs.forEach((f) => f(id))),
    onChanged(cb) {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    onMenu: () => () => {}
  }
}

/** The app's single data API (desktop: window.api). Same contract as desktop, called in-process. */
export const api: Api = MOCK ? mockApi() : createMobileApi()
