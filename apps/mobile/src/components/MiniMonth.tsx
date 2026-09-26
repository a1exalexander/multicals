import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { addMonths, format, isSameDay, isSameMonth, isToday, startOfMonth } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { monthGrid } from '@mysticals/core/logic/layout'
import { fonts, mix, radius, space, useTheme } from '../theme'

const CELL = 36
/** Full height of the picker, so the header can animate to it without measuring. */
export const MINI_HEIGHT = 40 + 20 + CELL * 6 + space.md

/** Month picker under the title (desktop sidebar MiniMonth); picking a day hands it to `onPick`. */
export function MiniMonth({ date, onPick }: { date: Date; onPick: (d: Date) => void }): React.JSX.Element {
  const t = useTheme()
  const [shown, setShown] = useState(() => startOfMonth(date))
  const monthKey = startOfMonth(date).getTime()
  useEffect(() => setShown(new Date(monthKey)), [monthKey])
  const days = monthGrid(shown)
  const step = (n: number) => () => {
    void Haptics.selectionAsync()
    setShown(addMonths(shown, n))
  }

  return (
    <View style={styles.wrap} testID="mini-month">
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.fg }]}>{format(shown, 'MMMM yyyy')}</Text>
        {(
          [
            ['‹', -1, 'Previous month'],
            ['›', 1, 'Next month']
          ] as const
        ).map(([g, n, label]) => (
          <Pressable key={g} onPress={step(n)} hitSlop={6} accessibilityLabel={label} style={styles.arrow}>
            <Text style={[styles.arrowText, { color: t.muted }]}>{g}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {days.slice(0, 7).map((d) => (
          <Text key={`h${d.getTime()}`} style={[styles.dow, { color: t.muted }]}>
            {format(d, 'EEEEE')}
          </Text>
        ))}
        {days.map((d) => {
          const today = isToday(d)
          const selected = isSameDay(d, date)
          const bg = selected ? (today ? t.today : mix(t.accent, 18, t.bg)) : 'transparent'
          const color = selected && today ? t.onAccent : today ? t.today : isSameMonth(d, shown) ? t.fg : t.faint
          return (
            <Pressable
              key={d.getTime()}
              style={styles.cell}
              onPress={() => onPick(d)}
              accessibilityLabel={format(d, 'EEEE d MMMM')}
              accessibilityState={{ selected }}
            >
              <View style={[styles.day, { backgroundColor: bg }]}>
                <Text style={[styles.dayText, { color, fontWeight: today ? '700' : '400' }]}>{format(d, 'd')}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: MINI_HEIGHT, paddingHorizontal: space.md },
  head: { height: 40, flexDirection: 'row', alignItems: 'center', paddingLeft: space.xs },
  title: { flex: 1, fontFamily: fonts.mono, fontSize: fonts.size.sm, fontWeight: '700' },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: fonts.mono, fontSize: fonts.size.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, height: 20, textAlign: 'center', fontFamily: fonts.mono, fontSize: fonts.size.xs },
  cell: { width: `${100 / 7}%`, height: CELL, alignItems: 'center', justifyContent: 'center' },
  day: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fonts.mono, fontSize: fonts.size.sm }
})
