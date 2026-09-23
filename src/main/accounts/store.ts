import type { Account, AccountKind, Calendar, CalEvent, Credentials } from '@shared/types'
import type { CalendarProvider, ProviderFactory } from '../providers/types'

export interface AccountCache {
  calendars: Calendar[]
  events: CalEvent[]
  syncedAt?: string
}

// Unit 3 (account store + secrets) implements this.
// Layout: <dir>/accounts.json registry; <dir>/accounts/<id>/{creds.bin,cache.json,prefs.json}
export class AccountStore {
  constructor(
    readonly dir: string,
    readonly factories: Record<AccountKind, ProviderFactory>
  ) {}

  list(): Account[] {
    throw new Error('TODO')
  }
  get(_id: string): Account | undefined {
    throw new Error('TODO')
  }
  async add(_meta: Omit<Account, 'id'>, _creds: Credentials): Promise<Account> {
    throw new Error('TODO')
  }
  async update(_id: string, _patch: { label?: string; color?: string; error?: string }): Promise<Account> {
    throw new Error('TODO')
  }
  /** Removes account and wipes its directory (creds + cache). */
  async remove(_id: string): Promise<void> {
    throw new Error('TODO')
  }
  /** Isolated provider instance for this account only (memoized per account). */
  getProvider(_id: string): CalendarProvider {
    throw new Error('TODO')
  }
  readCache(_id: string): AccountCache {
    throw new Error('TODO')
  }
  async writeCache(_id: string, _cache: AccountCache): Promise<void> {
    throw new Error('TODO')
  }
  hiddenCalendars(_id: string): string[] {
    throw new Error('TODO')
  }
  async setCalendarVisible(_id: string, _calendarId: string, _visible: boolean): Promise<void> {
    throw new Error('TODO')
  }
}
