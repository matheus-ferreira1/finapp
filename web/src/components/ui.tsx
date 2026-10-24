import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

const BUTTON_STYLES = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400',
  secondary:
    'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
} as const

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_STYLES }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    />
  )
}

/** A labelled form control. The label wraps the control, so it names it for assistive tech. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {children}
    </label>
  )
}

export function ErrorMessage({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  )
}

/** A titled region of a screen. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <h2 id={id} className="mb-3 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
      {children}
    </span>
  )
}

/** Style of an editable cell: plain text until hovered or focused, like a spreadsheet. */
export const CELL_CLASS =
  'w-full min-w-0 rounded bg-transparent px-2 py-1 text-sm hover:bg-slate-100 focus:bg-white focus:outline-2 focus:outline-emerald-500 disabled:opacity-40 dark:hover:bg-slate-800 dark:focus:bg-slate-900'
