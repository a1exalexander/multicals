import type { Account } from '@mysticals/core/shared/types'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { api } from '../../api'
import { CaldavForm } from '../../components/accounts/CaldavForm'
import { errorText } from '../../components/accounts/logic'
import { Button, ConnectSteps, ErrorBox, KindIcon, Note, SheetHeader, devHook, styles as ui } from '../../components/accounts/ui'
import { toast } from '../../state/bus'
import { fonts, radius, space, useTheme } from '../../theme'

type Step = 'choose' | 'google' | 'caldav'

/** Add a Google or CalDAV account (desktop AccountsHost). */
export default function AddAccountScreen(): React.JSX.Element {
  const t = useTheme()
  const [step, setStep] = useState<Step>('choose')
  const [error, setError] = useState('')
  // Results arriving after the sheet was dismissed (or Google was cancelled) must not touch it.
  const session = useRef(0)
  useEffect(() => () => void session.current++, [])
  const alive = (s = session.current) => (): boolean => s === session.current

  const done = (a: Account): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    toast({ text: `Added ${a.label || a.email}` })
    router.back()
  }

  const addGoogle = async (): Promise<void> => {
    const ok = alive(++session.current)
    setError('')
    setStep('google')
    try {
      const a = await api.accounts.addGoogle()
      if (ok()) done(a)
    } catch (e) {
      if (!ok()) return
      setError(errorText(e))
      setStep('choose')
    }
  }

  useEffect(() => devHook('addAccount', { step: setStep, addGoogle }))

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <SheetHeader title="Add calendar account" />
      <Note>Each account is isolated: events and invitations are only sent from the account they belong to.</Note>

      {step === 'choose' && (
        <Animated.View entering={FadeIn.duration(160)}>
          <View style={s.choices}>
            <Choice kind="google" title="Google" sub="Sign in with Google" onPress={() => void addGoogle()} />
            <Choice kind="caldav" title="CalDAV" sub="Private Email, iCloud, Fastmail…" onPress={() => setStep('caldav')} />
          </View>
          <ErrorBox text={error} />
          <Pressable hitSlop={8} onPress={() => router.replace('/settings')} style={s.link} accessibilityRole="link">
            <Text style={[ui.mono, { color: t.accent }]}>Manage existing accounts…</Text>
          </Pressable>
        </Animated.View>
      )}

      {step === 'google' && (
        <Animated.View entering={FadeIn.duration(160)} style={s.center}>
          <ConnectSteps steps={['Signing in with Google…', 'Connecting your account', 'Loading calendars']} active={0} />
          <Note style={s.centerText}>Finish signing in there; Mysticals comes back on its own.</Note>
          <Button
            label="Cancel"
            style={s.cancel}
            onPress={() => {
              session.current++
              setStep('choose')
            }}
          />
        </Animated.View>
      )}

      {step === 'caldav' && <CaldavForm onBack={() => setStep('choose')} onDone={done} alive={alive()} />}
    </ScrollView>
  )
}

function Choice(props: { kind: 'google' | 'caldav'; title: string; sub: string; onPress: () => void }): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [s.choice, { backgroundColor: t.bg, borderColor: pressed ? t.accent : t.lineStrong }]}
    >
      <KindIcon kind={props.kind} big />
      <Text style={{ color: t.fg, fontSize: fonts.size.md, fontWeight: '600', marginTop: space.sm }}>{props.title}</Text>
      <Text style={[ui.mono, { color: t.muted, fontSize: 11, textAlign: 'center' }]}>{props.sub}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2 },
  choices: { flexDirection: 'row', gap: space.md, marginTop: space.xl, marginBottom: space.md },
  choice: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.xl, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.md },
  link: { alignSelf: 'center', marginTop: space.lg },
  center: { alignItems: 'center', marginTop: space.lg },
  centerText: { textAlign: 'center', fontSize: 13 },
  cancel: { marginTop: space.lg }
})
