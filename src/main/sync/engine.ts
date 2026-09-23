import type { AccountStore } from '../accounts/store'

// Unit 4 (sync engine) implements this.
export class SyncEngine {
  constructor(
    readonly store: AccountStore,
    readonly onChanged: (accountId: string) => void
  ) {}

  start(): void {
    throw new Error('TODO')
  }
  stop(): void {
    throw new Error('TODO')
  }
  /** Sync one account, or all accounts independently when id omitted. */
  async syncNow(_accountId?: string): Promise<void> {
    throw new Error('TODO')
  }
}
