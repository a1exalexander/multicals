import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { fonts, radius, space, useTheme } from '../../theme'

/** Pulsing calendar-row placeholders (desktop .sb-skel); static under Reduce Motion. */
export function SkeletonRows({ widths = [70, 45], text }: { widths?: number[]; text?: string }): React.JSX.Element {
  const t = useTheme()
  const reduced = useReducedMotion()
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withTiming(0.4, { duration: 600 }), -1, true)
  }, [reduced, pulse])
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }))
  return (
    <View accessibilityRole="progressbar">
      {widths.map((w, i) => (
        <Animated.View key={i} style={[styles.row, style]}>
          <View style={[styles.box, { backgroundColor: t.lineStrong }]} />
          <View style={[styles.bar, { width: `${w}%`, backgroundColor: t.lineStrong }]} />
        </Animated.View>
      ))}
      {text && <Text style={[styles.text, { color: t.muted }]}>{text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 44, paddingLeft: 10 + space.sm * 2 },
  box: { width: 20, height: 20, borderRadius: 5 },
  bar: { height: 10, borderRadius: radius.sm },
  text: { fontFamily: fonts.mono, fontSize: fonts.size.sm - 1, paddingLeft: 10 + space.sm * 2 + 20 + space.md, paddingBottom: space.xs }
})
