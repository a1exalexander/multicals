import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import {
  applyForm, emptyForm, errorText, formFromEvent, formToInput, moveStart, setAllDay, soleId, splitEmails,
  writableAccounts, writableCalendars, type EventForm
} from '@mysticals/core/logic/editor'
import { api } from '../api'
import { Field, Invitees, Pills, Row, Static, When } from '../components/editor/parts'
import { useCalendarData } from '../hooks/useCalendarData'
import { toast } from '../state/bus'
import { sheets } from '../state/sheets'
import { fonts, mix, radius, space, useTheme } from '../theme'

/** Create/edit sheet (desktop EventEditor). Account + calendar are an explicit choice; editing never moves an event. */
export default function EditorScreen(): React.JSX.Element {
  const t = useTheme()
  const { accounts, calendars, loaded } = useCalendarData()
  const [input] = useState(sheets.editorInput)
  const editing = 'event' in input ? input.event : null
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true // re-set after Fast Refresh re-runs effects
    return () => void (alive.current = false)
  }, [])

  // Editing needs no directory lookup, so a failed directory load can't leave it blank.
  const [form, setForm] = useState<EventForm | null>(() => (editing ? formFromEvent(editing) : null))
  // A new form is built once the directory is known; later reloads must not wipe what the user typed.
  useEffect(() => {
    if (form || !loaded || 'event' in input) return
    setForm(emptyForm(accounts, calendars, input))
  }, [form, loaded, input, accounts, calendars])

  const account = accounts.find((a) => a.id === form?.accountId)
  const calendar = calendars.find((c) => c.accountId === form?.accountId && c.id === form?.calendarId)
  const invitees = form ? [...form.attendees, ...splitEmails(draft)] : []
  const canSave = !!form && !!form.accountId && !!form.calendarId && !saving
  const accent = account?.color ?? t.muted

  const save = async (): Promise<void> => {
    if (!form || !canSave) return
    setError('')
    setSaving(true)
    try {
      const f = { ...form, attendees: invitees }
      if (editing) await api.events.update(applyForm(editing, f))
      else await api.events.create(formToInput(f))
      if (!alive.current) return
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
      toast({ text: editing ? 'Event saved' : 'Event added' })
    } catch (e) {
      if (!alive.current) return
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(errorText(e))
      setSaving(false)
    }
  }

  // Dev-only: lets scripts/e2e.mjs fill the form and save through the same handler (no taps on the iOS 27 simulator).
  const saveRef = useRef(save)
  saveRef.current = save
  const errorRef = useRef(error)
  errorRef.current = error
  useEffect(() => {
    if (!__DEV__) return
    const e2e = (globalThis as { __e2e?: Record<string, unknown> }).__e2e
    if (!e2e) return
    e2e.editor = {
      fill: (patch: Partial<EventForm> & { draft?: string }) => {
        const { draft: d, ...p } = patch
        if (d !== undefined) setDraft(d)
        setForm((f) => f && (p.start && !p.end ? { ...moveStart(f, p.start), ...p } : { ...f, ...p }))
      },
      save: () => saveRef.current(),
      error: () => errorRef.current
    }
    return () => void delete e2e.editor
  }, [])

  const set = (patch: Partial<EventForm>): void => setForm((f) => f && { ...f, ...patch })

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface }]} collapsable={false}>
      {/* The native formSheet wants at most header + ScrollView; unflattened, or it lays the form over the header. */}
      <View collapsable={false}>
        <View style={[styles.head, { borderBottomColor: t.line }]}>
          <Pressable hitSlop={10} onPress={() => router.back()} accessibilityRole="button">
            <Text style={[styles.btn, { color: t.muted }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headTitle, { color: t.fg }]}>{editing ? 'Edit Event' : 'New Event'}</Text>
          <Pressable
            hitSlop={10}
            disabled={!canSave}
            onPress={() => void save()}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            testID="editor-save"
          >
            <Text style={[styles.btn, styles.save, { color: canSave ? t.accent : t.faint }]}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
            </Text>
          </Pressable>
        </View>
        <View style={{ height: 2, backgroundColor: accent }} />
        {/* Under the header, not at the end of the form: the keyboard would hide it there. */}
        {!!error && (
          <Text
            style={[styles.error, { color: t.red, backgroundColor: mix(t.red, 12, t.surface) }]}
            accessibilityRole="alert"
            testID="editor-error"
          >
            {error}
          </Text>
        )}
      </View>

      {form && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titleRow}>
            <View style={[styles.titleDot, { backgroundColor: accent }]} />
            <TextInput
              autoFocus
              style={[styles.title, { color: t.fg }]}
              placeholder={editing ? 'Title' : 'New Event'}
              placeholderTextColor={t.muted}
              value={form.title}
              onChangeText={(title) => set({ title })}
              returnKeyType="done"
            />
          </View>

          <View style={styles.grid}>
            <Row label="Account">
              {editing ? (
                <Static text={account?.label ?? editing.accountId} color={account?.color} testID="editor-account" />
              ) : (
                <Pills
                  testID="editor-account"
                  options={writableAccounts(accounts, calendars).map((a) => ({ id: a.id, label: a.label, color: a.color }))}
                  value={form.accountId}
                  onChange={(accountId) => {
                    void Haptics.selectionAsync()
                    set({ accountId, calendarId: soleId(writableCalendars(calendars, accountId)) })
                  }}
                />
              )}
            </Row>

            <Row label="Calendar">
              {editing ? (
                <Static text={calendar?.name ?? editing.calendarId} color={calendar?.color} testID="editor-calendar" />
              ) : form.accountId ? (
                <Pills
                  testID="editor-calendar"
                  options={writableCalendars(calendars, form.accountId).map((c) => ({ id: c.id, label: c.name, color: c.color }))}
                  value={form.calendarId}
                  onChange={(calendarId) => {
                    void Haptics.selectionAsync()
                    set({ calendarId })
                  }}
                />
              ) : (
                <Text style={[styles.hint, { color: t.muted }]}>Choose an account first</Text>
              )}
            </Row>

            <Row label="All-day">
              <Switch
                value={form.allDay}
                onValueChange={(v) => setForm((f) => f && setAllDay(f, v))}
                trackColor={{ true: accent, false: t.lineStrong }}
                style={styles.switch}
              />
            </Row>

            <Row label="Starts">
              <When
                testID="editor-start"
                value={form.start}
                dateOnly={form.allDay}
                accent={accent}
                onChange={(start) => setForm((f) => f && moveStart(f, start))}
              />
            </Row>

            <Row label="Ends">
              <When testID="editor-end" value={form.end} dateOnly={form.allDay} accent={accent} onChange={(end) => set({ end })} />
            </Row>

            <Row label="Location">
              <Field
                accent={accent}
                placeholder="Add location"
                value={form.location}
                onChangeText={(location) => set({ location })}
                returnKeyType="done"
              />
            </Row>

            <Row label="Invitees" top>
              <Invitees
                list={form.attendees}
                draft={draft}
                accent={accent}
                onList={(attendees) => set({ attendees })}
                onDraft={setDraft}
              />
            </Row>

            <Row label="Notes" top>
              <Field
                accent={accent}
                placeholder="Add notes"
                value={form.description}
                onChangeText={(description) => set({ description })}
                multiline
                style={styles.notes}
              />
            </Row>
          </View>

          <View style={[styles.identity, { backgroundColor: mix(accent, 9, t.surface), borderLeftColor: accent }]}>
            {account ? (
              <>
                <Text style={[styles.idText, { color: t.fg }]}>
                  Created in <Text style={styles.bold}>{account.label}</Text> · {account.email}
                </Text>
                {invitees.length > 0 && (
                  <Text style={[styles.idText, { color: t.orange }]}>
                    Invitations will be sent from <Text style={styles.bold}>{account.email}</Text>
                  </Text>
                )}
              </>
            ) : (
              <Text style={[styles.idText, { color: t.fg }]}>Choose which account this event belongs to.</Text>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  headTitle: { fontSize: fonts.size.lg, fontWeight: '600' },
  btn: { fontFamily: fonts.mono, fontSize: fonts.size.sm, letterSpacing: 0.6, textTransform: 'uppercase' },
  save: { fontWeight: '700' },
  body: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleDot: { width: 10, height: 10, borderRadius: 3 },
  title: { flex: 1, fontSize: fonts.size.xl, fontWeight: '600', paddingVertical: 4 },
  grid: { gap: space.sm + 2 },
  hint: { fontFamily: fonts.mono, fontSize: fonts.size.sm, paddingVertical: 8 },
  switch: { alignSelf: 'flex-start' },
  notes: { minHeight: 88, textAlignVertical: 'top', paddingTop: 8 },
  identity: { borderLeftWidth: 2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: space.sm, gap: 2 },
  idText: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 18 },
  bold: { fontWeight: '700' },
  error: { fontSize: fonts.size.md, paddingHorizontal: space.lg, paddingVertical: space.sm }
})
