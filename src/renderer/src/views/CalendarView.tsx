// Unit 6 owns: day/week/month views; emits bus 'event:create' (drag/double-click) and 'event:open' (click).
export function CalendarView(): React.JSX.Element {
  return <div className="calendar-view" data-testid="calendar-view">Calendar</div>
}
