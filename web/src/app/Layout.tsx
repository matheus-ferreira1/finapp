import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { useSettings } from './settings-context'

const TABS = [
  { to: '/transactions', key: 'nav.transactions' },
  { to: '/summary', key: 'nav.summary' },
  { to: '/spending', key: 'nav.spending' },
  { to: '/recurrences', key: 'nav.recurrences' },
  { to: '/settings', key: 'nav.settings' },
] as const

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100',
  ].join(' ')

export default function Layout() {
  const { t } = useTranslation()
  const { error, retry } = useSettings()

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pt-3 sm:flex-row sm:items-end sm:gap-8">
          <span className="pb-2 text-lg font-semibold tracking-tight">{t('app.name')}</span>
          <nav aria-label={t('nav.label')} className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map(({ to, key }) => (
              <NavLink key={to} to={to} className={tabClass}>
                {t(key)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <span>{t('errors.server')}</span>
          <button
            type="button"
            onClick={retry}
            className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
          >
            {t('actions.retry')}
          </button>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
