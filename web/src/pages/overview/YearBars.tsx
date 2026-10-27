import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import PlanBars from '../../components/charts/PlanBars'
import { SegmentedControl } from '../../components/ui'
import type { MonthSummary } from '../../lib/api'
import { planBars, type View } from '../../lib/chart-data'
import { formatCompactMoney, shortMonthName } from '../../lib/format'

type Measure = 'income' | 'expense'

/** The year month by month: solid for what is confirmed, hatched for what is still planned. */
export default function YearBars({ year, months, view }: { year: number; months: MonthSummary[]; view: View }) {
  const { t } = useTranslation()
  const { settings, formatMoney } = useSettings()
  const [measure, setMeasure] = useState<Measure>('expense')
  const measureLabel = t(`overview.year.${measure}`)

  return (
    <section aria-labelledby="overview-year">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="overview-year" className="text-xl font-semibold tracking-tight">
          {t('overview.year.title')}
        </h2>
        <SegmentedControl
          label={t('overview.year.measure')}
          value={measure}
          onChange={setMeasure}
          options={[
            { value: 'expense', label: t('overview.year.expense') },
            { value: 'income', label: t('overview.year.income') },
          ]}
        />
      </div>
      <PlanBars
        bars={planBars(months, view, measure)}
        color={measure === 'income' ? 'var(--income)' : 'var(--expense)'}
        label={t('overview.year.label', { measure: measureLabel, year })}
        legend={{ realized: t('overview.year.realized'), pending: t('overview.year.planned') }}
        format={formatMoney}
        formatTick={(cents) => formatCompactMoney(cents, settings.locale, settings.currency)}
        monthLabel={(m) => shortMonthName(m, settings.locale)}
      />
    </section>
  )
}
