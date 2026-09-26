import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, FadeOut, LinearTransition, SlideOutRight } from 'react-native-reanimated'
import { addDays } from 'date-fns'
import type { CalEvent } from '@mysticals/core/shared/types'
import { pendingInvites } from '@mysticals/core/logic/details'
import { errorText } from '@mysticals/core/logic/editor'
import { visibleEvents } from '@mysticals/core/logic/visible'
import { api } from '../api'
import { groupByDay, inviteKey } from '../components/invites/group'
import { InviteRow, type Reply } from '../components/invites/InviteRow'
import { useCalendarData } from '../hooks/useCalendarData'
import { toast } from '../state/bus'
import { sheets } from '../state/sheets'
import { fonts, motion, space, useTheme } from '../theme'

const layout = LinearTransition.duration(motion.normal)

/** Invites inbox (desktop status-bar panel): unanswered invites of the next 60 days, grouped by day. */
export default function InvitesSheet(): React.JSX.Element {
  const t = useTheme()
  const { accounts, calendars, loaded } = useCalendarData()
  const [all, setAll] = useState<CalEvent[] | null>(null)
  // Answered rows leave at once; one comes back if its reply fails.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let live = true
    let seq = 0
    const load = (): void => {
      const my = ++seq
      const now = new Date()
      api.events
        .list({ start: now.toISOString(), end: addDays(now, 60).toISOString() })
        // Drop stale responses so a slow reload can't overwrite a newer one.
        .then((events) => live && my === seq && setAll(pendingInvites(events, now)))
        .catch(console.error)
    }
    load()
    const off = api.onChanged(load)
    return () => {
      live = false
      off()
    }
  }, [])

  // Hidden calendars are only known once calendars load; show nothing until then.
  const ready = loaded && all !== null
  const days = useMemo(
    () => (loaded && all ? groupByDay(visibleEvents(all, calendars).filter((e) => !answered.has(inviteKey(e)))) : []),
    [loaded, all, calendars, answered]
  )

  const reply = useCallback((e: CalEvent, status: Reply) => {
    const k = inviteKey(e)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setAnswered((s) => new Set(s).add(k))
    api.events.respond(e, status).catch((err) => {
      setAnswered((s) => new Set([...s].filter((x) => x !== k)))
      toast({ text: errorText(err), error: true })
    })
  }, [])

  // Dev-only: scripts/e2e.mjs answers an invite by title through the same handler as the buttons.
  const latest = useRef(days)
  latest.current = days
  useEffect(() => {
    if (!__DEV__) return
    Object.assign((globalThis as { __e2e?: object }).__e2e ?? {}, {
      replyInvite: (title: string, status: Reply = 'accepted') => {
        const e = latest.current.flatMap((d) => d.events).find((x) => x.title === title)
        if (!e) throw new Error(`no pending invite "${title}"`)
        reply(e, status)
      }
    })
  }, [reply])

  const accountOf = (id: string) => accounts.find((a) => a.id === id)

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={[styles.title, { color: t.muted }]}>Invitations</Text>
      {ready && days.length === 0 && (
        <Animated.Text entering={FadeIn.duration(motion.normal)} style={[styles.empty, { color: t.muted }]}>
          No pending invitations
        </Animated.Text>
      )}
      {days.map((d) => (
        <Animated.View key={d.day} layout={layout} exiting={FadeOut.duration(motion.fast)}>
          <Text style={[styles.day, { color: t.fg }]}>{d.label}</Text>
          {d.events.map((e) => (
            <Animated.View key={inviteKey(e)} layout={layout} exiting={SlideOutRight.duration(motion.normal)}>
              <InviteRow event={e} account={accountOf(e.accountId)} onOpen={sheets.openEvent} onReply={reply} />
            </Animated.View>
          ))}
        </Animated.View>
      ))}
      <View style={styles.pad} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { paddingTop: space.xl },
  title: { fontFamily: fonts.mono, fontSize: fonts.size.sm, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: space.lg, paddingBottom: space.sm },
  day: { fontFamily: fonts.mono, fontSize: fonts.size.sm, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  empty: { fontFamily: fonts.mono, fontSize: fonts.size.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  pad: { height: space.xl }
})
