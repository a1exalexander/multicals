import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'
import type { ViewProps } from './types'

/** Stub; replaced by the MonthGrid work unit. */
export function MonthGrid({ events }: ViewProps): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.wrap}>
      <Text style={{ color: t.muted }}>MonthGrid: {events.length} events</Text>
    </View>
  )
}

const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' } })
