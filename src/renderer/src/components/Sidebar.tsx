import { bus } from '../bus'

// Unit 6 owns: mini-month, accounts grouped with their calendars + visibility toggles.
export function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar">
      <button onClick={() => bus.emit('accounts:open', {})}>Add calendar</button>
    </aside>
  )
}
