import type { Account } from '@mysticals/core/shared/types'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { api } from '../api'
import { SheetHeader, SectionTitle, devHook } from '../components/accounts/ui'
import { AboutSection, AccountsSection, PrivacySection, SyncSection, ThemesSection, confirmRemove } from '../components/settings/Sections'
import { space } from '../theme'

type SectionId = 'accounts' | 'themes' | 'sync' | 'privacy' | 'about'

/** Settings sheet: desktop Settings tabs as sections of one scrolling list. */
export default function SettingsScreen(): React.JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const scroll = useRef<ScrollView>(null)
  const offsets = useRef<Partial<Record<SectionId, number>>>({})

  useEffect(() => {
    // Only the latest request wins, so a slow older list can't resurrect a removed account.
    let seq = 0
    const load = (): void => {
      const n = ++seq
      api.accounts.list().then((a) => n === seq && setAccounts(a), () => {})
    }
    load()
    return api.onChanged(load)
  }, [])

  useEffect(() =>
    devHook('settings', {
      scrollTo: (id: SectionId) => scroll.current?.scrollTo({ y: Math.max(0, (offsets.current[id] ?? 0) - space.lg), animated: false }),
      remove: (id: string) => {
        const a = accounts.find((x) => x.id === id)
        if (a) confirmRemove(a)
      }
    })
  )

  const section = (id: SectionId, title: string, body: React.ReactNode): React.JSX.Element => (
    <View onLayout={(e) => (offsets.current[id] = e.nativeEvent.layout.y)}>
      <SectionTitle>{title}</SectionTitle>
      {body}
    </View>
  )

  return (
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <SheetHeader title="Settings" />
      {section('accounts', 'Accounts', <AccountsSection accounts={accounts} />)}
      {section('themes', 'Themes', <ThemesSection />)}
      {section('sync', 'Sync', <SyncSection accounts={accounts} />)}
      {section('privacy', 'Privacy', <PrivacySection />)}
      {section('about', 'About', <AboutSection />)}
    </ScrollView>
  )
}

const s = StyleSheet.create({ body: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2 } })
