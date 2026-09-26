import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import type { CalEvent, DeleteScope, PartStat } from '@mysticals/core/shared/types'
import { canEdit, cleanNotes, formatWhen, linkify, ownerLine, STATUS_ICON } from '@mysticals/core/logic/details'
import { errorText } from '@mysticals/core/logic/editor'
import { meetingUrl } from '@mysticals/core/logic/meeting'
import { api } from '../../api'
import { useCalendarData } from '../../hooks/useCalendarData'
import { toast } from '../../state/bus'
import { sheets } from '../../state/sheets'
import { fonts, mix, radius, space, useTheme, type Theme } from '../../theme'
import { findLive, followRange, REPLIES, SCOPES, type Reply } from './details'

const statusColor = (t: Theme, s: PartStat): string =>
  ({ accepted: t.green, tentative: t.yellow, declined: t.red, needsAction: t.muted })[s]

const open = (href: string): void => void Linking.openURL(href).catch(() => toast({ text: 'Could not open link', error: true }))

/** Details sheet (desktop EventDetails): follows the live event by id, RSVP for invitees, edit/delete for owners. */
export function EventDetails({ id }: { id: string }): React.JSX.Element {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const snapshot = useMemo(() => sheets.openedEvent(id), [id])
  const range = useMemo(() => (snapshot ? followRange(snapshot) : undefined), [snapshot])
  const data = useCalendarData(range)

  // Our own Delete closes the sheet; the reload it triggers must not flash the "deleted" notice.
  const deleting = useRef(false)
  // Last copy seen, so a deletion keeps showing what was there (dimmed) instead of stale-then-empty.
  const last = useRef(snapshot)
  const found = snapshot && findLive(data.events, snapshot)
  if (found) last.current = found
  const event = found ?? last.current
  const gone = !event || (data.loaded && !found && !deleting.current)

  const [pending, setPending] = useState<Reply | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPeople, setShowPeople] = useState(false)

  const respond = useCallback(async (status: Reply): Promise<void> => {
    if (!event) return
    void Haptics.selectionAsync()
    setPending(status)
    setBusy(true)
    try {
      await api.events.respond(event, status)
    } catch (e) {
      setPending(null)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast({ text: `Reply failed: ${errorText(e)}`, error: true })
    } finally {
      setBusy(false)
    }
  }, [event])
  // The highlight stays optimistic until the reloaded copy carries the reply, so it never flips back in between.
  const liveStatus = event?.myStatus
  useEffect(() => {
    if (pending && liveStatus === pending) setPending(null)
  }, [pending, liveStatus])

  const remove = useCallback(async (scope: DeleteScope = 'one'): Promise<void> => {
    if (!event) return
    setBusy(true)
    deleting.current = true
    try {
      await api.events.delete(event, scope)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      if (router.canGoBack()) router.back()
      toast({ text: 'Event deleted' })
    } catch (e) {
      deleting.current = false
      setBusy(false)
      toast({ text: `Delete failed: ${errorText(e)}`, error: true })
    }
  }, [event])

  const confirmDelete = useCallback((): void => {
    if (!event) return
    if (event.recurringEventId) {
      const labels = [...SCOPES.map(([, l]) => l), 'Cancel']
      const pick = (i: number): void => void (i < SCOPES.length && remove(SCOPES[i][0]))
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title: 'Delete recurring event', options: labels, destructiveButtonIndex: [0, 1, 2], cancelButtonIndex: SCOPES.length, userInterfaceStyle: 'dark' },
          pick
        )
      } else {
        Alert.alert('Delete recurring event', undefined, labels.map((text, i) => ({ text, style: i < SCOPES.length ? 'destructive' : 'cancel', onPress: () => pick(i) })))
      }
    } else {
      Alert.alert('Delete this event?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() }
      ], { userInterfaceStyle: 'dark' })
    }
  }, [event, remove])

  const edit = useCallback((): void => {
    if (!event) return
    // Replace the details sheet with the editor rather than stacking two sheets.
    if (router.canGoBack()) router.back()
    sheets.openEditor({ event })
  }, [event])

  // Dev-only: lets scripts/e2e.mjs run the same handlers as the buttons (no touch injection on the iOS 27 simulator).
  useEffect(() => {
    if (!__DEV__) return
    const e2e = (globalThis as { __e2e?: Record<string, unknown> }).__e2e
    if (!e2e) return
    e2e.details = { respond, remove, confirmDelete, edit, togglePeople: () => setShowPeople((v) => !v) }
    return () => void delete e2e.details
  }, [respond, remove, confirmDelete, edit])

  const close = (): void => void (router.canGoBack() && router.back())

  if (!event) {
    return (
      <View style={[styles.wrap, { paddingBottom: insets.bottom + space.lg }]}>
        <Gone t={t} where="the calendar" onClose={close} />
      </View>
    )
  }

  const account = data.accounts.find((a) => a.id === event.accountId)
  const calendar = data.calendars.find((c) => c.accountId === event.accountId && c.id === event.calendarId)
  const color = calendar?.color ?? account?.color ?? t.accent
  const owner = data.loaded ? ownerLine(calendar?.name ?? 'Calendar', account?.label ?? event.accountId, account?.email) : undefined
  const editable = canEdit(event, account, calendar)
  const notes = cleanNotes(event.description)
  const join = meetingUrl(event.location)
  const status = pending ?? event.myStatus
  const label = [styles.label, { color: t.muted }]

  return (
    <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space.xl }]} testID="details">
      {gone && <Gone t={t} where={calendar?.name ?? 'the calendar'} onClose={close} />}
      <View style={gone && styles.dim}>
        <View style={[styles.head, { borderLeftColor: gone ? t.red : color }]}>
          <Text style={[styles.title, { color: t.fg }, gone && styles.strike]} selectable>
            {event.title || 'Untitled'}
          </Text>
          <Text style={[styles.when, { color: t.fg }]}>{formatWhen(event)}</Text>
          <View style={styles.ownerRow}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            {/* Reserves its line before the directory loads, so nothing below shifts. */}
            <Text style={[styles.owner, { color: t.muted }]} numberOfLines={1}>
              {owner ? (
                <>
                  {owner.calendar && `${owner.calendar} in `}
                  <Text style={{ color: t.fg }}>{owner.label}</Text>
                  {owner.email && ` · ${owner.email}`}
                </>
              ) : ' '}
            </Text>
          </View>
        </View>

        {join && !gone && (
          <Pressable
            testID="details-join"
            onPress={() => open(join)}
            style={({ pressed }) => [styles.join, { backgroundColor: color, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.joinText, { color: t.onAccent }]}>Join meeting</Text>
          </Pressable>
        )}

        {!!event.location && (
          <Row label="Location" t={t}>
            <Linkified text={event.location} t={t} />
          </Row>
        )}
        {!!event.organizer?.email && (
          <Row label="Organizer" t={t}>
            <Text style={[styles.body, { color: t.fg }]} selectable>
              {event.organizer.name ? `${event.organizer.name} <${event.organizer.email}>` : event.organizer.email}
            </Text>
          </Row>
        )}

        {event.attendees.length > 0 && (
          <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
            <Pressable
              testID="invitees-toggle"
              hitSlop={8}
              onPress={() => {
                void Haptics.selectionAsync()
                setShowPeople((v) => !v)
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showPeople }}
            >
              <Text style={label}>
                {showPeople ? '▾' : '▸'} Invitees ({event.attendees.length})
              </Text>
            </Pressable>
            {showPeople && (
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.people}>
                {event.attendees.map((a) => (
                  <View key={a.email} style={styles.person}>
                    <Text style={[styles.status, { color: statusColor(t, a.status) }]} accessibilityLabel={a.status}>
                      {STATUS_ICON[a.status]}
                    </Text>
                    <Text style={[styles.body, styles.who, { color: t.fg }]} numberOfLines={1}>
                      {a.name ?? a.email}
                    </Text>
                    {a.self && <Tag t={t} text="you" />}
                    {a.organizer && <Tag t={t} text="organizer" />}
                  </View>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        )}

        <Animated.View layout={LinearTransition.duration(220)}>
          {!!notes && (
            <View style={[styles.notes, { borderTopColor: t.lineStrong }]}>
              <Linkified text={notes} t={t} />
            </View>
          )}

          {!gone && event.myStatus && (
            <View style={[styles.rsvp, { borderTopColor: t.lineStrong }]}>
              <View style={[styles.seg, { borderColor: t.lineStrong }]} accessibilityRole="radiogroup">
                {REPLIES.map(([s, text], i) => {
                  const on = status === s
                  const c = statusColor(t, s)
                  return (
                    <Pressable
                      key={s}
                      testID={`rsvp-${s}`}
                      disabled={busy}
                      onPress={() => void respond(s)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on, disabled: busy }}
                      style={[
                        styles.segBtn,
                        i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.lineStrong },
                        on && { backgroundColor: mix(c, 18, t.surface) }
                      ]}
                    >
                      <Text style={[styles.segText, { color: on ? c : t.muted }]}>{text}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <Text style={[styles.replyAs, { color: t.muted }]} numberOfLines={1}>
                Reply as {account?.email ?? event.accountId}
              </Text>
            </View>
          )}

          {editable && !gone && (
            <Animated.View entering={FadeIn.duration(180)} style={styles.actions}>
              <Btn t={t} text="Delete" color={t.red} disabled={busy} onPress={confirmDelete} testID="details-delete" />
              <Btn t={t} text="Edit" color={t.fg} disabled={busy} onPress={edit} testID="details-edit" />
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </ScrollView>
  )
}

function Gone({ t, where, onClose }: { t: Theme; where: string; onClose: () => void }): React.JSX.Element {
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      testID="details-gone"
      accessibilityRole="alert"
      style={[styles.gone, { backgroundColor: mix(t.red, 12, t.surface), borderColor: mix(t.red, 35, t.surface) }]}
    >
      <View style={[styles.goneIcon, { backgroundColor: t.red }]}>
        <Text style={[styles.goneIconText, { color: t.onAccent }]}>✕</Text>
      </View>
      <View style={styles.goneBody}>
        <Text style={[styles.goneTitle, { color: t.fg }]}>This event was deleted</Text>
        <Text style={[styles.goneText, { color: t.muted }]}>It was removed from {where}, possibly on another device.</Text>
      </View>
      <Btn t={t} text="Close" color={t.fg} onPress={onClose} style={styles.closeBtn} />
    </Animated.View>
  )
}

function Row({ label, t, children }: { label: string; t: Theme; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, styles.rowLabel, { color: t.muted }]}>{label}</Text>
      <View style={styles.rowBody}>{children}</View>
    </View>
  )
}

function Linkified({ text, t }: { text: string; t: Theme }): React.JSX.Element {
  return (
    <Text style={[styles.body, { color: t.fg }]} selectable>
      {linkify(text).map((p, i) =>
        p.href ? (
          <Text key={i} style={{ color: t.cyan }} onPress={() => open(p.href!)} accessibilityRole="link">
            {p.text}
          </Text>
        ) : (
          p.text
        )
      )}
    </Text>
  )
}

function Tag({ t, text }: { t: Theme; text: string }): React.JSX.Element {
  return <Text style={[styles.tag, { color: t.muted, backgroundColor: t.hover }]}>{text}</Text>
}

function Btn(p: { t: Theme; text: string; color: string; disabled?: boolean; onPress: () => void; testID?: string; style?: object }): React.JSX.Element {
  return (
    <Pressable
      testID={p.testID}
      disabled={p.disabled}
      onPress={p.onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, { borderColor: p.t.lineStrong, backgroundColor: pressed ? p.t.hover : p.t.surface2, opacity: p.disabled ? 0.5 : 1 }, p.style]}
    >
      <Text style={[styles.btnText, { color: p.color }]}>{p.text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: space.xl, paddingTop: space.xl + space.sm },
  dim: { opacity: 0.45 },
  head: { borderLeftWidth: 2, paddingLeft: space.md },
  title: { fontSize: fonts.size.xl, fontWeight: '600', lineHeight: 28 },
  strike: { textDecorationLine: 'line-through' },
  when: { marginTop: space.sm, fontFamily: fonts.mono, fontSize: fonts.size.sm + 1, lineHeight: 20 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  owner: { flex: 1, fontFamily: fonts.mono, fontSize: fonts.size.sm, lineHeight: 18 },
  join: { marginTop: space.lg, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  joinText: { fontFamily: fonts.mono, fontSize: fonts.size.sm + 1, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', marginTop: space.lg, gap: space.sm },
  rowLabel: { width: 88 },
  rowBody: { flex: 1 },
  label: { fontFamily: fonts.mono, fontSize: fonts.size.xs + 1, lineHeight: 21, letterSpacing: 0.7, textTransform: 'uppercase' },
  body: { fontSize: fonts.size.md, lineHeight: 21 },
  section: { marginTop: space.lg },
  people: { marginTop: space.xs, gap: 6 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { width: 16, textAlign: 'center', fontFamily: fonts.mono, fontSize: fonts.size.sm + 1, fontWeight: '700' },
  who: { flexShrink: 1 },
  tag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: 'hidden', fontFamily: fonts.mono, fontSize: fonts.size.xs },
  notes: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  rsvp: { marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  seg: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
  segBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.mono, fontSize: fonts.size.sm + 1, fontWeight: '600' },
  replyAs: { marginTop: space.sm, fontFamily: fonts.mono, fontSize: fonts.size.xs + 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  btn: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { flex: 0, height: 30, paddingHorizontal: space.md },
  btnText: { fontFamily: fonts.mono, fontSize: fonts.size.sm + 1, fontWeight: '600' },
  gone: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  goneIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  goneIconText: { fontFamily: fonts.mono, fontSize: fonts.size.xs, fontWeight: '700' },
  goneBody: { flex: 1 },
  goneTitle: { fontSize: fonts.size.md, fontWeight: '600' },
  goneText: { marginTop: 2, fontFamily: fonts.mono, fontSize: fonts.size.xs + 1, lineHeight: 16 }
})
