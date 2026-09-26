import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { viewRange } from '@mysticals/core/logic/layout'
import { visibleEvents } from '@mysticals/core/logic/visible'
import { useCalendarData } from '../hooks/useCalendarData'
import { useNav } from '../state/nav'
import { sheets } from '../state/sheets'
import { fonts, space, useTheme } from '../theme'
import { MonthGrid } from '../views/MonthGrid'
import { TimeGrid } from '../views/TimeGrid'

/** Calendar screen. Stub header; replaced by the calendar-shell work unit. */
export default function CalendarScreen(): React.JSX.Element {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { view, date } = useNav()
  const range = useMemo(() => viewRange(view, date), [view, date])
  const { accounts, calendars, events, loaded } = useCalendarData(range)
  const shown = useMemo(() => visibleEvents(events, calendars), [events, calendars])
  const props = { view, date, events: shown, accounts, calendars, loaded }
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {(
          [
            ['calendars', sheets.openCalendars],
            ['invites', sheets.openInvites],
            ['settings', sheets.openSettings],
            ['+', () => sheets.openEditor()]
          ] as const
        ).map(([label, go]) => (
          <Pressable key={label} onPress={go} hitSlop={8}>
            <Text style={[styles.btn, { color: t.accent }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {view === 'month' ? <MonthGrid {...props} /> : <TimeGrid {...props} />}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: space.lg },
  btn: { fontFamily: fonts.mono, fontSize: fonts.size.sm }
})
