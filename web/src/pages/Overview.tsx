import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useSettings } from '../app/settings-context'
import FlowChart from '../components/charts/FlowChart'
import PageHeader from '../components/PageHeader'
import { ErrorMessage, SegmentedControl } from '../components/ui'
import { flowTotals, monthFlow, type View } from '../lib/chart-data'
import { longMonthName } from '../lib/format'
import { currentMonth, isValidMonth, monthParts } from '../lib/month'
import { topCategories } from '../lib/overview'
import { errorText, useCategories, useCategoryReport, useMonthlyReport, useTransactions } from '../lib/queries'
import MonthNav from './transactions/MonthNav'
import HeroSentence from './overview/HeroSentence'
import PartnerBalance from './overview/PartnerBalance'
import TopCategories from './overview/TopCategories'
import YearBars from './overview/YearBars'

const VIEWS: View[] = ['gross', 'mine']

export default function Overview() {
  const { t } = useTranslation()
  const { settings, formatMoney } = useSettings()
  const [params, setParams] = useSearchParams()

  const requested = params.get('month')
  const month = isValidMonth(requested) ? requested : currentMonth()
  const { year, month: m } = monthParts(month)
  const view = VIEWS.find((v) => v === params.get('view')) ?? 'gross'

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.set(key, value)
        return updated
      },
      { replace: true },
    )

  const transactions = useTransactions(month)
  const categories = useCategories()
  const monthly = useMonthlyReport(year)
  const spending = useCategoryReport(year, view, 'all')
  // January compares with December, which is in the previous year
  const previousYear = useCategoryReport(year - 1, view, 'all', m === 1)

  const flow = useMemo(() => {
    const names = new Map((categories.data ?? []).map((c) => [c.id, c.name]))
    return monthFlow(transactions.data ?? [], names, view)
  }, [transactions.data, categories.data, view])
  const totals = flowTotals(flow)
  // one message is enough when several requests fail together, as when the server is down
  const failure = [transactions, monthly, spending].find((query) => query.isError)
  const isEmpty = transactions.isSuccess && transactions.data.length === 0

  return (
    <>
      <PageHeader title={t('nav.overview')}>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label={t('overview.views.label')}
            value={view}
            onChange={(next) => setParam('view', next)}
            options={VIEWS.map((v) => ({ value: v, label: t(`overview.views.${v}`) }))}
          />
          <MonthNav month={month} onChange={(next) => setParam('month', next)} />
        </div>
      </PageHeader>

      <ErrorMessage message={failure ? errorText(failure.error) : null} />
      {transactions.isPending && <p className="text-sm text-ink-muted">{t('common.loading')}</p>}

      {isEmpty && (
        <div className="mb-10">
          <p className="mb-4 font-display text-3xl font-bold tracking-tight">{t('overview.empty.message')}</p>
          <Link to={`/transactions?month=${month}`} className="inline-block rounded-control bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90">
            {t('overview.empty.action')}
          </Link>
        </div>
      )}

      {transactions.isSuccess && !isEmpty && (
        <section aria-labelledby="overview-flow" className="mb-12">
          <h2 id="overview-flow" className="sr-only">
            {t('overview.flow.title')}
          </h2>
          <div className="mb-8">
            <HeroSentence {...totals} />
          </div>
          <FlowChart
            // draw the ribbons in again whenever another month or view arrives
            key={`${month}-${view}`}
            flow={flow}
            animate
            label={t('overview.flow.label', { month: longMonthName(year, m, settings.locale) })}
            kindLabels={{
              partner: t('overview.flow.partner'),
              overspent: t('overview.flow.overspent'),
              leftover: t('overview.flow.leftover'),
              uncategorized: t('overview.flow.uncategorized'),
            }}
            format={formatMoney}
          />
        </section>
      )}

      {monthly.isSuccess && (
        <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <YearBars year={year} months={monthly.data.months} view={view} />
          <div className="flex flex-col gap-6">
            {settings.partner_name !== '' && <PartnerBalance name={settings.partner_name} months={monthly.data.months} month={m} />}
            {spending.isSuccess && <TopCategories categories={topCategories(spending.data.rows, m - 1, 3, previousYear.data?.rows)} />}
          </div>
        </div>
      )}
    </>
  )
}
