// Building blocks shared by the add-account and settings sheets (desktop AccountsShared.tsx + Accounts.css look).
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SWATCHES, fonts, mix, radius, space, useTheme } from '../../theme'

/** Registers a dev-only handle on `globalThis.__e2e` so scripts/e2e.mjs can drive a sheet without taps. */
export function devHook(name: string, value: object): void {
  if (!__DEV__) return
  const g = globalThis as Record<string, unknown>
  g.__e2e = { ...(g.__e2e as object), [name]: value }
}

/** Sheet title row with a Done button (the grabber dismisses too). */
export function SheetHeader({ title }: { title: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: t.fg }]} accessibilityRole="header">
        {title}
      </Text>
      <Pressable hitSlop={12} onPress={() => router.back()} accessibilityRole="button">
        <Text style={[styles.mono, { color: t.accent, fontWeight: '600' }]}>Done</Text>
      </Pressable>
    </View>
  )
}

/** Mono uppercase label above a grouped block, like desktop .acc-section-title. */
export function SectionTitle({ children }: { children: string }): React.JSX.Element {
  const t = useTheme()
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>
}

export function Note({ children, style }: { children: React.ReactNode; style?: TextStyle }): React.JSX.Element {
  const t = useTheme()
  return <Text style={[styles.note, { color: t.muted }, style]}>{children}</Text>
}

export function ErrorBox({ text }: { text: string }): React.JSX.Element | null {
  const t = useTheme()
  if (!text) return null
  return (
    <Animated.View entering={FadeIn.duration(140)} style={[styles.error, { borderLeftColor: t.red, backgroundColor: mix(t.red, 10, t.surface) }]}>
      <Text style={{ color: t.red, lineHeight: 20 }} accessibilityRole="alert">
        {text}
      </Text>
    </Animated.View>
  )
}

/** Mono button; `primary` fills with accent, `danger` tints red. */
export function Button(props: {
  label: string
  onPress: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
  style?: ViewStyle
}): React.JSX.Element {
  const t = useTheme()
  const fill = props.primary ? (props.danger ? t.red : t.accent) : t.surface2
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill, borderColor: props.primary ? fill : t.lineStrong, opacity: props.disabled ? 0.45 : pressed ? 0.75 : 1 },
        props.style
      ]}
    >
      <Text style={[styles.mono, { color: props.primary ? t.onAccent : props.danger ? t.red : t.fg, fontWeight: props.primary ? '700' : '500' }]}>
        {props.label}
      </Text>
    </Pressable>
  )
}

/** Account colour picker; a selection tick on change. */
export function Swatches(props: { value: string; onChange: (c: string) => void; name: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel={props.name}>
      {SWATCHES.map((c) => {
        const on = props.value.toLowerCase() === c
        return (
          <Pressable
            key={c}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityLabel={c}
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (on) return
              void Haptics.selectionAsync()
              props.onChange(c)
            }}
            style={[styles.swatchRing, { borderColor: on ? t.fg : 'transparent' }]}
          >
            <View style={[styles.swatch, { backgroundColor: c }]} />
          </Pressable>
        )
      })}
    </View>
  )
}

export function KindIcon({ kind, big }: { kind: 'google' | 'caldav'; big?: boolean }): React.JSX.Element {
  const t = useTheme()
  const c = kind === 'google' ? t.cyan : t.accent
  return (
    <View style={[big ? styles.kindBig : styles.kind, { backgroundColor: mix(c, 14, t.bg) }]}>
      <Text style={{ color: c, fontFamily: fonts.mono, fontWeight: '700', fontSize: big ? (kind === 'google' ? 20 : 14) : fonts.size.xs }}>
        {kind === 'google' ? 'G' : 'DAV'}
      </Text>
    </View>
  )
}

/** Progress of connecting a new account: done ✓, the active one spins, the rest wait (desktop ConnectSteps). */
export function ConnectSteps({ steps, active }: { steps: string[]; active: number }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={steps[active]}>
      {steps.map((s, i) => (
        <Animated.View key={s} entering={FadeInDown.duration(160).delay(i * 60)} style={styles.step}>
          {i < active ? (
            <View style={[styles.dot, { backgroundColor: t.green }]}>
              <Text style={{ color: t.onAccent, fontSize: 9, fontWeight: '700' }}>✓</Text>
            </View>
          ) : i === active ? (
            <ActivityIndicator size="small" color={t.accent} style={styles.dot} />
          ) : (
            <View style={[styles.dot, { borderWidth: 1.5, borderColor: t.lineStrong }]} />
          )}
          <Text style={[styles.mono, { color: i <= active ? t.fg : t.muted }]}>{s}</Text>
        </Animated.View>
      ))}
    </View>
  )
}

export const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.xl, paddingBottom: space.md },
  title: { fontSize: fonts.size.lg, fontWeight: '600' },
  mono: { fontFamily: fonts.mono, fontSize: fonts.size.sm },
  section: { fontFamily: fonts.mono, fontSize: fonts.size.xs, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.sm },
  note: { fontSize: 14, lineHeight: 20 },
  error: { borderLeftWidth: 2, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 10 },
  button: { height: 36, paddingHorizontal: space.lg, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing: { padding: 2, borderWidth: 1.5, borderRadius: 7 },
  swatch: { width: 22, height: 22, borderRadius: radius.sm },
  kind: { width: 34, height: 18, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  kindBig: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  steps: { gap: space.md, paddingVertical: space.lg, alignSelf: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }
})
