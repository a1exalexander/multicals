import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { isEmail, splitEmails } from '@mysticals/core/logic/editor'
import { fonts, mix, radius, space, useTheme } from '../../theme'
import { addInvitees, fromPickerDate, takeDraft, toPickerDate } from './form'

/** Desktop editor grid row: mono uppercase label on the left, control on the right. */
export function Row({ label, children, top }: { label: string; children: React.ReactNode; top?: boolean }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={[styles.row, top && { alignItems: 'flex-start' }]}>
      <Text style={[styles.label, { color: t.muted }, top && { paddingTop: 9 }]}>{label}</Text>
      <View style={styles.control}>{children}</View>
    </View>
  )
}

export interface Option {
  id: string
  label: string
  color: string
}

/** Inline single choice (account / calendar); nothing is selected until the user picks, like desktop. */
export function Pills({ options, value, onChange, testID }: {
  options: Option[]
  value: string
  onChange: (id: string) => void
  testID?: string
}): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.pills} testID={testID}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[
              styles.pill,
              { borderColor: on ? o.color : t.lineStrong, backgroundColor: on ? mix(o.color, 16, t.bg) : t.bg }
            ]}
          >
            <View style={[styles.dot, { backgroundColor: o.color }]} />
            <Text style={[styles.pillText, { color: on ? t.fg : t.muted }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Read-only value (account/calendar while editing: events never move between accounts). */
export function Static({ text, color, testID }: { text: string; color?: string; testID?: string }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={styles.static} testID={testID}>
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={{ color: t.fg, fontSize: fonts.size.md, fontWeight: '500' }}>{text}</Text>
    </View>
  )
}

/** Native compact iOS date(+time) picker bound to a form value. */
export function When({ value, dateOnly, accent, onChange, testID }: {
  value: string
  dateOnly: boolean
  accent: string
  onChange: (v: string) => void
  testID?: string
}): React.JSX.Element {
  return (
    <View style={styles.when}>
      <DateTimePicker
        testID={testID}
        value={toPickerDate(value)}
        mode={dateOnly ? 'date' : 'datetime'}
        display="compact"
        minuteInterval={15}
        themeVariant="dark"
        accentColor={accent}
        onValueChange={(_, d) => onChange(fromPickerDate(d, value, dateOnly))}
      />
    </View>
  )
}

/** Invitee chips; typed text becomes chips on return/comma/space. Invalid ones stay, marked red, and block saving. */
export function Invitees({ list, draft, accent, onList, onDraft }: {
  list: string[]
  draft: string
  accent: string
  onList: (list: string[]) => void
  onDraft: (text: string) => void
}): React.JSX.Element {
  const t = useTheme()
  const [focused, setFocused] = useState(false)
  const commit = (): void => {
    const add = splitEmails(draft)
    if (add.length) onList(addInvitees(list, add))
    onDraft('')
  }
  return (
    <View style={[styles.box, styles.chips, { backgroundColor: t.bg, borderColor: focused ? accent : t.lineStrong }]}>
      {list.map((m) => {
        const bad = !isEmail(m)
        return (
          <View key={m} style={[styles.chip, { backgroundColor: bad ? mix(t.red, 20, t.bg) : mix(accent, 16, t.bg) }]}>
            <Text style={[styles.chipText, { color: bad ? t.red : t.fg }]}>{m}</Text>
            <Pressable
              hitSlop={8}
              accessibilityLabel={`Remove ${m}`}
              onPress={() => onList(list.filter((x) => x !== m))}
            >
              <Text style={[styles.chipX, { color: t.muted }]}>×</Text>
            </Pressable>
          </View>
        )
      })}
      <TextInput
        style={[styles.chipInput, { color: t.fg }]}
        value={draft}
        placeholder={list.length ? '' : 'Add people (optional)'}
        placeholderTextColor={t.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        returnKeyType="done"
        submitBehavior="submit"
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          commit()
        }}
        onSubmitEditing={commit}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Backspace' && !draft && list.length) onList(list.slice(0, -1))
        }}
        onChangeText={(text) => {
          const { add, rest } = takeDraft(text)
          if (add.length) onList(addInvitees(list, add))
          onDraft(rest)
        }}
      />
    </View>
  )
}

/** Themed single/multi-line text input with the desktop's accent focus ring. */
export function Field(props: React.ComponentProps<typeof TextInput> & { accent: string }): React.JSX.Element {
  const t = useTheme()
  const [focused, setFocused] = useState(false)
  const { accent, style, ...rest } = props
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...rest}
      onFocus={(e) => {
        setFocused(true)
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        rest.onBlur?.(e)
      }}
      style={[styles.box, styles.input, { color: t.fg, backgroundColor: t.bg, borderColor: focused ? accent : t.lineStrong }, style]}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36 },
  label: {
    width: 78,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: fonts.size.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  control: { flex: 1, minWidth: 0 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  pillText: { fontFamily: fonts.mono, fontSize: fonts.size.sm, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  static: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  when: { alignItems: 'flex-start' },
  box: { borderWidth: 1, borderRadius: radius.sm },
  input: { paddingHorizontal: space.sm, paddingVertical: 7, fontSize: fonts.size.md, minHeight: 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, padding: space.xs, minHeight: 36 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: space.sm, paddingRight: 2, borderRadius: 3 },
  chipText: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 22 },
  chipX: { fontSize: 16, paddingHorizontal: 5 },
  chipInput: { flexGrow: 1, minWidth: 140, fontSize: fonts.size.md, paddingHorizontal: space.xs, paddingVertical: 4 }
})
