import type { Account, Calendar } from '@mysticals/core/shared/types'

export interface AccountSection {
  account: Account
  calendars: Calendar[]
  /** First sync still running: no calendars to show yet, so show placeholders (desktop Sidebar). */
  loading: boolean
}

/** One section per account listing only that account's calendars. */
export const accountSections = (accounts: Account[], calendars: Calendar[]): AccountSection[] =>
  accounts.map((account) => {
    const cals = calendars.filter((c) => c.accountId === account.id)
    return { account, calendars: cals, loading: !account.synced && !cals.length && !!account.syncing }
  })
