import {
  useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

/* =========================================================== icons ======= */

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H9.5v-5.5h5V21h3a1 1 0 0 0 1-1V9.5" />,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  message: <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-3.5-.7L3 21l1.9-5A8.2 8.2 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  food: <><path d="M5 3v8a2.5 2.5 0 0 0 5 0V3M7.5 11v10" /><path d="M17.5 3c-1.4 1.5-2 3.5-2 5.5s.6 3 2 3.5V21" /></>,
  workout: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  task: <><path d="M20 6 9 17l-5-5" /></>,
  day: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></>,
  heart: <path d="M19.5 5.6a5 5 0 0 0-7.1 0l-.4.4-.4-.4a5 5 0 1 0-7.1 7.1l7.5 7.5 7.5-7.5a5 5 0 0 0 0-7.1Z" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3 3.6M6.2 6.6A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4-.85" /><path d="m2 2 20 20" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  back: <path d="m15 18-6-6 6-6" />,
  next: <path d="m9 6 6 6-6 6" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2.2" /><path d="M5.5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v1" /></>,
  info: <><circle cx="12" cy="12" r="9.2" /><path d="M12 11v5.5M12 7.8v.01" /></>,
  alert: <><path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4M12 17.2v.01" /></>,
  send: <path d="M21.5 3 2 11l7.5 2.5M21.5 3 14 21l-2.2-7.2M21.5 3 9.5 13.5" />,
  pause: <><rect x="7" y="5" width="3.5" height="14" rx="1.2" /><rect x="13.5" y="5" width="3.5" height="14" rx="1.2" /></>,
  scale: <><path d="M12 3v5" /><circle cx="12" cy="12" r="9.2" /><path d="M12 12 8.5 8.5" /></>,
  sparkle: <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.3l-1.8-5.7L4.5 10.8 10.2 9 12 3.5Z" />,
  edit: <><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" /><path d="m14.5 6.5 3.5 3.5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  water: <path d="M12 3s6 6.7 6 11a6 6 0 0 1-12 0c0-4.3 6-11 6-11Z" />,
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />,
  bolt: <path d="M13.5 2 4 14h6.5L10 22l9.5-12H13l.5-8Z" />,
  link: <><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 4.8l-1.7 1.7" /><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.2l1.7-1.7" /></>,
  logout: <><path d="M15 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2.5" /><path d="M10.5 12H21m0 0-3.2-3.2M21 12l-3.2 3.2" /></>,
  book: <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" /><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H19" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" /></>,
  flame: <path d="M12 22c4 0 6.5-2.6 6.5-6 0-4.5-4-6-4-10-2.5 1-3.5 3.5-3.5 5.5C9.5 9 8.5 7.5 8.5 7.5c-1.5 1.7-3 3.9-3 8.5 0 3.4 2.5 6 6.5 6Z" />,
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24, style }: { name: IconName; size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={style}
    >
      {PATHS[name]}
    </svg>
  )
}

/* ========================================================= primitives ==== */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger' | 'plain'
  block?: boolean
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  busy?: boolean
}

export function Button({
  variant = 'plain', block, size = 'md', icon, busy, children, className = '', disabled, ...rest
}: BtnProps) {
  const cls = [
    'btn',
    variant !== 'plain' ? `btn--${variant}` : '',
    block ? 'btn--block' : '',
    size !== 'md' ? `btn--${size}` : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} disabled={disabled || busy} {...rest}>
      {busy ? <span className="spinner" /> : icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </button>
  )
}

export function IconButton({ name, label, ...rest }: { name: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="icon-btn" aria-label={label} {...rest}>
      <Icon name={name} size={22} />
    </button>
  )
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>
}

export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`input ${className}`} {...rest} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea className={`textarea ${className}`} {...rest} />
}

export function Switch({ on, onChange, disabled, label }: {
  on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string
}) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label}
      className="switch" data-on={on} disabled={disabled}
      onClick={() => onChange(!on)}
    />
  )
}

/** A full-width row where the whole row is the tap target. */
export function SwitchRow({ title, desc, on, onChange, disabled, icon }: {
  title: string; desc?: string; on: boolean
  onChange: (v: boolean) => void; disabled?: boolean; icon?: IconName
}) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled}
      className="switch-row" onClick={() => onChange(!on)}
    >
      {icon && (
        <span className="dot" style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}>
          <Icon name={icon} size={19} />
        </span>
      )}
      <span className="grow">
        <span className="bold" style={{ display: 'block' }}>{title}</span>
        {desc && <span className="small muted" style={{ display: 'block', lineHeight: 1.35 }}>{desc}</span>}
      </span>
      <span className="switch" data-on={on} aria-hidden="true" style={{ pointerEvents: 'none' }} />
    </button>
  )
}

export function Chip({ on, children, ...rest }: { on?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`chip ${on ? 'chip--on' : ''}`} aria-pressed={on} {...rest}>
      {children}
    </button>
  )
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit, format }: {
  value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; unit?: string
  format?: (v: number) => string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10) / 10))
  return (
    <div className="stepper">
      <button type="button" className="stepper__btn" aria-label="Less"
        onClick={() => onChange(clamp(value - step))} disabled={value <= min}>-</button>
      <div className="stepper__val" aria-live="polite">
        {format ? format(value) : value}
        {unit && <span className="stepper__unit">{unit}</span>}
      </div>
      <button type="button" className="stepper__btn" aria-label="More"
        onClick={() => onChange(clamp(value + step))} disabled={value >= max}>+</button>
    </div>
  )
}

export function Banner({ kind = 'info', icon, children }: {
  kind?: 'info' | 'warn' | 'error'; icon?: IconName; children: ReactNode
}) {
  const fallback: IconName = kind === 'info' ? 'info' : 'alert'
  return (
    <div className={`banner ${kind !== 'info' ? `banner--${kind}` : ''}`}>
      <Icon name={icon ?? fallback} size={18} />
      <div className="grow">{children}</div>
    </div>
  )
}

export function Empty({ icon = 'sparkle', title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon name={icon} size={26} /></div>
      <div className="bold" style={{ color: 'var(--text-soft)' }}>{title}</div>
      {hint && <div className="small" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function Spinner({ full, label }: { full?: boolean; label?: string }) {
  if (full) {
    return (
      <div className="loading-full">
        <span className="spinner" />
        {label && <span>{label}</span>}
      </div>
    )
  }
  return <span className="spinner" />
}

/* ============================================================== sheet ==== */

export function Sheet({ open, onClose, title, children, action }: {
  open: boolean; onClose: () => void; title?: string
  children: ReactNode; action?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Escape closes; body scroll locks so the page behind doesn't move.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grip" />
        {(title || action) && (
          <div className="sheet__head">
            <h2 className="grow truncate">{title}</h2>
            {action}
            <IconButton name="x" label="Close" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Small confirm dialog - used before anything destructive. */
export function Confirm({ open, title, body, confirmLabel = 'Delete', onConfirm, onCancel }: {
  open: boolean; title: string; body?: string; confirmLabel?: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="stack">
        {body && <p className="muted">{body}</p>}
        <Button variant="danger" block onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="quiet" block onClick={onCancel}>Cancel</Button>
      </div>
    </Sheet>
  )
}

/* ============================================================== toast ==== */

let toastSeq = 0
type ToastMsg = { id: number; text: string; error?: boolean }
const listeners = new Set<(t: ToastMsg) => void>()

export function toast(text: string, error = false) {
  const msg = { id: ++toastSeq, text, error }
  listeners.forEach((l) => l(msg))
}

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMsg | null>(null)

  useEffect(() => {
    const on = (t: ToastMsg) => setMsg(t)
    listeners.add(on)
    return () => { listeners.delete(on) }
  }, [])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg((cur) => (cur?.id === msg.id ? null : cur)), 3200)
    return () => clearTimeout(t)
  }, [msg])

  if (!msg) return null
  return (
    <div className={`toast ${msg.error ? 'toast--error' : ''}`} role="status" aria-live="polite">
      <Icon name={msg.error ? 'alert' : 'check'} size={17} />
      {msg.text}
    </div>
  )
}
