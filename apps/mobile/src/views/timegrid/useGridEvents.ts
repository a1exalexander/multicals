import { useCallback, useEffect, useMemo, useState } from 'react'
import { shiftDate, viewRange, type View } from '@mysticals/core/logic/layout'
import { visibleEvents } from '@mysticals/core/logic/visible'
import type { Calendar, CalEvent } from '@mysticals/core/shared/types'
import { api } from '../../api'
import { toast } from '../../state/bus'
import { keyOf } from './logic'

export type MoveTo = (e: CalEvent, start: string, end: string) => void

const same = (a: string, b: string): boolean => Date.parse(a) === Date.parse(b) || a === b
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Visible events of the previous, current and next page, so a swipe reveals real content instead of a blank
 * page. The last result stays up while the next range loads (paging never flashes empty). `fallback` (the
 * screen's events for the current range) covers the very first load. Drops show at their new time at once
 * (desktop CalendarView `moved`), until the data catches up or the save fails.
 */
export function useGridEvents(view: View, date: Date, calendars: Calendar[], fallback: CalEvent[]): { events: CalEvent[]; moveTo: MoveTo } {
  const start = viewRange(view, shiftDate(view, date, -1)).start
  const end = viewRange(view, shiftDate(view, date, 1)).end
  const [all, setAll] = useState<CalEvent[] | null>(null)

  useEffect(() => {
    let seq = 0
    let alive = true
    const load = (): void => {
      const my = ++seq
      api.events.list({ start, end }).then(
        (evs) => alive && my === seq && setAll(evs),
        (e) => console.error('TimeGrid: load failed', e)
      )
    }
    load()
    const off = api.onChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [start, end])

  const [moved, setMoved] = useState<Map<string, { start: string; end: string }>>(() => new Map())
  useEffect(() => {
    if (!all) return
    setMoved((m) => {
      if (!m.size) return m
      const caught = [...m].filter(([k, to]) => {
        const e = all.find((x) => keyOf(x) === k)
        return !e || (same(e.start, to.start) && same(e.end, to.end))
      })
      if (!caught.length) return m
      const next = new Map(m)
      for (const [k] of caught) next.delete(k)
      return next
    })
  }, [all])

  const events = useMemo(() => {
    const shown = all ? visibleEvents(all, calendars) : fallback
    return moved.size ? shown.map((e) => ({ ...e, ...moved.get(keyOf(e)) })) : shown
  }, [all, calendars, fallback, moved])

  const moveTo = useCallback<MoveTo>((e, start, end) => {
    const k = keyOf(e)
    setMoved((m) => new Map(m).set(k, { start, end }))
    // Recurring events: this instance only, like desktop.
    api.events.update({ ...e, start, end }).then(
      () =>
        toast({
          text: `Moved “${e.title || 'Untitled'}”`,
          // Undo is just the reverse move.
          action: { label: 'Undo', run: () => moveTo({ ...e, start, end }, e.start, e.end) }
        }),
      (err) => {
        setMoved((m) => {
          const next = new Map(m)
          next.delete(k)
          return next
        })
        toast({ text: `Couldn't move “${e.title || 'Untitled'}”: ${errorText(err)}`, error: true })
      }
    )
  }, [])

  return { events, moveTo }
}
