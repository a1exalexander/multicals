import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { addDays } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { viewRange, ymd } from '@mysticals/core/logic/layout'
import { pendingInvites } from '@mysticals/core/logic/details'
import { visibleEvents } from '@mysticals/core/logic/visible'
import type { CalEvent } from '@mysticals/core/shared/types'
import { Header } from '../components/Header'
import { StatusLine } from '../components/StatusLine'
import { showsToday } from '../components/shell'
import { useCalendarData } from '../hooks/useCalendarData'
import { nav, useNav } from '../state/nav'
import { sheets } from '../state/sheets'
import { fonts, motion, radius, space, useTheme } from '../theme'
import { MonthGrid } from '../views/MonthGrid'
import { TimeGrid } from '../views/TimeGrid'

/** Ticks once a minute so "now/next" and the Today button stay current. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Calendar screen: header, the current view, status line, Today + new-event buttons; onboarding prompt with no accounts. */
export default function CalendarScreen(): React.JSX.Element {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { view, date } = useNav()
  const now = useNow()
  const [expanded, setExpanded] = useState(false)
  const [forceEmpty, setForceEmpty] = useState(false)

  const range = useMemo(() => viewRange(view, date), [view, date])
  const { accounts, calendars, events, loaded } = useCalendarData(range)
  const shown = useMemo(() => visibleEvents(events, calendars), [events, calendars])
  const props = { view, date, events: shown, accounts, calendars, loaded }

  // Invites and now/next look ahead independently of the shown period (desktop: next 60 days / 24h).
  const today = ymd(now)
  const ahead = useMemo(() => {
    const d = new Date(`${today}T00:00:00`) // local midnight
    return { start: d.toISOString(), end: addDays(d, 60).toISOString() }
  }, [today])
  const upcoming = useCalendarData(ahead)
  const soon = useMemo(() => (upcoming.loaded ? visibleEvents(upcoming.events, upcoming.calendars) : []), [upcoming])
  const invites = useMemo(() => pendingInvites(soon, now).length, [soon, now])
  const colorOf = useMemo(() => {
    const cal = new Map(calendars.map((c) => [`${c.accountId}/${c.id}`, c.color]))
    const acc = new Map(accounts.map((a) => [a.id, a.color]))
    return (e: CalEvent): string => cal.get(`${e.accountId}/${e.calendarId}`) ?? acc.get(e.accountId) ?? t.muted
  }, [accounts, calendars, t.muted])

  useEffect(() => {
    if (!__DEV__) return
    const g = globalThis as { __e2e?: Record<string, unknown> }
    if (g.__e2e) g.__e2e.shell = { expand: setExpanded, empty: setForceEmpty }
  }, [])

  const empty = forceEmpty || (loaded && accounts.length === 0)
  const kind = view === 'month' ? 'month' : 'time'

  return (
    <View style={[styles.wrap, { paddingTop: insets.top, backgroundColor: t.bg }]}>
      <Header view={view} date={date} invites={empty ? 0 : invites} expanded={expanded} onExpand={setExpanded} />
      <View style={[styles.body, { borderTopColor: t.line }]}>
        {empty ? (
          <Animated.View entering={FadeIn.duration(motion.normal)} style={styles.empty} testID="empty-state">
            <Text style={[styles.prompt, { color: t.muted }]}>
              <Text style={{ color: t.accent }}>~ $</Text> mysticals --accounts
            </Text>
            <Text style={[styles.emptyTitle, { color: t.fg }]}>No calendars yet</Text>
            <Text style={[styles.emptyText, { color: t.muted }]}>Add a Google or CalDAV account to see your events here.</Text>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                sheets.openAddAccount()
              }}
              style={({ pressed }) => [styles.addBtn, { backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              testID="empty-add-account"
            >
              <Text style={[styles.addText, { color: t.onAccent }]}>+ add account</Text>
            </Pressable>
          </Animated.View>
        ) : (
          // Keyed by grid kind only: day/3day/week reuse one TimeGrid (keeps scroll), month cross-fades in.
          <Animated.View
            key={kind}
            entering={FadeIn.duration(motion.normal)}
            exiting={FadeOut.duration(motion.fast)}
            style={StyleSheet.absoluteFill}
          >
            {kind === 'month' ? <MonthGrid {...props} /> : <TimeGrid {...props} />}
          </Animated.View>
        )}
        {!empty && !showsToday(view, date, now) && (
          <Animated.View entering={FadeInDown.duration(motion.normal)} exiting={FadeOutDown.duration(motion.fast)} style={styles.todayWrap}>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                nav.set({ date: new Date() })
              }}
              style={({ pressed }) => [styles.today, { backgroundColor: t.surface2, borderColor: t.lineStrong, opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
              testID="today"
            >
              <Text style={[styles.todayText, { color: t.fg }]}>today</Text>
            </Pressable>
          </Animated.View>
        )}
        {!empty && (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              sheets.openEditor()
            }}
            style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            accessibilityRole="button"
            accessibilityLabel="New event"
            testID="new-event"
          >
            <Text style={[styles.fabText, { color: t.onAccent }]}>+</Text>
          </Pressable>
        )}
      </View>
      <View style={{ paddingBottom: insets.bottom }}>
        {!empty && <StatusLine events={soon} accounts={accounts} colorOf={colorOf} now={now} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { flex: 1, marginTop: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  prompt: { fontFamily: fonts.mono, fontSize: fonts.size.sm, marginBottom: space.sm },
  emptyTitle: { fontSize: fonts.size.xl, fontWeight: '700' },
  emptyText: { fontSize: fonts.size.md, textAlign: 'center', lineHeight: 21, marginBottom: space.md },
  addBtn: { height: 44, paddingHorizontal: space.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.mono, fontSize: fonts.size.md, fontWeight: '700' },
  todayWrap: { position: 'absolute', bottom: space.lg, alignSelf: 'center' },
  today: { height: 36, paddingHorizontal: space.lg, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  todayText: { fontFamily: fonts.mono, fontSize: fonts.size.sm },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
  },
  fabText: { fontSize: 30, lineHeight: 32, fontWeight: '400' }
})
