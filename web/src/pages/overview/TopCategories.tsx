import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import Sparkline from '../../components/charts/Sparkline'
import { CategoryChip } from '../../components/ui'
import { categoryColor } from '../../lib/category-colors'
import { formatPercentChange } from '../../lib/format'
import type { TopCategory } from '../../lib/overview'

/** The biggest expenses of the month, each with its recent trend and how it moved since last month. */
export default function TopCategories({ categories }: { categories: TopCategory[] }) {
  const { t } = useTranslation()
  const { settings, formatMoney } = useSettings()
  if (categories.length === 0) return null

  return (
    <section aria-labelledby="overview-top" className="rounded-panel bg-surface p-5 ring-1 ring-line">
      <h2 id="overview-top" className="mb-3 text-xl font-semibold tracking-tight">
        {t('overview.top.title')}
      </h2>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c.categoryId} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <CategoryChip id={c.categoryId} name={c.name} />
              <p className="mt-0.5 text-xs text-ink-muted">
                {c.change === null ? t('overview.top.none') : t('overview.top.change', { percent: formatPercentChange(c.change, settings.locale) })}
              </p>
            </div>
            <Sparkline values={c.trend} color={categoryColor(c.categoryId)} label={t('overview.top.trend', { name: c.name })} />
            <span className="w-28 text-right text-sm font-semibold">{formatMoney(c.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
