import { useEffect, useState } from 'react'
import type { Account } from '@shared/types'
import { bus } from '../bus'
import { THEMES, applyTheme, useTheme } from '../theme'
import { KindIcon, Sheet, Swatches, errorText } from './AccountsShared'

// Unit 8 owns. Listens to bus 'settings:open'.
export function SettingsHost(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => bus.on('settings:open', () => setOpen(true)), [])
  useEffect(() => {
    if (!open) return
    const load = (): void => void window.api.accounts.list().then(setAccounts, () => {})
    load()
    return window.api.onChanged(load)
  }, [open])

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Settings" testId="settings-sheet">
      <h3 className="acc-section-title">Theme</h3>
      <ThemePicker />
      <h3 className="acc-section-title">Accounts</h3>
      {accounts.length === 0 ? (
        <p className="acc-note">No accounts yet.</p>
      ) : (
        <ul className="acc-list">
          {accounts.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </ul>
      )}
      <div className="acc-actions">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            bus.emit('accounts:open', {})
          }}
        >
          Add account…
        </button>
      </div>
    </Sheet>
  )
}

function ThemePicker(): React.JSX.Element {
  const theme = useTheme()
  return (
    <div className="theme-grid" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          className="theme-opt"
          data-testid={`theme-${t.id}`}
          onClick={() => applyTheme(t.id)}
        >
          <span className="theme-swatch" style={{ background: t.preview[0] }} aria-hidden>
            {t.preview.slice(1).map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          <span className="theme-name">
            {t.name}
            {theme === t.id && <span className="on">●</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

function AccountRow({ account: a }: { account: Account }): React.JSX.Element {
  const [label, setLabel] = useState(a.label)
  const [confirm, setConfirm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setLabel(a.label), [a.label])

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    }
  }
  const rename = (): void => {
    const next = label.trim()
    if (!next) return setLabel(a.label)
    if (next !== a.label) void run(() => window.api.accounts.update(a.id, { label: next }))
  }
  const sync = async (): Promise<void> => {
    setSyncing(true)
    await run(() => window.api.sync.now(a.id))
    setSyncing(false)
  }

  return (
    <li className="acc-item" data-testid={`account-${a.id}`}>
      <div className="acc-item-head">
        <span className="acc-dot" style={{ background: a.color }} />
        <KindIcon kind={a.kind} />
        <div className="acc-item-id">
          <input
            className="acc-rename"
            aria-label={`Label for ${a.email}`}
            data-testid={`account-label-${a.id}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                e.preventDefault()
                setLabel(a.label)
              }
            }}
          />
          <span className="acc-email">{a.email}</span>
        </div>
        <button type="button" onClick={sync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        <button type="button" className="acc-danger" onClick={() => setConfirm(true)}>
          Remove
        </button>
      </div>
      <Swatches
        value={a.color}
        name={`Colour for ${a.email}`}
        onChange={(color) => void run(() => window.api.accounts.update(a.id, { color }))}
      />
      {a.error && <p className="acc-error">Last sync failed: {a.error}</p>}
      {error && <p className="acc-error" role="alert">{error}</p>}
      {confirm && (
        <div className="acc-confirm">
          <p>Removes local data and credentials for {a.email}. Nothing is deleted on the server.</p>
          <button type="button" onClick={() => setConfirm(false)}>Cancel</button>
          <button
            type="button"
            className="acc-danger acc-primary-danger"
            data-testid={`account-remove-${a.id}`}
            onClick={() => void run(() => window.api.accounts.remove(a.id))}
          >
            Remove account
          </button>
        </div>
      )}
    </li>
  )
}
