import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Account, CalEvent } from '@mysticals/core/shared/types'
import { ownerLine } from '@mysticals/core/logic/details'
import { fonts, radius, space, useTheme } from '../../theme'
import { inviteTime } from './group'

export type Reply = 'accepted' | 'declined'

/** One pending invite (desktop Invites panel row): tap opens details, Accept/Decline answer through its account. */
export const InviteRow = memo(function InviteRow({
  event: e,
  account: a,
  onOpen,
  onReply
}: {
  event: CalEvent
  account?: Account
  onOpen: (e: CalEvent) => void
  onReply: (e: CalEvent, status: Reply) => void
}): React.JSX.Element {
  const t = useTheme()
  const color = a?.color ?? t.accent
  const owner = ownerLine(undefined, a?.label ?? e.accountId, a?.email)
  const organizer = e.organizer?.name || e.organizer?.email
  return (
    <View style={[styles.row, { borderTopColor: t.line, borderLeftColor: color }]}>
      <Pressable onPress={() => onOpen(e)} accessibilityRole="button" style={({ pressed }) => [styles.open, pressed && { opacity: 0.6 }]}>
        <Text style={[styles.name, { color: t.fg }]} numberOfLines={2}>
          {e.title || 'Untitled'}
        </Text>
        <Text style={[styles.mono, { color: t.muted }]}>{inviteTime(e)}</Text>
        {!!organizer && (
          <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
            from {organizer}
          </Text>
        )}
        <View style={styles.acc}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.mono, { color: t.muted, flexShrink: 1 }]} numberOfLines={1}>
            {owner.label}
            {owner.email ? ` · ${owner.email}` : ''}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onReply(e, 'accepted')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, { backgroundColor: t.accent, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.btnText, { color: t.onAccent }]}>Accept</Text>
        </Pressable>
        <Pressable
          onPress={() => onReply(e, 'declined')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, { borderColor: t.lineStrong, borderWidth: 1, backgroundColor: pressed ? t.hover : 'transparent' }]}
        >
          <Text style={[styles.btnText, { color: t.fg }]}>Decline</Text>
        </Pressable>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  row: { paddingVertical: space.md, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: 2, gap: space.md },
  open: { gap: 3 },
  name: { fontSize: fonts.size.md, fontWeight: '600' },
  mono: { fontFamily: fonts.mono, fontSize: fonts.size.sm - 1 },
  meta: { fontSize: fonts.size.sm },
  acc: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
  btn: { flex: 1, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.mono, fontSize: fonts.size.sm, fontWeight: '600' }
})
