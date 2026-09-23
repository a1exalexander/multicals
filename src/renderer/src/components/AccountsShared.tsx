import { useEffect, useRef } from 'react'
import './Accounts.css'

export const SWATCHES = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#ff375f', '#64d2ff', '#8e8e93']

export const PRESETS = [
  { id: 'privateemail', name: 'Namecheap Private Email', url: 'https://dav.privateemail.com/caldav' },
  { id: 'icloud', name: 'iCloud', url: 'https://caldav.icloud.com/' },
  { id: 'fastmail', name: 'Fastmail', url: 'https://caldav.fastmail.com/' },
  { id: 'custom', name: 'Custom', url: '' }
] as const

const PERSONAL_DOMAINS = /^(gmail|googlemail|icloud|me|mac|outlook|hotmail|live|yahoo|fastmail|proton|protonmail|aol|gmx|ukr)\./i

/** "Personal" for well-known consumer mail domains, otherwise "Work". */
export function suggestLabel(email: string): string {
  const domain = email.split('@')[1] ?? ''
  if (!domain) return ''
  return PERSONAL_DOMAINS.test(domain) ? 'Personal' : 'Work'
}

/** Strips Electron's "Error invoking remote method 'x': Error: " prefix. */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '')
}

export function Sheet(props: {
  open: boolean
  onClose: () => void
  title: string
  testId: string
  children: React.ReactNode
}): React.JSX.Element | null {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (props.open && d && !d.open) d.showModal()
  }, [props.open])
  if (!props.open) return null
  return (
    <dialog
      ref={ref}
      className="acc-sheet"
      data-testid={props.testId}
      aria-label={props.title}
      onCancel={(e) => {
        e.preventDefault()
        props.onClose()
      }}
    >
      <header className="acc-sheet-head">
        <h2>{props.title}</h2>
        <button type="button" className="acc-close" aria-label="Close" onClick={props.onClose}>
          ×
        </button>
      </header>
      {props.children}
    </dialog>
  )
}

export function Swatches(props: { value: string; onChange: (c: string) => void; name: string }): React.JSX.Element {
  return (
    <div className="acc-swatches" role="radiogroup" aria-label={props.name}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={props.value === c}
          aria-label={c}
          className="acc-swatch"
          style={{ background: c }}
          onClick={() => props.onChange(c)}
        />
      ))}
    </div>
  )
}

export function KindIcon({ kind }: { kind: 'google' | 'caldav' }): React.JSX.Element {
  return (
    <span className={`acc-kind acc-kind-${kind}`} title={kind === 'google' ? 'Google' : 'CalDAV'}>
      {kind === 'google' ? 'G' : 'DAV'}
    </span>
  )
}
