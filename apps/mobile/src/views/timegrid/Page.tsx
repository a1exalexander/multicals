import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { addDays, format, isToday } from 'date-fns'
import { eventBounds, eventsOnDay, isPast, ymd } from '@mysticals/core/logic/layout'
import { place } from '@mysticals/core/logic/meeting'
import type { CalEvent } from '@mysticals/core/shared/types'
import { nav } from '../../state/nav'
import { sheets } from '../../state/sheets'
import { eventColors, fonts, grid, mix, type Theme } from '../../theme'
import type { Block } from './logic'
import { keyOf } from './logic'
import { pxOf } from './math'

export type ColorOf = (e: CalEvent) => string

const H = grid.hourHeight
const hhmm = (d: Date): string => format(d, 'HH:mm')

/** Desktop `.ev` look: 15% tint, 60% text, 2px left border, square corners; pending dashed orange, declined struck, past dimmed. */
function evLook(t: Theme, e: CalEvent, color: string, past: boolean): { box: object; title: object } {
  const c = eventColors(t, color)
  const declined = e.myStatus === 'declined'
  const pending = e.myStatus === 'needsAction'
  const opacity = past && declined ? 0.4 : declined ? 0.45 : past ? 0.55 : 1
  // ponytail: desktop's diagonal stripes on pending invites are left out (no gradients in core RN).
  const box = pending
    ? { backgroundColor: mix(color, 7, t.bg), borderWidth: 1, borderStyle: 'dashed', borderColor: t.orange, opacity }
    : { backgroundColor: c.bg, borderLeftWidth: 2, borderLeftColor: c.border, opacity }
  return { box, title: { color: c.text, textDecorationLine: declined ? 'line-through' : 'none' } }
}

const EventBlock = memo(function EventBlock({ b, t, color, now, dim }: { b: Block; t: Theme; color: string; now: number; dim: boolean }) {
  const e = b.item
  const { box, title } = evLook(t, e, color, isPast(e, now))
  const short = b.rect.h < 34
  const meta = `${hhmm(eventBounds(e).start)}${e.location ? ` · ${place(e.location)}` : ''}`
  return (
    <View
      testID="event-block"
      // Taps go through the grid's gesture hit-test; VoiceOver activates the block directly.
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${e.title || 'Untitled'}, ${meta}`}
      onAccessibilityTap={() => sheets.openEvent(e)}
      style={[
        styles.ev,
        short && styles.evShort,
        box,
        { left: b.rect.x, top: b.rect.y, width: b.rect.w, height: b.rect.h },
        dim && { opacity: 0.35 }
      ]}
    >
      <Text style={[styles.title, title, short && styles.titleShort]} numberOfLines={short ? 1 : Math.max(1, Math.floor((b.rect.h - 20) / 14))}>
        {e.title || 'Untitled'}
      </Text>
      <Text style={[styles.meta, { color: (title as { color: string }).color }, short && styles.metaShort]} numberOfLines={1}>
        {meta}
      </Text>
    </View>
  )
})

interface BodyProps {
  days: Date[]
  blocks: Block[]
  colW: number
  t: Theme
  colorOf: ColorOf
  now: number
  loaded: boolean
  /** Key of the event currently lifted by a drag (drawn faded underneath the drag preview). */
  lifted?: string
}

/** One page of day columns: today tint, events, now-line. Hour/column lines are drawn once under all pages. */
export const BodyPage = memo(function BodyPage({ days, blocks, colW, t, colorOf, now, loaded, lifted }: BodyProps) {
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes()
  const todayIdx = days.findIndex((d) => isToday(d))
  return (
    <View style={{ width: colW * days.length, height: pxOf(1440, H) }}>
      {todayIdx >= 0 && <View style={[styles.fill, { left: todayIdx * colW, width: colW, backgroundColor: mix(t.today, 3, t.bg) }]} />}
      {loaded
        ? blocks.map((b) => <EventBlock key={`${keyOf(b.item)}@${b.day}`} b={b} t={t} color={colorOf(b.item)} now={now} dim={lifted === keyOf(b.item)} />)
        : days.map((_, i) =>
            // Subtle skeleton until the first load settles: never an "empty day" flash.
            [9, 13, 16].map((h, k) => (
              <View
                key={`${i}-${h}`}
                style={[styles.skel, { backgroundColor: t.surface2, left: i * colW + 1, width: colW - 3, top: pxOf((h + ((i + k) % 2)) * 60, H), height: H * (k === 1 ? 1.5 : 1) - 1 }]}
              />
            ))
          )}
      {todayIdx >= 0 &&
        days.map((_, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.now,
              { left: i * colW, width: colW, top: pxOf(nowMin, H) - 1, borderTopColor: t.today },
              i !== todayIdx && styles.nowFaint
            ]}
          >
            {i === todayIdx && <View style={[styles.nowDot, { backgroundColor: t.today }]} />}
          </View>
        ))}
    </View>
  )
})

interface HeadProps {
  days: Date[]
  events: CalEvent[]
  colW: number
  t: Theme
  colorOf: ColorOf
  now: number
}

/** One page of the sticky header: weekday + date per column, then the all-day row. */
export const HeadPage = memo(function HeadPage({ days, events, colW, t, colorOf, now }: HeadProps) {
  const multi = days.length > 1
  return (
    <View style={{ width: colW * days.length }}>
      <View style={styles.row}>
        {days.map((d) => {
          const today = isToday(d)
          return (
            <Pressable
              key={d.getTime()}
              disabled={!multi}
              onPress={() => nav.set({ view: 'day', date: d })}
              style={[styles.dayhead, { width: colW, borderLeftColor: t.line }, !multi && styles.dayheadSingle]}
            >
              <Text style={[styles.dow, { color: today ? t.today : t.muted }]}>{format(d, multi && colW < 60 ? 'EEEEE' : 'EEE')}</Text>
              <Text style={[styles.num, { color: today ? t.today : t.fg }, today && { backgroundColor: mix(t.today, 18, t.bg) }]}>{format(d, 'd')}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={[styles.row, styles.allday, { borderTopColor: t.line }]}>
        {days.map((d) => (
          <Pressable
            key={d.getTime()}
            onPress={() => sheets.openEditor({ start: ymd(d), end: ymd(addDays(d, 1)), allDay: true })}
            style={[styles.alldayCell, { width: colW, borderLeftColor: t.line }]}
          >
            {eventsOnDay(events, d)
              .filter((e) => e.allDay)
              .map((e) => {
                const { box, title } = evLook(t, e, colorOf(e), isPast(e, now))
                return (
                  <Pressable key={keyOf(e)} testID="event-block" onPress={() => sheets.openEvent(e)} style={[styles.chip, box]}>
                    <Text style={[styles.title, title]} numberOfLines={1}>
                      {e.title || 'Untitled'}
                    </Text>
                  </Pressable>
                )
              })}
          </Pressable>
        ))}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, bottom: 0 },
  ev: { position: 'absolute', overflow: 'hidden', paddingTop: 3, paddingBottom: 3, paddingLeft: 6, paddingRight: 4 },
  evShort: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 0, paddingBottom: 0 },
  title: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  titleShort: { flexShrink: 0, maxWidth: '100%' },
  meta: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, opacity: 0.8 },
  metaShort: { flex: 1, minWidth: 0 },
  skel: { position: 'absolute', opacity: 0.5 },
  now: { position: 'absolute', height: 0, borderTopWidth: 2 },
  nowFaint: { borderTopWidth: 1, opacity: 0.35 },
  nowDot: { position: 'absolute', left: -4, top: -5, width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row' },
  dayhead: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderLeftWidth: StyleSheet.hairlineWidth
  },
  dayheadSingle: { justifyContent: 'flex-start', paddingLeft: 12, gap: 6 },
  dow: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  num: {
    fontFamily: fonts.mono,
    fontWeight: '600',
    fontSize: 13,
    minWidth: 22,
    lineHeight: 22,
    paddingHorizontal: 3,
    textAlign: 'center',
    borderRadius: 4,
    overflow: 'hidden'
  },
  allday: { borderTopWidth: StyleSheet.hairlineWidth },
  alldayCell: { minHeight: 28, padding: 3, gap: 2, borderLeftWidth: StyleSheet.hairlineWidth },
  chip: { paddingVertical: 2, paddingHorizontal: 6 }
})
