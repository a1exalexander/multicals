import { format } from 'date-fns'
import { useCalendarData } from '../hooks/useCalendarData'
import { useNav } from '../views/nav'
import { viewDays } from '../views/layout'
import { InvitesPanel } from './Invites'

/** vim-like bottom line: current view + range, per-account sync state, invites, key hints. */
export function StatusBar(): React.JSX.Element {
  const { view, date } = useNav()
  const { accounts } = useCalendarData()
  const days = view === 'week' ? viewDays('week', date) : []
  const range =
    view === 'day'
      ? format(date, 'EEE d MMM yyyy')
      : view === 'week'
        ? `${format(days[0], 'd MMM')} – ${format(days[6], 'd MMM')}`
        : format(date, 'MMMM yyyy')

  return (
    <footer className="statusbar" data-testid="statusbar">
      <span className="sbar-mode">{view}</span>
      <span className="sbar-seg">{range}</span>
      <div className="sbar-accounts">
        {accounts.map((a) => (
          <span key={a.id} className="sbar-seg sbar-acc" title={a.error ? `Sync failed: ${a.error}` : `${a.email} · synced`}>
            <span className={a.error ? 'err' : 'ok'} aria-hidden>
              {a.error ? '✕' : '●'}
            </span>
            {a.label}
            {a.error && <span className="err">sync error</span>}
          </span>
        ))}
      </div>
      <span className="sbar-grow" />
      <span className="sbar-keys" aria-hidden>
        <kbd>n</kbd> new · <kbd>t</kbd> today · <kbd>h</kbd>/<kbd>l</kbd> · <kbd>d</kbd>/<kbd>w</kbd>/<kbd>m</kbd> · <kbd>i</kbd> invites
      </span>
      <InvitesPanel />
    </footer>
  )
}
