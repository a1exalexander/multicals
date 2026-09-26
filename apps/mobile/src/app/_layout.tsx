import '../polyfills'
import '../e2e'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ToastHost } from '../components/Toast'
import { useTheme } from '../theme'

/** Root: calendar screen plus native iOS sheets for everything else (details, editor, calendars, invites, accounts, settings). */
export default function RootLayout(): React.JSX.Element {
  const t = useTheme()
  const sheet = {
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetCornerRadius: 16,
    contentStyle: { backgroundColor: t.surface }
  } as const
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="event/[id]" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="editor" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="calendars" options={{ ...sheet, sheetAllowedDetents: [0.7, 1] }} />
        <Stack.Screen name="invites" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="accounts/add" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="settings" options={{ ...sheet, sheetAllowedDetents: [1] }} />
      </Stack>
      <ToastHost />
    </GestureHandlerRootView>
  )
}
