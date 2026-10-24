import { createContext, useContext } from 'react'
import type { Settings } from '../lib/api'

export interface SettingsContextValue {
  settings: Settings
  /** Set when the settings could not be loaded; the defaults are used meanwhile. */
  error: Error | null
  retry: () => void
  formatMoney: (cents: number) => string
  formatDate: (iso: string) => string
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>')
  return value
}
