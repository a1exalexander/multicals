import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler'
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import * as Haptics from 'expo-haptics'
import { isToday } from 'date-fns'
import { shiftDate, viewDays } from '@mysticals/core/logic/layout'
import { canEdit } from '@mysticals/core/logic/details'
import type { CalEvent } from '@mysticals/core/shared/types'
import { nav } from '../state/nav'
import { sheets } from '../state/sheets'
import { eventColors, fonts, grid, mix, motion, useTheme, type Theme } from '../theme'
import { atMinute, keyOf, pageBlocks, type Block } from './timegrid/logic'
import { dayAt, dayShift, HANDLE_PX, hitTest, initialScroll, minOf, moveRange, pageTarget, pxOf, resizeEnd, slotOf, spanOf, STEP, type Rect } from './timegrid/math'
import { BodyPage, HeadPage, type ColorOf } from './timegrid/Page'
import { useGridEvents } from './timegrid/useGridEvents'
import type { ViewProps } from './types'

const H = grid.hourHeight
const DAY_PX = pxOf(1440, H)
const NONE = 0
const MOVE = 1
const RESIZE = 2
const CREATE = 3
type Mode = typeof MOVE | typeof RESIZE | typeof CREATE

const fmt = (m: number): string => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Re-renders on every wall-clock minute so the now-line and past-dimming never lag. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const tick = (): void => {
      setNow(Date.now())
      t = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    t = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => clearTimeout(t)
  }, [])
  return now
}

/** Hour and column hairlines: identical on every page, so drawn once under the sliding pages. */
const Lines = memo(function Lines({ n, colW, t }: { n: number; colW: number; t: Theme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 24 }, (_, h) => (
        <View key={`h${h}`} style={[styles.hline, { top: h * H, backgroundColor: t.line }]} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <View key={`c${i}`} style={[styles.vline, { left: i * colW, backgroundColor: t.line }]} />
      ))}
    </View>
  )
})

const Gutter = memo(function Gutter({ t, nowMin }: { t: Theme; nowMin: number | null }) {
  return (
    <View style={{ width: grid.gutter, height: DAY_PX }}>
      {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
        <Text
          key={h}
          // the now clock takes the place of an hour label it would overlap
          style={[styles.hour, { top: h * H - 6, color: t.muted }, nowMin !== null && Math.abs(nowMin - h * 60) < 12 && styles.hidden]}
        >
          {fmt(h * 60)}
        </Text>
      ))}
      {nowMin !== null && (
        <Text testID="now-clock" style={[styles.clock, { top: pxOf(nowMin, H) - 7, backgroundColor: t.today, color: t.onAccent }]}>
          {fmt(nowMin)}
        </Text>
      )}
    </View>
  )
})

interface Lift {
  mode: Mode
  block: Block | null
}

/** The lifted event (or the new-event ghost) following the finger; position lives in shared values, text in local state. */
function DragOverlay(props: {
  lift: Lift
  t: Theme
  colorOf: ColorOf
  colW: number
  day: { value: number }
  start: { value: number }
  end: { value: number }
  live: { value: number }
  reduced: boolean
  setLabel: React.RefObject<((s: string) => void) | null>
  initial: string
}): React.JSX.Element {
  const { lift, t, colorOf, colW, day, start, end, live, reduced } = props
  // Keeps a packed block's offset inside its column while it travels between days.
  const inset = lift.block ? lift.block.rect.x - lift.block.day * colW : 1
  const [label, setLabel] = useState(props.initial)
  props.setLabel.current = setLabel
  const style = useAnimatedStyle(() => {
    // First frame lands exactly where the block is; snapped steps after that glide.
    const go = (v: number): number => (live.value && !reduced ? withSpring(v, motion.snappy) : v)
    return {
      top: go(pxOf(start.value, H)),
      height: go(pxOf(Math.max(end.value - start.value, grid.minEventMin), H) - 1),
      left: go(day.value * colW + inset),
      transform: [{ scale: reduced || lift.mode === CREATE ? 1 : withTiming(1.03, { duration: motion.fast }) }]
    }
  })
  if (lift.mode === CREATE)
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, { width: colW - 3, backgroundColor: mix(t.accent, 18, t.bg), borderLeftColor: t.accent }, style]}
      >
        <Text style={[styles.ghost, { color: t.accent }]}>{label}</Text>
      </Animated.View>
    )
  const e = lift.block!.item
  const color = colorOf(e)
  const c = eventColors(t, color)
  return (
    <Animated.View
      testID="drag-preview"
      pointerEvents="none"
      style={[styles.overlay, styles.lifted, { width: lift.block!.rect.w, backgroundColor: mix(color, 28, t.bg), borderLeftColor: color }, style]}
    >
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {e.title || 'Untitled'}
      </Text>
      <Text style={[styles.metaBold, { color: c.text }]}>{label}</Text>
    </Animated.View>
  )
}

/** Day / 3-day / week time grid: swipe pages horizontally, one shared vertical scroll, long-press to move/resize/create. */
export function TimeGrid({ view, date, events: shown, accounts, calendars, loaded }: ViewProps): React.JSX.Element {
  const t = useTheme()
  const reduced = useReducedMotion()
  const { width, height } = useWindowDimensions()
  const bodyW = width - grid.gutter
  const now = useNow()
  const { events, moveTo } = useGridEvents(view, date, calendars, shown)

  const colorOf = useMemo<ColorOf>(() => {
    const cal = new Map(calendars.map((c) => [`${c.accountId}/${c.id}`, c.color]))
    const acc = new Map(accounts.map((a) => [a.id, a.color]))
    return (e) => cal.get(`${e.accountId}/${e.calendarId}`) ?? acc.get(e.accountId) ?? '#6272a4'
  }, [accounts, calendars])
  const canDrag = useCallback(
    (e: CalEvent) =>
      canEdit(
        e,
        accounts.find((a) => a.id === e.accountId),
        calendars.find((c) => c.accountId === e.accountId && c.id === e.calendarId)
      ),
    [accounts, calendars]
  )

  // Pages sit at absolute slots idx-1, idx, idx+1; a swipe springs `pos` to the neighbour and only then moves
  // nav + idx together, so the page on screen keeps its key and nothing re-mounts or jumps. An external date
  // change (Today, view switch) keeps idx and swaps the content in place.
  const idx = useRef(0)
  const pages = useMemo(
    () => ([-1, 0, 1] as const).map((o) => ({ k: idx.current + o, days: viewDays(view, o ? shiftDate(view, date, o) : date) })),
    // idx changes only together with `date`
    [view, date]
  )
  const n = pages[1].days.length
  const colW = bodyW / n
  const blocks = useMemo(
    () => pages.map((p) => pageBlocks(events, p.days, colW, H, grid.minEventMin, canDrag)),
    [pages, events, colW, canDrag]
  )

  const pos = useSharedValue(0)
  const from = useSharedValue(0)
  // idx mirrored on the UI thread: a swipe never lands more than one page from the rendered pages.
  const home = useSharedValue(0)
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: -pos.value * bodyW }] }))
  const stripAt = { marginLeft: (idx.current - 1) * bodyW }

  // Drag state: UI-thread values for the per-frame path, JS state only on lift/drop.
  const rects = useSharedValue<Rect[]>([])
  useEffect(() => {
    rects.value = blocks[1].map((b) => b.rect)
  }, [blocks, rects])
  const mode = useSharedValue(NONE)
  const anchor = useSharedValue(0)
  // The lifted block's own span, copied at lift: a reload mid-drag may reorder `rects`.
  const aDay = useSharedValue(0)
  const aStart = useSharedValue(0)
  const aEnd = useSharedValue(0)
  const oDay = useSharedValue(0)
  const oStart = useSharedValue(0)
  const oEnd = useSharedValue(0)
  const live = useSharedValue(0)
  const [lift, setLift] = useState<Lift | null>(null)
  const setLabel = useRef<((s: string) => void) | null>(null)
  const initialLabel = useRef('')
  const colWRef = useRef(colW)
  colWRef.current = colW

  // Latest render's values for the JS callbacks the worklets schedule (they're created once per geometry).
  const latest = useRef({ pages, blocks, moveTo, lift })
  latest.current = { pages, blocks, moveTo, lift }

  const commitMove = useCallback((b: Block, day: number, start: number, end: number): void => {
    if (day === b.day && start === b.start && end === b.end) return
    const d = latest.current.pages[1].days[day]
    latest.current.moveTo(b.item, atMinute(d, start).toISOString(), atMinute(d, end).toISOString())
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const js = useMemo(
    () => ({
      paged(target: number): void {
        const dir = target - idx.current
        if (!dir) return
        const { view: v, date: d0 } = nav.get()
        let d = d0
        for (let i = 0; i < Math.abs(dir); i++) d = shiftDate(v, d, dir > 0 ? 1 : -1)
        idx.current = target
        home.value = target
        void Haptics.selectionAsync()
        nav.set({ date: d })
      },
      tap(x: number, y: number): void {
        const cur = latest.current.blocks[1]
        const k = hitTest(
          cur.map((b) => b.rect),
          x,
          y
        )
        if (k >= 0) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          sheets.openEvent(cur[k].item)
          return
        }
        const days = latest.current.pages[1].days
        const d = days[dayAt(x, colWRef.current, days.length)]
        const m = slotOf(minOf(y, H))
        sheets.openEditor({ start: atMinute(d, m).toISOString(), end: atMinute(d, Math.min(1440, m + 60)).toISOString(), allDay: false })
      },
      lifted(m: Mode, k: number, start: number, end: number): void {
        setLift({ mode: m, block: k >= 0 ? latest.current.blocks[1][k] : null })
        initialLabel.current = `${fmt(start)} – ${fmt(end)}`
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      },
      step(start: number, end: number): void {
        setLabel.current?.(`${fmt(start)} – ${fmt(end)}`)
        void Haptics.selectionAsync()
      },
      dropped(ok: boolean, day: number, start: number, end: number): void {
        const l = latest.current.lift
        setLift(null)
        if (!ok || !l) return
        if (l.block) return commitMove(l.block, day, start, end)
        // A long-press without dragging asks for the default one-hour slot.
        const e = end - start === STEP ? Math.min(1440, start + 60) : end
        const d = latest.current.pages[1].days[day]
        sheets.openEditor({ start: atMinute(d, start).toISOString(), end: atMinute(d, e).toISOString(), allDay: false })
      }
    }),
    [commitMove, home]
  )
  const pagePan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onStart(() => {
          cancelAnimation(pos)
          from.value = pos.value
        })
        .onUpdate((e) => {
          pos.value = from.value - e.translationX / bodyW
        })
        .onEnd((e) => {
          const base = Math.round(from.value)
          const target = Math.max(home.value - 1, Math.min(home.value + 1, base + pageTarget((base - pos.value) * bodyW, e.velocityX, bodyW)))
          const done = (finished?: boolean): void => {
            if (finished) scheduleOnRN(js.paged, target)
          }
          pos.value = reduced
            ? withTiming(target, { duration: motion.fast }, done)
            : withSpring(target, { ...motion.spring, velocity: -e.velocityX / bodyW, overshootClamping: true }, done)
        }),
    [bodyW, reduced, js, pos, from, home]
  )

  const bodyGesture = useMemo(() => {
    const drag = Gesture.Pan()
      .activateAfterLongPress(350)
      .onStart((e) => {
        const k = hitTest(rects.value, e.x, e.y)
        live.value = 0
        if (k >= 0) {
          const r = rects.value[k]
          if (!r.drag) return
          mode.value = e.y > r.y + r.h - Math.min(HANDLE_PX, r.h / 3) ? RESIZE : MOVE
          aDay.value = r.day
          aStart.value = r.start
          aEnd.value = r.end
          oDay.value = r.day
          oStart.value = r.start
          oEnd.value = r.end
        } else {
          const a = slotOf(minOf(e.y, H))
          mode.value = CREATE
          anchor.value = a
          oDay.value = dayAt(e.x, colW, n)
          oStart.value = a
          oEnd.value = a + STEP
        }
        scheduleOnRN(js.lifted, mode.value as Mode, k, oStart.value, oEnd.value)
      })
      .onUpdate((e) => {
        let d = oDay.value
        let s = oStart.value
        let en = oEnd.value
        if (mode.value === MOVE) {
          const m = moveRange(aStart.value, aEnd.value, minOf(e.translationY, H))
          d = dayShift(aDay.value, e.translationX, colW, n)
          s = m.start
          en = m.end
        } else if (mode.value === RESIZE) {
          en = resizeEnd(aStart.value, minOf(e.y, H))
        } else if (mode.value === CREATE) {
          const sp = spanOf(anchor.value, slotOf(minOf(e.y, H)))
          s = sp.start
          en = sp.end
        } else return
        if (d === oDay.value && s === oStart.value && en === oEnd.value) return
        live.value = 1
        oDay.value = d
        oStart.value = s
        oEnd.value = en
        scheduleOnRN(js.step, s, en)
      })
      .onFinalize((_, ok) => {
        if (mode.value === NONE) return
        mode.value = NONE
        scheduleOnRN(js.dropped, ok, oDay.value, oStart.value, oEnd.value)
      })
    const tap = Gesture.Tap()
      .maxDuration(350)
      .onEnd((e, ok) => {
        if (ok) scheduleOnRN(js.tap, e.x, e.y)
      })
    return Gesture.Exclusive(drag, tap)
  }, [colW, n, js, rects, mode, anchor, aDay, aStart, aEnd, oDay, oStart, oEnd, live])

  // Opens on a whole hour: now about a third down when today is shown, else 08:00; later the user's scroll is kept.
  const [initialY] = useState(() =>
    initialScroll(
      pages[1].days.some((d) => isToday(d)),
      new Date(),
      height - 220,
      H
    )
  )

  // Dev-only: run a drop through the same commit path as the gesture (touch injection doesn't reach the simulator).
  useEffect(() => {
    const g = (globalThis as { __e2e?: Record<string, unknown> }).__e2e
    if (!__DEV__ || !g) return
    g.timegridDrop = (id: string, delta: number, dayDelta = 0) => {
      const b = latest.current.blocks[1].find((x) => x.item.id === id)
      if (!b) throw new Error(`no block ${id} on the current page`)
      if (!b.rect.drag) throw new Error(`${id} is read-only`)
      const m = moveRange(b.start, b.end, delta)
      const day = Math.max(0, Math.min(latest.current.pages[1].days.length - 1, b.day + dayDelta))
      commitMove(b, day, m.start, m.end)
      return { day, ...m }
    }
    return () => void delete g.timegridDrop
  }, [commitMove])

  const showsToday = pages[1].days.some((d) => isToday(d))
  const nowD = new Date(now)
  const liftedKey = lift?.block ? keyOf(lift.block.item) : undefined

  return (
    <GestureDetector gesture={pagePan}>
      <View style={[styles.wrap, { backgroundColor: t.bg, borderTopColor: t.line }]}>
        <View style={[styles.head, { borderBottomColor: t.lineStrong }]}>
          <View style={styles.gutterHead}>
            <Text style={[styles.alldayLabel, { color: t.muted }]}>all-day</Text>
          </View>
          <View style={[styles.clip, { width: bodyW }]}>
            <Animated.View style={[styles.row, stripAt, strip]}>
              {pages.map((p) => (
                <HeadPage key={p.k} days={p.days} events={events} colW={colW} t={t} colorOf={colorOf} now={now} />
              ))}
            </Animated.View>
          </View>
        </View>
        <ScrollView
          style={styles.flex}
          scrollEnabled={!lift}
          contentOffset={{ x: 0, y: initialY }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.row}>
            <Gutter t={t} nowMin={showsToday ? nowD.getHours() * 60 + nowD.getMinutes() : null} />
            <GestureDetector gesture={bodyGesture}>
              <View style={[styles.clip, { width: bodyW, height: DAY_PX }]}>
                <Lines n={n} colW={colW} t={t} />
                <Animated.View style={[styles.row, stripAt, strip]}>
                  {pages.map((p, i) => (
                    <BodyPage
                      key={p.k}
                      days={p.days}
                      blocks={blocks[i]}
                      colW={colW}
                      t={t}
                      colorOf={colorOf}
                      now={now}
                      loaded={loaded}
                      lifted={i === 1 ? liftedKey : undefined}
                    />
                  ))}
                </Animated.View>
                {lift && (
                  <DragOverlay
                    lift={lift}
                    t={t}
                    colorOf={colorOf}
                    colW={colW}
                    day={oDay}
                    start={oStart}
                    end={oEnd}
                    live={live}
                    reduced={reduced}
                    setLabel={setLabel}
                    initial={initialLabel.current}
                  />
                )}
              </View>
            </GestureDetector>
          </View>
        </ScrollView>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  head: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 1 },
  gutterHead: { width: grid.gutter, justifyContent: 'flex-end', paddingBottom: 9, paddingRight: 6 },
  alldayLabel: { fontFamily: fonts.mono, fontSize: 9, textAlign: 'right' },
  clip: { overflow: 'hidden' },
  hline: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  vline: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  hour: { position: 'absolute', right: 6, fontFamily: fonts.mono, fontSize: 10, lineHeight: 12 },
  hidden: { opacity: 0 },
  clock: {
    position: 'absolute',
    right: 3,
    paddingHorizontal: 3,
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    borderRadius: 3,
    overflow: 'hidden'
  },
  overlay: { position: 'absolute', zIndex: 5, borderLeftWidth: 2, paddingTop: 3, paddingBottom: 3, paddingLeft: 6, paddingRight: 4, overflow: 'hidden' },
  lifted: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 9, shadowOffset: { width: 0, height: 6 } },
  ghost: { fontFamily: fonts.mono, fontSize: 10.5, fontWeight: '600', lineHeight: 15 },
  title: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  metaBold: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, fontWeight: '700' }
})
