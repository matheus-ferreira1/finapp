import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '../components/ui'
import { useSettings } from './settings-context'

// 24x24 stroke paths, one per destination.
// `more` destinations sit behind a "More" button on small screens, where the bar has little room.
const TABS = [
  { to: '/overview', key: 'nav.overview', icon: 'M4 13a8 8 0 0 1 16 0M12 13l4-4M5 20h14', more: false },
  { to: '/transactions', key: 'nav.transactions', more: false, icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/summary', key: 'nav.summary', more: false, icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/spending', key: 'nav.spending', more: false, icon: 'M12 3a9 9 0 1 0 9 9h-9V3z' },
  { to: '/recurrences', key: 'nav.recurrences', more: true, icon: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5' },
  { to: '/settings', key: 'nav.settings', more: true, icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6' },
] as const

/** A bar item (`more` ones hide on small screens), or an item of the More menu. */
type TabKind = 'bar' | 'more' | 'menu'

const tabClass = (isActive: boolean, kind: TabKind) =>
  [
    'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors',
    kind === 'menu' ? '' : 'max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:gap-0.5 max-md:px-1 max-md:text-xs',
    kind === 'more' ? 'max-md:hidden' : '',
    isActive ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
  ].join(' ')

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

/** Small screens only: the destinations that do not fit in the bar. */
function MoreMenu() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const items = TABS.filter((tab) => tab.more)
  const active = items.some((tab) => pathname.startsWith(tab.to))

  return (
    <div className="relative flex max-md:min-w-0 max-md:flex-1 md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="more-menu"
        onClick={() => setOpen(!open)}
        className={`${tabClass(active, 'bar')} w-full`}
      >
        <Icon path="M5 12h.01M12 12h.01M19 12h.01" />
        <span>{t('nav.more')}</span>
      </button>
      {open && (
        <ul id="more-menu" className="absolute right-0 bottom-full mb-2 min-w-48 rounded-panel bg-surface p-1 ring-1 ring-line">
          {items.map(({ to, key, icon }) => (
            <li key={to}>
              <NavLink to={to} onClick={() => setOpen(false)} className={({ isActive }) => tabClass(isActive, 'menu')}>
                <Icon path={icon} />
                {t(key)}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Layout() {
  const { t } = useTranslation()
  const { error, retry } = useSettings()

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[14rem_1fr]">
      <aside className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:sticky md:top-0 md:h-screen md:border-t-0 md:border-r md:p-4">
        <span className="mb-6 hidden font-display text-2xl font-bold tracking-tight md:block">{t('app.name')}</span>
        <nav aria-label={t('nav.label')} className="flex gap-1 md:flex-col">
          {TABS.map(({ to, key, icon, more }) => (
            <NavLink key={to} to={to} className={({ isActive }) => tabClass(isActive, more ? 'more' : 'bar')}>
              <Icon path={icon} />
              <span className="max-md:text-center max-md:leading-tight">{t(key)}</span>
            </NavLink>
          ))}
          <MoreMenu />
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
