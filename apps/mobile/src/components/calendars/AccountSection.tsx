import { memo, useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import type { Calendar } from '@mysticals/core/shared/types'
import { errorText } from '@mysticals/core/logic/editor'
import { api } from '../../api'
import { setCalendarVisible } from '../../hooks/useCalendarData'
import { toast } from '../../state/bus'
import { fonts, mix, motion, radius, space, useTheme } from '../../theme'
import type { AccountSection as Section } from './sections'
import { SkeletonRows } from './Skeleton'

const retry = (accountId: string): void => {
  void api.sync.now(accountId).catch((e) => toast({ text: errorText(e), error: true }))
}

/** Desktop Sidebar account block: collapsible header (colour, label, email), sync state, calendar toggles. */
export const AccountSection = memo(function AccountSection({
  section: { account: a, calendars, loading },
  open,
  onToggle
}: {
  section: Section
  open: boolean
  onToggle: (id: string) => void
}): React.JSX.Element {
  const t = useTheme()
  const reduced = useReducedMotion()
  const turn = useSharedValue(open ? 90 : 0)
  useEffect(() => {
    turn.value = withTiming(open ? 90 : 0, { duration: reduced ? 0 : motion.fast })
  }, [open, reduced, turn])
  const arrow = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  return (
    <View style={styles.section} testID={`calendars-account-${a.id}`}>
      <Pressable
        onPress={() => onToggle(a.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.head, pressed && { backgroundColor: t.hover }]}
      >
        <Animated.Text style={[styles.arrow, { color: t.muted }, arrow]}>›</Animated.Text>
        <View style={[styles.dot, { backgroundColor: a.color }]} />
        <Text style={[styles.label, { color: t.muted }]} numberOfLines={1}>
          {a.label}
        </Text>
        {a.syncing && <ActivityIndicator size="small" color={t.accent} style={styles.spin} />}
        <Text style={[styles.email, { color: mix(t.muted, 70, t.fg) }]} numberOfLines={1}>
          {a.email}
        </Text>
      </Pressable>
      {a.error && (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={[styles.errorText, { color: t.red }]} numberOfLines={3}>
            {a.error}
          </Text>
          <Pressable hitSlop={10} onPress={() => retry(a.id)} accessibilityRole="button">
            <Text style={[styles.retry, { color: t.accent }]}>Retry</Text>
          </Pressable>
        </View>
      )}
      {open && (
        <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.fast)}>
          {loading && <SkeletonRows text="Loading calendars…" />}
          {calendars.map((c) => (
            <CalendarRow key={c.id} calendar={c} />
          ))}
        </Animated.View>
      )}
    </View>
  )
})

const CalendarRow = memo(function CalendarRow({ calendar: c }: { calendar: Calendar }): React.JSX.Element {
  const t = useTheme()
  const on = c.visible !== false
  return (
    <Pressable
      testID={`calendars-calendar-${c.accountId}-${c.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={c.name}
      onPress={() => {
        void Haptics.selectionAsync()
        setCalendarVisible(c.accountId, c.id, !on)
      }}
      style={({ pressed }) => [styles.cal, pressed && { backgroundColor: t.hover }]}
    >
      <View style={[styles.box, { borderColor: c.color, backgroundColor: on ? c.color : 'transparent' }]}>
        {on && <Text style={[styles.check, { color: t.bg }]}>✓</Text>}
      </View>
      <Text style={[styles.name, { color: on ? t.fg : t.muted }]} numberOfLines={1}>
        {c.name}
      </Text>
      {c.readOnly && <Text style={[styles.ro, { color: t.muted }]}>read-only</Text>}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  section: { gap: 2 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.sm
  },
  arrow: { width: 10, fontSize: 16, lineHeight: 18, textAlign: 'center' },
  dot: { width: 8, height: 8, borderRadius: 2 },
  label: { flex: 1, fontFamily: fonts.mono, fontSize: fonts.size.sm, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  spin: { transform: [{ scale: 0.7 }], height: 16 },
  email: { width: '100%', paddingLeft: 10 + 8 + space.sm * 2, fontFamily: fonts.mono, fontSize: fonts.size.sm - 1, marginTop: 2 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingLeft: 10 + 8 + space.sm * 3, paddingRight: space.sm, paddingVertical: space.xs },
  errorText: { flex: 1, fontFamily: fonts.mono, fontSize: fonts.size.sm - 1, lineHeight: 16 },
  retry: { fontFamily: fonts.mono, fontSize: fonts.size.sm - 1, lineHeight: 16 },
  cal: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, paddingLeft: 10 + space.sm * 2, paddingRight: space.sm, borderRadius: radius.sm },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  name: { flex: 1, fontSize: fonts.size.md },
  ro: { fontFamily: fonts.mono, fontSize: fonts.size.xs }
})
