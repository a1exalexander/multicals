import { StyleSheet, Text, View } from 'react-native'
import { fonts, useTheme } from '../theme'

/** Temporary body of a route not built yet. */
export function Placeholder({ name }: { name: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.wrap}>
      <Text style={{ color: t.muted, fontFamily: fonts.mono }}>{name}</Text>
    </View>
  )
}

const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } })
