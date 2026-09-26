import { memo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { format } from 'date-fns'
import { startsLabel } from '@mysticals/core/logic/status'
import type { Account, CalEvent } from '@mysticals/core/shared/types'
import { sheets } from '../state/sheets'
import { fonts, space, useTheme } from '../theme'
import { nowNext } from './shell'

interface Props {
  /** Visible upcoming events (the screen already loads the next 60 days for invites). */
  events: CalEvent[]
  accounts: Account[]
  colorOf: (e: CalEvent) => string
  now: Date
}

/** Slim desktop-style status bar: what's on now / next, sync spinner, sync error (tap → calendars). */
export const StatusLine = memo(function StatusLine({ events, accounts, colorOf, now }: Props): React.JSX.Element {
  const t = useTheme()
  const { current, next } = nowNext(events, now)
  const syncing = accounts.some((a) => a.syncing)
  const failed = accounts.filter((a) => a.error)
  const ev = current[0] ?? next

  return (
    <View style={[styles.wrap, { borderTopColor: t.line }]} testID="status-line">
      <Pressable style={styles.event} disabled={!ev} onPress={() => ev && sheets.openEvent(ev)} accessibilityRole={ev ? 'button' : 'text'}>
        {ev ? (
          <Text style={[styles.text, { color: t.muted }]} numberOfLines={1}>
            {ev === current[0] ? <Text style={{ color: colorOf(ev) }}>● </Text> : 'next: '}
            <Text style={{ color: t.fg }}>{ev.title || 'Untitled'}</Text>
            {ev === current[0] ? ` · until ${format(new Date(ev.end), 'HH:mm')}` : ` · ${startsLabel(ev.start, now)}`}
            {current.length > 1 ? `  +${current.length - 1}` : ''}
          </Text>
        ) : (
          <Text style={[styles.text, { color: t.faint }]}>no upcoming events</Text>
        )}
      </Pressable>
      {syncing && <ActivityIndicator size="small" color={t.muted} accessibilityLabel="Syncing" testID="status-sync" />}
      {failed.length > 0 && (
        <Pressable
          onPress={sheets.openCalendars}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={failed.map((a) => `${a.label}: ${a.error}`).join('. ')}
          testID="status-error"
        >
          <Text style={[styles.text, { color: t.red }]}>✕ sync error</Text>
        </Pressable>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    height: 30, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth
  },
  event: { flex: 1, minWidth: 0, justifyContent: 'center', height: '100%' },
  text: { fontFamily: fonts.mono, fontSize: fonts.size.xs + 1 }
})
