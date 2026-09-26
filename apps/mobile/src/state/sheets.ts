import { router } from 'expo-router'
import type { CalEvent } from '@mysticals/core/shared/types'

/** What the editor opens with: an existing event, or a new one optionally prefilled. */
export type EditorInput = { event: CalEvent } | { start?: string; end?: string; allDay?: boolean }

// Payloads handed to a sheet route; objects don't fit in URL params, so the route reads them once on mount.
let editorInput: EditorInput = {}
const opened = new Map<string, CalEvent>()

export const sheets = {
  /** Details sheet; the route keeps following the live event by id and falls back to this snapshot. */
  openEvent(event: CalEvent): void {
    opened.set(event.id, event)
    router.push({ pathname: '/event/[id]', params: { id: event.id } })
  },
  openedEvent: (id: string): CalEvent | undefined => opened.get(id),
  openEditor(input: EditorInput = {}): void {
    editorInput = input
    router.push('/editor')
  },
  editorInput: (): EditorInput => editorInput,
  openCalendars: (): void => router.push('/calendars'),
  openInvites: (): void => router.push('/invites'),
  openAddAccount: (): void => router.push('/accounts/add'),
  openSettings: (): void => router.push('/settings')
}
