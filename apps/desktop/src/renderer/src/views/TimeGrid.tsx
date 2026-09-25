import { useEffect, useRef, useState } from 'react'
import { addDays, format, isSameDay, isToday } from 'date-fns'
import type { CalEvent } from '@shared/types'
import { bus } from '../bus'
import { tooltipHover } from '../components/EventTooltip'
import { meetingUrl, place } from '@mysticals/core/logic/meeting'
import { nav } from './nav'
import { dragRange, eventBounds, eventsOnDay, isPast, layoutDay, slotAt, statusClass, ymd } from '@mysticals/core/logic/layout'
import type { ColorOf } from './CalendarView'

const HOUR = 48 // px per hour
const MIN_DUR = 22 // minutes; shorter events render (and pack) as if this long
const pxOf = (min: number): number => (min / 60) * HOUR

const hhmm = (d: Date): string => format(d, 'HH:mm')

/** Wall-clock minute of `day` (DST-safe, unlike adding elapsed minutes). */
const atMinute = (day: Date, m: number): Date => {
  const d = new Date(day)
  d.setHours(0, m, 0, 0)
  return d
}

const emitTimed = (day: Date, start: number, end: number): void =>
  bus.emit('event:create', {
    start: atMinute(day, start).toISOString(),
    end: atMinute(day, end).toISOString(),
    allDay: false
  })

const open = (event: CalEvent) => (e: React.MouseEvent<HTMLElement>) => {
  e.stopPropagation()
  bus.emit('event:open', { event, anchor: e.currentTarget.getBoundingClientRect() })
}
const stop = (e: React.MouseEvent): void => e.stopPropagation()

interface Props {
  days: Date[]
  events: CalEvent[]
  colorOf: ColorOf
}

export function TimeGrid({ days, events, colorOf }: Props): React.JSX.Element {
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [drag, setDrag] = useState<{ day: Date; a: number; b: number } | null>(null)

  // Opens on a whole hour: with today shown, the one that puts now about a third down the grid, else 08:00.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const t = new Date()
    const hours = (el.clientHeight - (el.querySelector<HTMLElement>('.tg-head')?.offsetHeight ?? 0)) / HOUR
    const top = days.some((d) => isToday(d)) ? Math.floor(t.getHours() + t.getMinutes() / 60 - hours / 3) : 8
    el.scrollTop = pxOf(Math.max(0, top) * 60) - 8
  }, []) // only on mount: later steps keep the user's scroll

  // Tick on the minute so the now-line and its clock never lag behind the real time.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const tick = (): void => {
      setNow(new Date())
      t = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    t = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => clearTimeout(t)
  }, [])

  const minuteAt = (clientY: number, col: HTMLElement): number =>
    slotAt(((clientY - col.getBoundingClientRect().top) / HOUR) * 60)

  const onMouseDown = (day: Date) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.detail > 1) return
    const col = e.currentTarget
    const a = minuteAt(e.clientY, col)
    let b = a
    const move = (ev: MouseEvent): void => {
      b = minuteAt(ev.clientY, col)
      setDrag(b !== a ? { day, a, b } : null)
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setDrag(null)
      if (b !== a) {
        const r = dragRange(a, b)
        emitTimed(day, r.start, r.end)
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onDoubleClick = (day: Date) => (e: React.MouseEvent<HTMLDivElement>) => {
    const m = minuteAt(e.clientY, e.currentTarget)
    emitTimed(day, m, Math.min(1440, m + 60))
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const multi = days.length > 1
  const showsToday = days.some((d) => isToday(d))

  return (
    <div className={`tg${multi ? '' : ' tg-single'}`} ref={scroller}>
      <div className="tg-head">
        <div className="tg-row">
          <div className="tg-gutter" />
          {days.map((d) => (
            <div
              key={d.getTime()}
              className={`tg-dayhead${isToday(d) ? ' is-today' : ''}`}
              onClick={() => multi && nav.set({ view: 'day', date: d })}
            >
              <span className="dow">{format(d, 'EEE')}</span>
              <span className="num">{format(d, 'd')}</span>
            </div>
          ))}
        </div>
        <div className="tg-row tg-allday">
          <div className="tg-gutter">all-day</div>
          {days.map((d) => (
            <div
              key={d.getTime()}
              className="tg-allday-cell"
              onDoubleClick={() => bus.emit('event:create', { start: ymd(d), end: ymd(addDays(d, 1)), allDay: true })}
            >
              {eventsOnDay(events, d)
                .filter((e) => e.allDay)
                .map((e) => (
                  <div
                    key={e.id}
                    data-testid="event-block"
                    data-account-id={e.accountId}
                    className={`ev ev-allday${statusClass(e)}${isPast(e, now) ? ' is-past' : ''}`}
                    style={{ '--c': colorOf(e) } as React.CSSProperties}
                    onClick={open(e)}
                    onDoubleClick={stop}
                    {...tooltipHover(e)}
                  >
                    <span className="ev-title">{e.title}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="tg-body" style={{ height: pxOf(1440) }}>
        <div className="tg-gutter">
          {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
            <span
              key={h}
              className="tg-hour"
              // the now clock takes the place of an hour label it would overlap
              style={{ top: pxOf(h * 60), visibility: showsToday && Math.abs(nowMin - h * 60) < 12 ? 'hidden' : undefined }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
          {showsToday && (
            <span className="tg-now-clock" data-testid="now-clock" style={{ top: pxOf(nowMin) }}>
              {hhmm(now)}
            </span>
          )}
        </div>
        {days.map((d) => (
          <div
            key={d.getTime()}
            className={`tg-col${isToday(d) ? ' is-today' : ''}`}
            style={{ '--hour': `${HOUR}px` } as React.CSSProperties}
            onMouseDown={onMouseDown(d)}
            onDoubleClick={onDoubleClick(d)}
          >
            {layoutDay(events, d, MIN_DUR).map(({ item: e, start, end, col, cols }) => {
              const b = eventBounds(e)
              const h = pxOf(Math.max(end - start, MIN_DUR))
              return (
                <div
                  key={e.id}
                  data-testid="event-block"
                  data-account-id={e.accountId}
                  className={`ev ev-timed${statusClass(e)}${isPast(e, now) ? ' is-past' : ''}${h < 34 ? ' is-short' : ''}`}
                  style={
                    {
                      '--c': colorOf(e),
                      top: pxOf(start),
                      height: h - 1,
                      left: `calc(${(col / cols) * 100}% + 1px)`,
                      width: `calc(${100 / cols}% - 3px)`
                    } as React.CSSProperties
                  }
                  title={meetingUrl(e.location) ? undefined : `${e.title}\n${hhmm(b.start)} – ${hhmm(b.end)}`}
                  onMouseDown={stop}
                  onDoubleClick={stop}
                  onClick={open(e)}
                  {...tooltipHover(e)}
                >
                  <span className="ev-title">{e.title}</span>
                  <span className="ev-meta">
                    {hhmm(b.start)}
                    {e.location ? ` · ${place(e.location)}` : ''}
                  </span>
                </div>
              )
            })}
            {drag && isSameDay(drag.day, d) && (() => {
              const r = dragRange(drag.a, drag.b)
              return (
                <div className="tg-ghost" style={{ top: pxOf(r.start), height: pxOf(r.end - r.start) }}>
                  {hhmm(atMinute(d, r.start))} – {hhmm(atMinute(d, r.end))}
                </div>
              )
            })()}
            {isToday(d) ? (
              <div className="tg-now" style={{ top: pxOf(nowMin) }}>
                <span className="tg-now-dot" />
              </div>
            ) : (
              // the same time on the other days of the view, faint
              showsToday && <div className="tg-now is-faint" style={{ top: pxOf(nowMin) }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
