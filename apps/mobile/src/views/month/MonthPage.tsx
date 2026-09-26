import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { format, isSameMonth, isToday } from 'date-fns'
import { eventsOnDay, isPast, monthGrid } from '@mysticals/core/logic/layout'
import type { CalEvent } from '@mysticals/core/shared/types'
import { eventColors, fonts, mix, radius, type Theme } from '../../theme'
import { CELL, fitChips, fromMonthIndex } from './math'

export type ColorOf = (e: CalEvent) => string
export const keyOf = (e: CalEvent): string => `${e.accountId}/${e.id}`

/** The 42 days of a month page and the events on each (desktop MonthGrid). */
export function pageDays(month: number, events: CalEvent[]): { days: Date[]; lists: CalEvent[][] } {
  const days = monthGrid(fromMonthIndex(month))
  return { days, lists: days.map((d) => eventsOnDay(events, d)) }
}

interface ChipProps {
  e: CalEvent
  color: string
  t: Theme
  now: number
  dragged?: boolean
}

/** Compact event chip: timed = coloured dot + title, all-day = tinted bar (desktop .mg-ev). */
export const Chip = memo(function Chip({ e, color, t, now, dragged }: ChipProps): React.JSX.Element {
  const c = eventColors(t, color)
  const pending = e.myStatus === 'needsAction'
  const declined = e.myStatus === 'declined'
  const tinted = e.allDay || pending
  const opacity = dragged ? 0.35 : declined ? 0.45 : isPast(e, now) ? 0.55 : 1
  return (
    <View
      style={[
        styles.chip,
        { opacity },
        tinted && { backgroundColor: c.bg },
        pending && { borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' }
      ]}
    >
      {!e.allDay && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[styles.title, { color: tinted ? c.text : t.fg }, declined && styles.declined]}
      >
        {e.title || 'Untitled'}
      </Text>
    </View>
  )
})

interface CellProps {
  day: Date
  col: number
  other: boolean
  today: boolean
  list: CalEvent[]
  rows: number
  w: number
  h: number
  drop: boolean
  dragKey: string | null
  loaded: boolean
  skeleton: number
  t: Theme
  colorOf: ColorOf
  now: number
}

const Cell = memo(function Cell(p: CellProps): React.JSX.Element {
  const { t } = p
  const { shown, more } = fitChips(p.list.length, p.rows)
  const n = p.day.getDate()
  return (
    <View
      style={[
        styles.cell,
        { width: p.w, height: p.h, borderColor: t.line, borderRightWidth: p.col === 6 ? 0 : StyleSheet.hairlineWidth },
        p.col >= 5 && { backgroundColor: mix(t.surface, 60, t.bg) }
      ]}
    >
      {/* Drop target as an overlay so the cell's content never shifts. */}
      {p.drop && <View pointerEvents="none" style={[styles.drop, { backgroundColor: `${t.accent}14`, borderColor: `${t.accent}73` }]} />}
      <View style={styles.numRow}>
        <View style={[styles.num, p.today && { backgroundColor: t.today }]}>
          <Text
            style={[
              styles.numText,
              { color: p.today ? t.onAccent : p.other ? t.faint : t.fg },
              p.today && styles.bold
            ]}
          >
            {n === 1 ? format(p.day, 'd MMM') : n}
          </Text>
        </View>
      </View>
      {p.loaded
        ? p.list.slice(0, shown).map((e) => (
            <Chip key={keyOf(e)} e={e} color={p.colorOf(e)} t={t} now={p.now} dragged={p.dragKey === keyOf(e)} />
          ))
        : Array.from({ length: p.skeleton }, (_, i) => (
            <View key={i} style={[styles.bone, { backgroundColor: t.surface2, width: `${90 - i * 25}%` }]} />
          ))}
      {more > 0 && p.loaded && <Text style={[styles.more, { color: t.muted }]}>+{more}</Text>}
    </View>
  )
})

interface PageProps {
  month: number
  days: Date[]
  lists: CalEvent[][]
  w: number
  h: number
  rows: number
  /** Cell under a dragged chip (current page only), else -1. */
  over: number
  dragKey: string | null
  loaded: boolean
  t: Theme
  colorOf: ColorOf
  now: number
}

/** One month page: 7x6 cells. Memoized so paging to a neighbour doesn't re-render pages that stay mounted. */
export const MonthPage = memo(function MonthPage(p: PageProps): React.JSX.Element {
  const ref = fromMonthIndex(p.month)
  const cw = p.w / 7
  const ch = p.h / 6
  return (
    <View style={[styles.page, { width: p.w, height: p.h }]}>
      {p.days.map((d, i) => {
        const list = p.lists[i]
        return (
          <Cell
            key={d.getTime()}
            day={d}
            col={i % 7}
            other={!isSameMonth(d, ref)}
            today={isToday(d)}
            list={list}
            rows={p.rows}
            w={cw}
            h={ch}
            drop={p.over === i}
            // Only cells holding the dragged event see the key, so starting a drag re-renders just them.
            dragKey={p.dragKey && list.some((e) => keyOf(e) === p.dragKey) ? p.dragKey : null}
            loaded={p.loaded}
            skeleton={(i * 5) % 3}
            t={p.t}
            colorOf={p.colorOf}
            now={p.now}
          />
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  page: { position: 'absolute', top: 0, flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    overflow: 'hidden',
    paddingHorizontal: CELL.pad,
    paddingTop: CELL.pad,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  drop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1 },
  numRow: { height: CELL.num, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start' },
  num: { minWidth: 20, height: 18, paddingHorizontal: 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.mono, fontSize: 11 },
  bold: { fontWeight: '700' },
  chip: {
    height: CELL.chip,
    marginBottom: CELL.gap,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderRadius: 2
  },
  dot: { width: 5, height: 5, borderRadius: 1.5, marginRight: 3 },
  title: { flex: 1, fontSize: 10.5, fontWeight: '500' },
  declined: { textDecorationLine: 'line-through' },
  more: { height: CELL.chip, lineHeight: CELL.chip, paddingHorizontal: 3, fontFamily: fonts.mono, fontSize: 10 },
  bone: { height: 7, borderRadius: 2, marginTop: 4, marginHorizontal: 3 }
})
