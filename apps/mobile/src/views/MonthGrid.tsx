import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import * as Haptics from 'expo-haptics'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { monthGrid, shiftDate, ymd } from '@mysticals/core/logic/layout'
import { visibleEvents } from '@mysticals/core/logic/visible'
import { canEdit } from '@mysticals/core/logic/details'
import type { CalEvent } from '@mysticals/core/shared/types'
import { api } from '../api'
import { useCalendarData } from '../hooks/useCalendarData'
import { toast } from '../state/bus'
import { nav } from '../state/nav'
import { sheets } from '../state/sheets'
import { fonts, motion, useTheme } from '../theme'
import { cellAt, chipRows, fitChips, fromMonthIndex, hitInCell, monthIndex, shiftDays, snapPage } from './month/math'
import { Chip, keyOf, MonthPage, pageDays, type ColorOf } from './month/MonthPage'
import type { ViewProps } from './types'

const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOLD_MS = 350
const sameTime = (a: string, b: string): boolean => a === b || +new Date(a) === +new Date(b)
const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * Month view: a 6-week grid paged horizontally (same axis as the time grid). Pages sit on a strip positioned by
 * month index, so a swipe only animates the strip on the UI thread and the neighbours are already rendered.
 * Tap a day → day view, tap a chip → details, hold a free spot → new all-day event, hold a chip → drag it to another day.
 */
export function MonthGrid({ date, events: current, accounts, calendars, loaded }: ViewProps): React.JSX.Element {
  const t = useTheme()
  const reduce = useReducedMotion()
  const idx = monthIndex(date)
  const anchor = useRef(idx).current
  // The screen loads only this month's 6 weeks; load prev..next too so swiped-in pages already have their chips.
  // The previous wide load covers the new month while the next one is in flight, so nothing pops in after a swipe.
  const wideRange = useMemo(
    () => ({ start: monthGrid(fromMonthIndex(idx - 1))[0].toISOString(), end: addDays(monthGrid(fromMonthIndex(idx + 1))[41], 1).toISOString() }),
    [idx]
  )
  const wide = useCalendarData(wideRange)
  const all = useMemo(() => (wide.loaded ? visibleEvents(wide.events, calendars) : current), [wide.loaded, wide.events, calendars, current])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Dropped events show on their new day at once; an entry goes when the data catches up or the save fails (desktop).
  const [moved, setMoved] = useState<Map<string, { start: string; end: string }>>(() => new Map())
  const events = useMemo(() => (moved.size ? all.map((e) => ({ ...e, ...moved.get(keyOf(e)) })) : all), [all, moved])
  useEffect(() => {
    setMoved((m) => {
      if (!m.size) return m
      const next = new Map(m)
      for (const [k, to] of m) {
        const e = all.find((x) => keyOf(x) === k)
        if (!e || (sameTime(e.start, to.start) && sameTime(e.end, to.end))) next.delete(k)
      }
      return next.size === m.size ? m : next
    })
  }, [all])

  const colorOf = useMemo<ColorOf>(() => {
    const cal = new Map(calendars.map((c) => [`${c.accountId}/${c.id}`, c.color]))
    const acc = new Map(accounts.map((a) => [a.id, a.color]))
    return (e) => cal.get(`${e.accountId}/${e.calendarId}`) ?? acc.get(e.accountId) ?? t.muted
  }, [accounts, calendars, t.muted])
  const canDrag = useCallback(
    (e: CalEvent) =>
      canEdit(
        e,
        accounts.find((a) => a.id === e.accountId),
        calendars.find((c) => c.accountId === e.accountId && c.id === e.calendarId)
      ),
    [accounts, calendars]
  )

  // Per-month day lists, cached while `events` is unchanged so pages that stay mounted keep identical props.
  const cache = useMemo(() => new Map<number, ReturnType<typeof pageDays>>(), [events])
  const pageOf = (m: number): ReturnType<typeof pageDays> => {
    let p = cache.get(m)
    if (!p) cache.set(m, (p = pageDays(m, events)))
    return p
  }
  const cur = pageOf(idx)
  const rows = chipRows(size.h / 6)

  const move = useCallback((e: CalEvent, start: string, end: string): void => {
    const k = keyOf(e)
    setMoved((m) => new Map(m).set(k, { start, end }))
    api.events.update({ ...e, start, end }).then(
      // Undo is just the reverse move.
      () => toast({ text: `Moved “${e.title || 'Untitled'}”`, action: { label: 'Undo', run: () => move({ ...e, start, end }, e.start, e.end) } }),
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
  /** Commit path shared by the drag gesture and the e2e hook. */
  const drop = useCallback((e: CalEvent, days: number): void => {
    if (!days) return
    const to = shiftDays(e, days)
    move(e, to.start, to.end)
  }, [move])

  // ---- Paging: `x` is the strip offset, `page` the settled page relative to `anchor`.
  const x = useSharedValue(0)
  const page = useSharedValue(0)
  const startX = useSharedValue(0)
  const width = useSharedValue(0)
  const height = useSharedValue(0)
  const expected = useRef(idx)
  const lastW = useRef(0)
  useLayoutEffect(() => {
    // Our own swipe already animates to `idx`; anything else (Today, header, e2e) jumps there.
    if (idx === expected.current && size.w === lastW.current) return
    expected.current = idx
    lastW.current = size.w
    page.value = idx - anchor
    x.value = -(idx - anchor) * size.w
  }, [idx, size.w, anchor, page, x])

  // ---- Chip drag: JS owns the event + target cell; the finger position lives in shared values.
  type Drag = { e: CalEvent; from: number; over: number }
  const [drag, setDragState] = useState<Drag | null>(null)
  // Mirrors `drag` synchronously: the release can arrive before React has rendered the last `over`.
  const dragRef = useRef<Drag | null>(null)
  const setDrag = useCallback((d: Drag | null) => setDragState((dragRef.current = d)), [])
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const over = useSharedValue(-1)
  const active = useSharedValue(false)

  // Gesture callbacks call through this ref so the gesture objects never need rebuilding.
  const live = useRef({ cur, rows, size, canDrag, drop })
  live.current = { cur, rows, size, canDrag, drop }
  const js = useMemo(() => {
    const hit = (px: number, py: number): { cell: number; e?: CalEvent; more?: boolean } | null => {
      const { cur, rows, size } = live.current
      const cell = cellAt(px, py, size.w, size.h)
      if (cell < 0) return null
      const list = cur.lists[cell]
      const { shown, more } = fitChips(list.length, rows)
      const h = hitInCell(py - Math.floor(cell / 7) * (size.h / 6), shown, more)
      return h.kind === 'chip' ? { cell, e: list[h.index] } : { cell, more: h.kind === 'more' }
    }
    return {
      page(dir: number): void {
        const next = shiftDate('month', nav.get().date, dir as 1 | -1)
        expected.current = monthIndex(next)
        nav.set({ date: next })
        void Haptics.selectionAsync()
      },
      tap(px: number, py: number): void {
        const h = hit(px, py)
        if (!h) return
        if (h.e) sheets.openEvent(h.e)
        else nav.set({ view: 'day', date: live.current.cur.days[h.cell] })
      },
      hold(px: number, py: number): void {
        const h = hit(px, py)
        if (!h || h.more) return
        const day = live.current.cur.days[h.cell]
        if (!h.e) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          sheets.openEditor({ start: ymd(day), end: ymd(addDays(day, 1)), allDay: true })
        } else if (live.current.canDrag(h.e)) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          active.value = true
          setDrag({ e: h.e, from: h.cell, over: h.cell })
        }
      },
      over(cell: number): void {
        const d = dragRef.current
        if (d) setDrag({ ...d, over: cell })
        void Haptics.selectionAsync()
      },
      release(ok: boolean): void {
        active.value = false
        const d = dragRef.current
        setDrag(null)
        if (!d || !ok) return
        const days = live.current.cur.days
        const delta = differenceInCalendarDays(days[d.over], days[d.from])
        if (delta) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        live.current.drop(d.e, delta)
      }
    }
  }, [active, setDrag])

  const gesture = useMemo(() => {
    const spring = (to: number): number => {
      'worklet'
      return reduce ? withTiming(to, { duration: motion.fast }) : withSpring(to, motion.spring)
    }
    // Plain functions captured by worklets become callables for scheduleOnRN.
    const { page: onPage, tap: onTap, hold: onHold, over: onOver, release: onRelease } = js
    const pager = Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-12, 12])
      .onStart(() => {
        startX.value = x.value
      })
      .onUpdate((e) => {
        const w = width.value
        // Never further than one page from the settled one.
        const lo = -(page.value + 1) * w
        const hi = -(page.value - 1) * w
        x.value = Math.min(hi, Math.max(lo, startX.value + e.translationX))
      })
      .onEnd((e) => {
        const dx = x.value + page.value * width.value
        const dir = snapPage(dx, e.velocityX, width.value)
        page.value += dir
        x.value = spring(-page.value * width.value)
        if (dir) scheduleOnRN(onPage, dir)
      })
    const hold = Gesture.Pan()
      .activateAfterLongPress(HOLD_MS)
      .onStart((e) => {
        dragX.value = e.x
        dragY.value = e.y
        over.value = cellAt(e.x, e.y, width.value, height.value)
        scheduleOnRN(onHold, e.x, e.y)
      })
      .onUpdate((e) => {
        dragX.value = e.x
        dragY.value = e.y
        if (!active.value) return
        const c = cellAt(e.x, e.y, width.value, height.value)
        // Off the grid keeps the last cell (desktop behaviour).
        if (c >= 0 && c !== over.value) {
          over.value = c
          scheduleOnRN(onOver, c)
        }
      })
      .onFinalize((_, ok) => {
        scheduleOnRN(onRelease, ok)
      })
    const tap = Gesture.Tap().onEnd((e, ok) => {
      if (ok) scheduleOnRN(onTap, e.x, e.y)
    })
    return Gesture.Race(pager, hold, tap)
  }, [reduce, js, x, page, startX, width, height, dragX, dragY, over, active])

  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const cw = size.w / 7
  const preview = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - cw / 2 }, { translateY: dragY.value - 28 }]
  }))

  const onLayout = (e: LayoutChangeEvent): void => {
    const { width: w, height: h } = e.nativeEvent.layout
    width.value = w
    height.value = h
    setSize({ w, h })
  }

  // Dev-only: drives the same commit path as the drag gesture (touch can't be injected on the simulator).
  useEffect(() => {
    if (!__DEV__) return
    const g = globalThis as { __e2e?: Record<string, unknown> }
    if (!g.__e2e) return
    g.__e2e.monthDrop = (id: string, days: number): boolean => {
      const e = events.find((x) => x.id === id)
      if (!e || !canDrag(e)) return false
      drop(e, days)
      return true
    }
    return () => void delete g.__e2e?.monthDrop
  }, [events, canDrag, drop])

  const dragKey = drag ? keyOf(drag.e) : null
  return (
    <View style={styles.wrap}>
      <View style={[styles.dows, { borderColor: t.lineStrong, borderTopColor: t.line }]}>
        {DOWS.map((d) => (
          <Text key={d} style={[styles.dow, { color: t.muted }]}>
            {d.toUpperCase()}
          </Text>
        ))}
      </View>
      <GestureDetector gesture={gesture}>
        <View style={styles.body} onLayout={onLayout}>
          {size.w > 0 && (
            <Animated.View style={[styles.strip, strip]}>
              {[idx - 1, idx, idx + 1].map((m) => {
                const p = pageOf(m)
                return (
                  <View key={m} style={[styles.slot, { left: (m - anchor) * size.w }]}>
                    <MonthPage
                      month={m}
                      days={p.days}
                      lists={p.lists}
                      w={size.w}
                      h={size.h}
                      rows={rows}
                      over={m === idx && drag ? drag.over : -1}
                      dragKey={m === idx ? dragKey : null}
                      loaded={loaded}
                      t={t}
                      colorOf={colorOf}
                      now={now}
                    />
                  </View>
                )
              })}
            </Animated.View>
          )}
          {drag && (
            <Animated.View pointerEvents="none" style={[styles.preview, { width: cw * 1.3, backgroundColor: t.surface2, borderColor: t.lineStrong }, preview]}>
              <Chip e={drag.e} color={colorOf(drag.e)} t={t} now={now} />
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  dows: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth },
  dow: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, textAlign: 'right', fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6 },
  body: { flex: 1, overflow: 'hidden' },
  strip: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  slot: { position: 'absolute', top: 0 },
  preview: { position: 'absolute', top: 0, left: 0, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, padding: 1 }
})
