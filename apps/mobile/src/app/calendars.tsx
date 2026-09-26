import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { errorText } from '@mysticals/core/logic/editor'
import { api } from '../api'
import { AccountSection } from '../components/calendars/AccountSection'
import { SkeletonRows } from '../components/calendars/Skeleton'
import { accountSections } from '../components/calendars/sections'
import { setCalendarVisible, useCalendarData } from '../hooks/useCalendarData'
import { toast } from '../state/bus'
import { sheets } from '../state/sheets'
import { fonts, motion, radius, space, useTheme } from '../theme'

// Collapsed accounts survive closing and reopening the sheet (per app session).
// ponytail: not persisted across launches; store it like theme.ts if users ask.
let collapsed: string[] = []

/** Calendars sheet: the desktop sidebar's account sections, plus Add account and Settings. */
export default function CalendarsSheet(): React.JSX.Element {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { accounts, calendars, loaded } = useCalendarData()
  const sections = useMemo(() => accountSections(accounts, calendars), [accounts, calendars])
  const [closed, setClosed] = useState(collapsed)
  const [refreshing, setRefreshing] = useState(false)
  // Dev-only: scripts/e2e.mjs toggles calendars without taps.
  useEffect(() => {
    if (__DEV__) Object.assign((globalThis as { __e2e?: object }).__e2e ?? {}, { setCalendarVisible })
  }, [])

  const toggle = useCallback((id: string) => {
    setClosed((c) => (collapsed = c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }, [])

  const refresh = (): void => {
    setRefreshing(true)
    api.sync
      .now()
      .catch((e) => toast({ text: errorText(e), error: true }))
      .finally(() => setRefreshing(false))
  }

  return (
    <View style={styles.wrap} collapsable={false}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.muted} />}
      >
        <Text style={[styles.title, { color: t.muted }]}>Calendars</Text>
        {!loaded ? (
          <SkeletonRows widths={[60, 80, 45]} />
        ) : (
          sections.map((s) => (
            <Animated.View key={s.account.id} layout={LinearTransition.duration(motion.normal)}>
              <AccountSection section={s} open={!closed.includes(s.account.id)} onToggle={toggle} />
            </Animated.View>
          ))
        )}
        {loaded && !accounts.length && <Text style={[styles.empty, { color: t.muted }]}>No accounts yet</Text>}
      </ScrollView>
      <View collapsable={false} style={[styles.foot, { borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <FootButton label="＋ Add account" onPress={sheets.openAddAccount} grow />
        <FootButton label="⚙ Settings" onPress={sheets.openSettings} />
      </View>
    </View>
  )
}

function FootButton({ label, onPress, grow }: { label: string; onPress: () => void; grow?: boolean }): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, grow && styles.grow, { backgroundColor: pressed ? t.hover : t.surface2 }]}
    >
      <Text style={[styles.btnText, { color: t.fg }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  body: { padding: space.md, paddingTop: space.xl, gap: space.lg },
  title: { fontFamily: fonts.mono, fontSize: fonts.size.sm, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: space.sm },
  empty: { fontFamily: fonts.mono, fontSize: fonts.size.sm, paddingHorizontal: space.sm },
  foot: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { height: 44, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  btnText: { fontFamily: fonts.mono, fontSize: fonts.size.sm }
})
