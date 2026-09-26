/** Tiny UI event bus (desktop bus.ts). Navigation goes through state/sheets.ts instead. */
export interface BusEvents {
  /** Short notice at the bottom (e.g. "Event moved · Undo"); replaces the one shown. */
  toast: { text: string; error?: boolean; action?: { label: string; run: () => void } }
  /** Optimistic calendar show/hide, applied locally before the write settles. */
  'calendars:visible': { accountId: string; calendarId: string; visible: boolean }
}

type Handler<K extends keyof BusEvents> = (payload: BusEvents[K]) => void
const handlers = new Map<keyof BusEvents, Set<Handler<never>>>()

export const bus = {
  emit<K extends keyof BusEvents>(type: K, payload: BusEvents[K]): void {
    handlers.get(type)?.forEach((h) => (h as Handler<K>)(payload))
  },
  on<K extends keyof BusEvents>(type: K, h: Handler<K>): () => void {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(h as Handler<never>)
    return () => handlers.get(type)!.delete(h as Handler<never>)
  }
}

export const toast = (payload: BusEvents['toast']): void => bus.emit('toast', payload)
