import { Sidebar } from './components/Sidebar'
import { CalendarView } from './views/CalendarView'
import { EventEditorHost } from './components/EventEditor'
import { EventDetailsHost } from './components/EventDetails'
import { AccountsHost } from './components/Accounts'
import { SettingsHost } from './components/Settings'

// Layout shell. Each child is owned by a different unit; communicate via ./bus.
export function App(): React.JSX.Element {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <CalendarView />
      </main>
      <EventEditorHost />
      <EventDetailsHost />
      <AccountsHost />
      <SettingsHost />
    </div>
  )
}
