import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { bus, type BusEvents } from '../state/bus'
import { fonts, radius, space, useTheme } from '../theme'

const SHOW_MS = 4000

/** Renders the latest `toast()` above the home indicator; mounted once in the root layout. */
export function ToastHost(): React.JSX.Element | null {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const [msg, setMsg] = useState<(BusEvents['toast'] & { key: number }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () =>
      bus.on('toast', (m) => {
        clearTimeout(timer.current)
        setMsg({ ...m, key: Date.now() })
        timer.current = setTimeout(() => setMsg(null), SHOW_MS)
      }),
    []
  )

  if (!msg) return null
  return (
    <Animated.View
      key={msg.key}
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      style={[styles.wrap, { bottom: insets.bottom + space.md, backgroundColor: t.surface2, borderColor: msg.error ? t.red : t.lineStrong }]}
    >
      <Text style={[styles.text, { color: msg.error ? t.red : t.fg }]} numberOfLines={2}>
        {msg.text}
      </Text>
      {msg.action && (
        <Pressable
          hitSlop={8}
          onPress={() => {
            msg.action!.run()
            setMsg(null)
          }}
        >
          <Text style={[styles.action, { color: t.accent }]}>{msg.action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }
  },
  text: { flex: 1, fontSize: fonts.size.md },
  action: { fontFamily: fonts.mono, fontSize: fonts.size.sm, textTransform: 'uppercase', letterSpacing: 1 }
})
