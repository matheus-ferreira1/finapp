import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '../components/ui'
import { useSettings } from './settings-context'

// 24x24 stroke paths, one per destination.
const TABS = [
  { to: '/transactions', key: 'nav.transactions', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/summary', key: 'nav.summary', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/spending', key: 'nav.spending', icon: 'M12 3a9 9 0 1 0 9 9h-9V3z' },
  { to: '/recurrences', key: 'nav.recurrences', icon: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5' },
  { to: '/settings', key: 'nav.settings', icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6' },
] as const

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
    'max-md:flex-1 max-md:flex-col max-md:gap-0.5 max-md:px-1 max-md:text-xs',
    isActive ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
  ].join(' ')

export default function Layout() {
  const { t } = useTranslation()
  const { error, retry } = useSettings()

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[14rem_1fr]">
      <aside className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:sticky md:top-0 md:h-screen md:border-t-0 md:border-r md:p-4">
        <span className="mb-6 hidden font-display text-2xl font-bold tracking-tight md:block">{t('app.name')}</span>
        <nav aria-label={t('nav.label')} className="flex gap-1 md:flex-col">
          {TABS.map(({ to, key, icon }) => (
            <NavLink key={to} to={to} className={tabClass}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
              <span className="max-md:truncate">{t(key)}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {error && (
          <div
            role="alert"
            className="mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded-panel bg-expense/10 px-4 py-3 text-sm font-medium text-expense ring-1 ring-expense/30"
          >
            <span>{t('errors.server')}</span>
            <Button onClick={retry}>{t('actions.retry')}</Button>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
