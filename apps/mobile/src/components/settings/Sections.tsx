// Settings sections; desktop Settings.tsx tabs (Accounts / Themes / Sync / Privacy) laid out as one iOS grouped list, plus About.
import type { Account } from '@mysticals/core/shared/types'
import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { memo, useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api } from '../../api'
import { toast } from '../../state/bus'
import { PALETTES, fonts, radius, setTheme, space, useTheme, type ThemeId } from '../../theme'
import { errorText } from '../accounts/logic'
import { Button, ErrorBox, KindIcon, Note, Swatches, devHook, styles as ui } from '../accounts/ui'
import { syncedText } from './logic'

/** Asks before removing; also driven by the e2e hook. */
export function confirmRemove(a: Account): void {
  Alert.alert('Remove account?', `Removes local data and credentials for ${a.email}. Nothing is deleted on the server.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove',
      style: 'destructive',
      onPress: () =>
        // Promise.resolve().then: a synchronous throw lands in the error toast too.
        Promise.resolve()
          .then(() => api.accounts.remove(a.id))
          .then(
          () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            toast({ text: `Removed ${a.label || a.email}` })
          },
          (e) => toast({ text: errorText(e), error: true })
        )
    }
  ])
}

export function AccountsSection({ accounts }: { accounts: Account[] }): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={s.stack}>
      {accounts.length === 0 && <Note>No accounts yet.</Note>}
      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/accounts/add')}
        style={({ pressed }) => [s.item, s.addRow, { borderColor: t.lineStrong, backgroundColor: pressed ? t.hover : t.bg }]}
      >
        <Text style={[ui.mono, { color: t.accent }]}>+ Add account…</Text>
      </Pressable>
    </View>
  )
}

const AccountRow = memo(function AccountRow({ account: a }: { account: Account }): React.JSX.Element {
  const t = useTheme()
  const [label, setLabel] = useState(a.label)
  const [error, setError] = useState('')
  useEffect(() => setLabel(a.label), [a.label])

  const run = (fn: () => Promise<unknown>): void => {
    setError('')
    Promise.resolve()
      .then(fn)
      .catch((e) => {
        setLabel(a.label)
        setError(errorText(e))
      })
  }
  const rename = (): void => {
    const next = label.trim()
    if (!next) return setLabel(a.label)
    if (next !== a.label) run(() => api.accounts.update(a.id, { label: next }))
  }

  return (
    <View style={[s.item, { borderColor: t.lineStrong, backgroundColor: t.bg }]}>
      <View style={s.head}>
        <View style={[s.dot, { backgroundColor: a.color }]} />
        <KindIcon kind={a.kind} />
        <View style={s.id}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            onEndEditing={rename}
            placeholder={a.email}
            placeholderTextColor={t.faint}
            returnKeyType="done"
            autoCorrect={false}
            accessibilityLabel={`Label for ${a.email}`}
            style={[s.rename, { color: t.fg }]}
          />
          <Text style={[s.email, { color: t.muted }]} numberOfLines={1}>
            {a.email}
          </Text>
        </View>
        <Button label="Remove" danger onPress={() => confirmRemove(a)} style={s.small} />
      </View>
      <View style={s.indent}>
        <Swatches value={a.color} name={`Colour for ${a.email}`} onChange={(color) => run(() => api.accounts.update(a.id, { color }))} />
      </View>
      <ErrorBox text={error} />
    </View>
  )
})

export function ThemesSection(): React.JSX.Element {
  const t = useTheme()
  const pick = (id: ThemeId): void => {
    if (id === t.id) return
    void Haptics.selectionAsync()
    setTheme(id)
  }
  useEffect(() => devHook('themes', { pick }))
  return (
    <View style={s.grid} accessibilityRole="radiogroup" accessibilityLabel="Theme">
      {(Object.keys(PALETTES) as ThemeId[]).map((id) => {
        const p = PALETTES[id]
        const on = t.id === id
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={p.name}
            onPress={() => pick(id)}
            style={[s.theme, { backgroundColor: t.bg, borderColor: on ? t.accent : t.lineStrong, borderWidth: on ? 2 : 1 }]}
          >
            <View style={[s.preview, { backgroundColor: p.bg, borderColor: p.lineStrong }]}>
              {[p.accent, p.pink, p.cyan, p.green].map((c) => (
                <View key={c} style={[s.bar, { backgroundColor: c }]} />
              ))}
            </View>
            <View style={s.themeName}>
              <Text style={[ui.mono, { color: t.fg, fontSize: 11.5, flex: 1 }]} numberOfLines={1}>
                {p.name}
              </Text>
              {on && <Text style={{ color: t.accent, fontWeight: '700' }}>✓</Text>}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/** When this device last finished a sync per account (the core Account carries no timestamp). */
const lastSync = new Map<string, number>()

export function SyncSection({ accounts }: { accounts: Account[] }): React.JSX.Element {
  const [all, setAll] = useState(false)
  // Re-render every 30 s so "5 min ago" stays true while the sheet is open.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const syncAll = async (): Promise<void> => {
    setAll(true)
    try {
      // Per-account failures land on account.error; a rejection means nothing synced.
      await api.sync.now()
      const now = Date.now()
      accounts.forEach((a) => lastSync.set(a.id, now))
      tick((n) => n + 1)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e) {
      toast({ text: errorText(e), error: true })
    }
    setAll(false)
  }
  useEffect(() => devHook('sync', { syncAll }))
  return (
    <View style={s.stack}>
      <Note>Accounts sync automatically every 2 minutes and whenever the app is opened.</Note>
      {accounts.map((a) => (
        <SyncRow key={a.id} account={a} busy={all} onSynced={() => tick((n) => n + 1)} />
      ))}
      <Button label={all ? 'Syncing…' : 'Sync all'} primary disabled={all || accounts.length === 0} onPress={() => void syncAll()} style={s.end} />
    </View>
  )
}

// lastSync isn't state: onSynced re-renders the section, since a fast sync can batch syncing true→false into no render at all.
function SyncRow({ account: a, busy, onSynced }: { account: Account; busy: boolean; onSynced: () => void }): React.JSX.Element {
  const t = useTheme()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  // "Sync all" supersedes a stale per-row error; its outcome lands on a.error.
  useEffect(() => {
    if (busy) setError('')
  }, [busy])
  const sync = async (): Promise<void> => {
    setSyncing(true)
    setError('')
    try {
      await api.sync.now(a.id)
      lastSync.set(a.id, Date.now())
      onSynced()
    } catch (e) {
      setError(errorText(e))
    }
    setSyncing(false)
  }
  const failed = Boolean(error || a.error)
  const status = syncing || busy ? 'syncing…' : syncedText({ ...a, error: error || a.error }, lastSync.get(a.id))
  return (
    <View style={[s.item, { borderColor: t.lineStrong, backgroundColor: t.bg }]}>
      <View style={s.head}>
        <View style={[s.dot, { backgroundColor: a.color }]} />
        <KindIcon kind={a.kind} />
        <View style={s.id}>
          <Text style={{ color: t.fg, fontWeight: '600', fontSize: fonts.size.md }} numberOfLines={1}>
            {a.label || a.email}
          </Text>
          <Text style={[s.email, { color: failed ? t.red : a.synced || lastSync.has(a.id) ? t.green : t.muted }]}>● {status}</Text>
        </View>
        <Button label="Sync now" onPress={() => void sync()} disabled={syncing || busy} style={s.small} />
      </View>
      {failed && <ErrorBox text={error || `Last sync failed: ${a.error}`} />}
    </View>
  )
}

export function PrivacySection(): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={s.stack}>
      <Note>No analytics are collected on this device. Your accounts, calendars and events stay between this phone and your calendar servers.</Note>
      <Pressable hitSlop={8} accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync('https://mysticals.sashkoratushnyi.com/privacy/')}>
        <Text style={[ui.mono, { color: t.cyan }]}>Privacy policy</Text>
      </Pressable>
    </View>
  )
}

export function AboutSection(): React.JSX.Element {
  const t = useTheme()
  return (
    <View style={[s.item, s.about, { borderColor: t.lineStrong, backgroundColor: t.bg }]}>
      <Text style={{ color: t.fg, fontSize: fonts.size.md, fontWeight: '600' }}>Mysticals</Text>
      <Text style={[ui.mono, { color: t.muted }]}>v{Constants.expoConfig?.version ?? '?'}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  stack: { gap: space.md },
  item: { gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.md },
  addRow: { alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 9, height: 9, borderRadius: 2 },
  id: { flex: 1, minWidth: 0 },
  rename: { fontSize: fonts.size.md, fontWeight: '600', paddingVertical: 2 },
  email: { fontFamily: fonts.mono, fontSize: 11, marginTop: 2 },
  small: { height: 30, paddingHorizontal: space.md },
  indent: { paddingLeft: 59 },
  end: { alignSelf: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  theme: { flexBasis: '46%', flexGrow: 1, gap: space.sm, padding: 10, borderRadius: radius.md },
  preview: { flexDirection: 'row', gap: 4, height: 44, padding: 8, borderRadius: radius.sm, borderWidth: 1 },
  bar: { flex: 1, borderRadius: 2 },
  themeName: { flexDirection: 'row', alignItems: 'center' },
  about: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
})
