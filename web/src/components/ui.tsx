import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { categoryColor } from '../lib/category-colors'

const BUTTON_STYLES = {
  primary: 'bg-ink text-paper hover:opacity-90',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-ink/5',
} as const

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_STYLES }) {
  return (
    <button
      type="button"
      className={`rounded-control px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  )
}

const CONTROL_CLASS = 'rounded-control bg-surface px-3 py-1.5 text-sm text-ink ring-1 ring-line'

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL_CLASS} ${className}`} {...props} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL_CLASS} ${className}`} {...props} />
}

/** A labelled form control. The label wraps the control, so it names it for assistive tech. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink-muted">
      {label}
      {children}
    </label>
  )
}

export function ErrorMessage({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm font-medium text-expense">
      {message}
    </p>
  )
}

/** A titled region of a screen. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <h2 id={id} className="mb-3 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs text-ink-muted">{children}</span>
}

/** A category name led by the colour the category has on every screen. */
export function CategoryChip({ id, name }: { id: number | null; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden className="size-2.5 rounded-full" style={{ background: categoryColor(id) }} />
      {name}
    </span>
  )
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

/** A few mutually exclusive choices that are always visible, instead of a dropdown. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control bg-ink/5 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded-[0.375rem] px-3 py-1 text-sm font-medium transition-colors ${
            option.value === value ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Content hidden until asked for, like the exact table behind a chart. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group mt-4">
      <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A panel sliding in from the right. It is a modal <dialog>, so the browser traps focus,
 * closes it on Escape and returns focus to the element that opened it.
 */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open === open) return
    if (!open) return dialog.close?.() ?? dialog.removeAttribute('open')
    if (dialog.showModal) dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-0 ml-auto h-full max-h-none w-full max-w-md bg-paper p-6 text-ink shadow-none ring-1 ring-line backdrop:bg-ink/30"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id={titleId} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <Button onClick={onClose}>×</Button>
      </div>
      {open && children}
    </dialog>
  )
}

/** Style of an editable cell: plain text until hovered or focused. */
export const CELL_CLASS =
  'w-full min-w-0 rounded-control bg-transparent px-2 py-1 text-sm hover:bg-ink/5 focus:bg-surface focus:outline-2 focus:outline-shared disabled:opacity-40'
