import { useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import type { CalEvent } from '@shared/types'
import type { MenuCommand } from '@shared/ipc'
import { useCalendarData } from '../hooks/useCalendarData'
import { nav, useNav } from './nav'
import { shiftDate, viewDays, viewRange, type View } from './layout'
import { TimeGrid } from './TimeGrid'
import { MonthGrid } from './MonthGrid'

const VIEWS: View[] = ['day', 'week', 'month']
const MENU_VIEW: Partial<Record<MenuCommand, View>> = { 'view-day': 'day', 'view-week': 'week', 'view-month': 'month' }

export type ColorOf = (e: CalEvent) => string

const go = (dir: 1 | -1): void => {
  const { view, date } = nav.get()
  nav.set({ date: shiftDate(view, date, dir) })
}
const today = (): void => nav.set({ date: new Date() })

export function CalendarView(): React.JSX.Element {
  const { date, view } = useNav()
  const range = useMemo(() => viewRange(view, date), [view, date])
  const { accounts, calendars, events } = useCalendarData(range)

  const colorOf = useMemo<ColorOf>(() => {
    const cal = new Map(calendars.map((c) => [`${c.accountId}/${c.id}`, c.color]))
    const acc = new Map(accounts.map((a) => [a.id, a.color]))
    return (e) => cal.get(`${e.accountId}/${e.calendarId}`) ?? acc.get(e.accountId) ?? '#8e8e93'
  }, [accounts, calendars])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 't' || e.key === 'T') today()
    }
    window.addEventListener('keydown', onKey)
    const offMenu = window.api.onMenu((cmd) => {
      if (cmd === 'today') today()
      const v = MENU_VIEW[cmd]
      if (v) nav.set({ view: v })
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      offMenu()
    }
  }, [])

  return (
    <div className="calendar-view" data-testid="calendar-view">
      <header className="toolbar">
        <h1 className="toolbar-title">
          {view === 'day' ? (
            <>
              <b>{format(date, 'd MMMM')}</b> {format(date, 'yyyy')}
              <span className="toolbar-sub">{format(date, 'EEEE')}</span>
            </>
          ) : (
            <>
              <b>{format(date, 'MMMM')}</b> {format(date, 'yyyy')}
            </>
          )}
        </h1>
        <div className="seg" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={v === view}
              className={v === view ? 'active' : ''}
              data-testid={`view-switch-${v}`}
              onClick={() => nav.set({ view: v })}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="toolbar-nav">
          <button className="icon-btn" aria-label="Previous" onClick={() => go(-1)}>
            ‹
          </button>
          <button className="today-btn" onClick={today}>
            Today
          </button>
          <button className="icon-btn" aria-label="Next" onClick={() => go(1)}>
            ›
          </button>
        </div>
      </header>
      {view === 'month' ? (
        <MonthGrid date={date} events={events} colorOf={colorOf} />
      ) : (
        <TimeGrid days={viewDays(view, date)} events={events} colorOf={colorOf} />
      )}
    </div>
  )
}
