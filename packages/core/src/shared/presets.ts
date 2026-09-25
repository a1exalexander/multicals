/** Built-in CalDAV servers offered by every app; any other server is 'custom'. */
export const CALDAV_PRESETS = [
  { id: 'privateemail', name: 'Private Email', url: 'https://dav.privateemail.com/dav.php/' },
  { id: 'icloud', name: 'iCloud', url: 'https://caldav.icloud.com/' },
  { id: 'fastmail', name: 'Fastmail', url: 'https://caldav.fastmail.com/' }
] as const

/** Preset id of a server URL by host (telemetry sends only this, never a custom URL). */
export const caldavPreset = (serverUrl: string): string =>
  CALDAV_PRESETS.find((p) => new URL(p.url).hostname === new URL(serverUrl).hostname)?.id ?? 'custom'
