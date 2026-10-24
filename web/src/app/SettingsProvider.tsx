import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api, type Settings } from '../lib/api'
import { queryKeys } from '../lib/queries'
import { formatDate, formatMoney } from '../lib/format'
import { SettingsContext, type SettingsContextValue } from './settings-context'

const DEFAULT_SETTINGS: Settings = { partner_name: '', currency: 'BRL', locale: 'pt-BR' }

/**
 * Loads the settings once and shares them, together with formatters bound to the
 * configured locale and currency. The UI language follows the locale setting.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const query = useQuery({ queryKey: queryKeys.settings, queryFn: api.getSettings })
  const settings = query.data ?? DEFAULT_SETTINGS
  const { locale, currency } = settings

  useEffect(() => {
    void i18n.changeLanguage(locale)
    document.documentElement.lang = locale
  }, [i18n, locale])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: { partner_name: settings.partner_name, currency, locale },
      error: query.error,
      retry: () => void query.refetch(),
      formatMoney: (cents) => formatMoney(cents, locale, currency),
      formatDate: (iso) => formatDate(iso, locale),
    }),
    [settings.partner_name, currency, locale, query],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
