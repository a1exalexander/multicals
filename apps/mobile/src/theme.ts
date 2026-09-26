import { File, Paths } from 'expo-file-system'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

/** Same dark palettes as the desktop app (apps/desktop/src/renderer/src/styles/base.css). */
export const PALETTES = {
  dracula: {
    name: 'Dracula',
    bg: '#0b0b10', surface: '#111118', surface2: '#181822', hover: '#1d1d29', line: '#1f1f2b', lineStrong: '#2d2d3d',
    fg: '#f8f8f2', muted: '#6272a4', faint: '#3c4460', accent: '#bd93f9', pink: '#ff79c6', green: '#50fa7b',
    cyan: '#8be9fd', orange: '#ffb86c', red: '#ff5555', yellow: '#f1fa8c'
  },
  tokyo: {
    name: 'Tokyo Night',
    bg: '#09090d', surface: '#101118', surface2: '#171923', hover: '#1c1e2b', line: '#1c1e2b', lineStrong: '#2a2d42',
    fg: '#c0caf5', muted: '#565f89', faint: '#363b57', accent: '#7aa2f7', pink: '#bb9af7', green: '#9ece6a',
    cyan: '#7dcfff', orange: '#ff9e64', red: '#f7768e', yellow: '#e0af68'
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    bg: '#0a0a10', surface: '#11111a', surface2: '#191925', hover: '#20202f', line: '#212132', lineStrong: '#2f2f45',
    fg: '#cdd6f4', muted: '#6c7086', faint: '#45475a', accent: '#cba6f7', pink: '#f5c2e7', green: '#a6e3a1',
    cyan: '#89dceb', orange: '#fab387', red: '#f38ba8', yellow: '#f9e2af'
  },
  amber: {
    name: 'Phosphor amber',
    bg: '#0a0806', surface: '#100d08', surface2: '#18130c', hover: '#21190f', line: '#241d12', lineStrong: '#3a2f1c',
    fg: '#ffcc66', muted: '#8a6a33', faint: '#4d3b1d', accent: '#ffb000', pink: '#ff6a00', green: '#9fd67a',
    cyan: '#d4a24c', orange: '#ff9a3c', red: '#ff4d2e', yellow: '#ffe08a'
  }
} as const

export type ThemeId = keyof typeof PALETTES
export type Palette = { [K in keyof (typeof PALETTES)['dracula']]: string }
export interface Theme extends Palette {
  id: ThemeId
  onAccent: string
  today: string
}

/** Account colour swatches (desktop AccountsShared SWATCHES). */
export const SWATCHES = ['#bd93f9', '#50fa7b', '#8be9fd', '#ff79c6', '#ffb86c', '#f1fa8c', '#ff5555', '#6272a4']

export const fonts = {
  /** Labels, times, buttons: the desktop's mono accents. */
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  size: { xs: 10, sm: 12, md: 15, lg: 17, xl: 22, title: 28 }
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const
export const radius = { sm: 4, md: 8, lg: 12, sheet: 16 } as const

/** Time grid geometry (desktop: 48px/hour, 15-min snap, min rendered length 22 min). */
export const grid = { hourHeight: 56, gutter: 48, minEventMin: 22 } as const

/** Reanimated springs/timings: short, critically damped, never bouncy on layout. */
export const motion = {
  spring: { damping: 26, stiffness: 320, mass: 1 },
  snappy: { damping: 30, stiffness: 500, mass: 0.8 },
  fast: 140,
  normal: 220
} as const

const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** CSS color-mix(in srgb, a pct%, b). */
export function mix(a: string, pct: number, b: string): string {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  const p = pct / 100
  const c = (x: number, y: number): string => Math.round(x * p + y * (1 - p)).toString(16).padStart(2, '0')
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`
}

/** Event block colours like desktop: bg tinted 15% with the calendar colour, text 60% colour into fg, solid left border. */
export const eventColors = (t: Theme, color: string): { bg: string; text: string; border: string } => ({
  bg: mix(color, 15, t.bg),
  text: mix(color, 60, t.fg),
  border: color
})

const build = (id: ThemeId): Theme => ({ ...PALETTES[id], id, onAccent: PALETTES[id].bg, today: PALETTES[id].pink })

// Per-device preference in the app's documents dir.
const file = (): File => new File(Paths.document, 'theme.txt')
function read(): ThemeId {
  try {
    const v = file().exists ? file().textSync().trim() : ''
    if (v in PALETTES) return v as ThemeId
  } catch {
    // unreadable: default
  }
  return 'dracula'
}

let current = build(read())
const subs = new Set<() => void>()

export function setTheme(id: ThemeId): void {
  current = build(id)
  try {
    file().write(id)
  } catch {
    // preference only
  }
  subs.forEach((f) => f())
}

export const useTheme = (): Theme =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    () => current
  )
