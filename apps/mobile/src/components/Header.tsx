import { memo, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { type View as CalView } from '@mysticals/core/logic/layout'
import { nav } from '../state/nav'
import { sheets } from '../state/sheets'
import { fonts, mix, motion, radius, space, useTheme } from '../theme'
import { MINI_HEIGHT, MiniMonth } from './MiniMonth'
import { periodKey, titleParts } from './shell'

const VIEWS: CalView[] = ['day', '3day', 'week', 'month']
const LABEL: Record<CalView, string> = { day: 'Day', '3day': '3 Days', week: 'Week', month: 'Month' }

interface Props {
  view: CalView
  date: Date
  invites: number
  expanded: boolean
  onExpand: (open: boolean) => void
}

/** Calendar top bar: tappable title (drops the mini month), sheet buttons and the view switcher (time views draw their own day headers). */
export function Header({ view, date, invites, expanded, onExpand }: Props): React.JSX.Element {
  const t = useTheme()
  const { title, sub } = titleParts(view, date)
  const open = useSharedValue(expanded ? 1 : 0)
  useEffect(() => {
    open.value = withSpring(expanded ? 1 : 0, motion.spring)
  }, [expanded, open])
  const miniStyle = useAnimatedStyle(() => ({ height: open.value * MINI_HEIGHT, opacity: open.value }))
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(open.value, [0, 1], [0, 180])}deg` }] }))

  return (
    <View>
      <View style={styles.top}>
        <Pressable
          style={styles.titleBtn}
          onPress={() => {
            void Haptics.selectionAsync()
            onExpand(!expanded)
          }}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${expanded ? 'hide' : 'show'} month picker`}
          testID="header-title"
        >
          {/* Keyed by the period so stepping to the next one fades the new title in. */}
          <Animated.View key={periodKey(view, date)} entering={FadeIn.duration(motion.fast)} style={styles.titleRow}>
            <Text style={[styles.title, { color: t.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {title}
            </Text>
            <Animated.Text style={[styles.chevron, { color: t.muted }, chevron]}>⌄</Animated.Text>
          </Animated.View>
          <Text style={[styles.sub, { color: t.muted }]}>{sub}</Text>
        </Pressable>
        <IconBtn glyph={'✉︎'} label="Invites" badge={invites} onPress={sheets.openInvites} testID="btn-invites" />
        <IconBtn glyph="☰" label="Calendars" onPress={sheets.openCalendars} testID="btn-calendars" />
        <IconBtn glyph={'⚙︎'} label="Settings" onPress={sheets.openSettings} testID="btn-settings" />
      </View>
      <Animated.View style={[styles.mini, miniStyle]} pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded}>
        <MiniMonth
          date={date}
          onPick={(d) => {
            void Haptics.selectionAsync()
            nav.set({ date: d })
            onExpand(false)
          }}
        />
      </Animated.View>
      <ViewSwitch view={view} />
    </View>
  )
}

function IconBtn(p: { glyph: string; label: string; badge?: number; onPress: () => void; testID: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={p.onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.icon, pressed && { backgroundColor: t.hover }]}
      accessibilityRole="button"
      accessibilityLabel={p.badge ? `${p.label}, ${p.badge} pending` : p.label}
      testID={p.testID}
    >
      <Text style={[styles.iconText, { color: t.fg }]}>{p.glyph}</Text>
      {!!p.badge && (
        <Animated.View entering={FadeIn.duration(motion.fast)} style={[styles.badge, { backgroundColor: t.pink, borderColor: t.bg }]}>
          <Text style={[styles.badgeText, { color: t.onAccent }]}>{p.badge > 9 ? '9+' : p.badge}</Text>
        </Animated.View>
      )}
    </Pressable>
  )
}

/** Desktop's view tabs, sized for thumbs, with a sliding highlight. */
const ViewSwitch = memo(function ViewSwitch({ view }: { view: CalView }): React.JSX.Element {
  const t = useTheme()
  const [width, setWidth] = useState(0)
  const index = VIEWS.indexOf(view)
  const x = useSharedValue(0)
  const seg = width / VIEWS.length
  const laidOut = useRef(0)
  useEffect(() => {
    // A (re)layout jumps into place; view changes slide.
    x.value = laidOut.current === seg ? withSpring(index * seg, motion.snappy) : index * seg
    laidOut.current = seg
  }, [index, seg, x])
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View style={styles.seg} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg > 0 && <Animated.View style={[styles.segPill, { width: seg, backgroundColor: mix(t.accent, 12, t.bg) }, pill]} />}
      {VIEWS.map((v) => {
        const active = v === view
        return (
          <Pressable
            key={v}
            style={styles.segBtn}
            onPress={() => {
              if (active) return
              void Haptics.selectionAsync()
              nav.set({ view: v })
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            testID={`view-switch-${v}`}
          >
            <Text style={[styles.segText, { color: active ? t.accent : t.muted }]}>{LABEL[v]}</Text>
          </Pressable>
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, paddingRight: space.sm, paddingTop: space.sm, gap: 2 },
  titleBtn: { flex: 1, minWidth: 0, paddingVertical: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  title: { flexShrink: 1, fontSize: fonts.size.title, fontWeight: '700', letterSpacing: -0.4 },
  chevron: { fontSize: fonts.size.lg, marginTop: -8 },
  sub: { fontFamily: fonts.mono, fontSize: fonts.size.sm, marginTop: 2 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 19 },
  badge: {
    position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center'
  },
  badgeText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700' },
  mini: { overflow: 'hidden' },
  seg: { flexDirection: 'row', marginHorizontal: space.md, marginTop: space.sm, height: 36 },
  segPill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.sm },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.mono, fontSize: fonts.size.sm }
})
