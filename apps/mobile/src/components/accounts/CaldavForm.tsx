import type { Account } from '@mysticals/core/shared/types'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { api } from '../../api'
import { SWATCHES, fonts, space, useTheme } from '../../theme'
import { PRESETS, canConnect, errorText, hostOf, suggestLabel } from './logic'
import { Button, ConnectSteps, ErrorBox, Note, SectionTitle, Swatches, devHook, styles as ui } from './ui'

type Fields = { preset: string; serverUrl: string; username: string; password: string; label: string; color: string }

/** CalDAV sign-in form (desktop CaldavForm): provider, email, app password, label, colour. */
export function CaldavForm(props: { onBack: () => void; onDone: (a: Account) => void; alive: () => boolean }): React.JSX.Element {
  const t = useTheme()
  const [f, setF] = useState<Fields>({ preset: PRESETS[0].id, serverUrl: PRESETS[0].url, username: '', password: '', label: '', color: SWATCHES[0] })
  const [labelTouched, setLabelTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preset = PRESETS.find((p) => p.id === f.preset) ?? PRESETS[PRESETS.length - 1]
  const set = (patch: Partial<Fields>): void => setF((x) => ({ ...x, ...patch }))

  // Latest fields for the submit handler, so the e2e hook and the button run the same code.
  const latest = useRef(f)
  latest.current = f

  const submit = async (): Promise<void> => {
    const v = latest.current
    setBusy(true)
    setError('')
    try {
      const a = await api.accounts.addCaldav({
        serverUrl: v.serverUrl.trim(),
        username: v.username.trim(),
        password: v.password,
        label: v.label.trim() || v.username.trim(),
        color: v.color
      })
      // Stays on the progress steps while the sheet dismisses.
      if (props.alive()) props.onDone(a)
    } catch (e) {
      if (!props.alive()) return
      setError(errorText(e))
      setBusy(false)
    }
  }

  useEffect(() => devHook('caldav', { fill: (p: Partial<Fields>) => setF((x) => ({ ...x, ...p })), submit }))

  if (busy) return <ConnectSteps steps={[`Signing in to ${hostOf(f.serverUrl.trim())}…`, 'Loading calendars']} active={0} />

  const input: TextInputProps = {
    style: [s.input, { color: t.fg }],
    placeholderTextColor: t.faint,
    autoCorrect: false,
    autoCapitalize: 'none',
    spellCheck: false
  }

  return (
    <Animated.View entering={FadeIn.duration(160)} layout={LinearTransition.duration(180)}>
      <SectionTitle>Provider</SectionTitle>
      <View style={[ui.card, { borderColor: t.lineStrong, backgroundColor: t.bg }]} accessibilityRole="radiogroup">
        {PRESETS.map((p, i) => (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: p.id === f.preset }}
            onPress={() => set({ preset: p.id, serverUrl: p.url })}
            style={({ pressed }) => [s.row, i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }, pressed && { backgroundColor: t.hover }]}
          >
            <Text style={{ color: t.fg, fontSize: fonts.size.md, flex: 1 }}>{p.name}</Text>
            {p.id === f.preset && <Text style={{ color: t.accent, fontSize: fonts.size.md, fontWeight: '600' }}>✓</Text>}
          </Pressable>
        ))}
      </View>

      <SectionTitle>Sign in</SectionTitle>
      <View style={[ui.card, { borderColor: t.lineStrong, backgroundColor: t.bg }]}>
        {f.preset === 'custom' && (
          <Field label="Server" first>
            <TextInput
              {...input}
              value={f.serverUrl}
              onChangeText={(serverUrl) => set({ serverUrl })}
              placeholder="https://caldav.example.com/"
              keyboardType="url"
              textContentType="URL"
            />
          </Field>
        )}
        <Field label="Email" first={f.preset !== 'custom'}>
          <TextInput
            {...input}
            value={f.username}
            onChangeText={(username) => set(labelTouched ? { username } : { username, label: suggestLabel(username) })}
            placeholder="you@company.com"
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <TextInput
            {...input}
            value={f.password}
            onChangeText={(password) => set({ password })}
            placeholder="App password"
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
          />
        </Field>
        <Field label="Label">
          <TextInput
            {...input}
            autoCapitalize="words"
            value={f.label}
            onChangeText={(label) => {
              setLabelTouched(true)
              set({ label })
            }}
            placeholder="Work"
          />
        </Field>
      </View>
      <Note style={s.hint}>{preset.hint}</Note>

      <SectionTitle>Colour</SectionTitle>
      <Swatches value={f.color} onChange={(color) => set({ color })} name="Account colour" />

      <View style={s.gap}>
        <ErrorBox text={error} />
      </View>
      <View style={s.actions}>
        <Button label="Back" onPress={props.onBack} />
        <Button label="Add account" primary disabled={!canConnect(f)} onPress={() => void submit()} />
      </View>
    </Animated.View>
  )
}

function Field(props: { label: string; first?: boolean; children: React.ReactNode }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={[s.row, !props.first && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[s.label, { color: t.muted }]}>{props.label}</Text>
      {props.children}
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 46, paddingHorizontal: space.md },
  label: { width: 84, fontFamily: fonts.mono, fontSize: fonts.size.xs, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { flex: 1, fontSize: fonts.size.md, paddingVertical: space.md },
  hint: { marginTop: space.sm, fontSize: 13, paddingHorizontal: space.xs },
  gap: { marginTop: space.lg },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.lg }
})
