import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import BalanceLine from '../../components/charts/BalanceLine'
import type { MonthSummary } from '../../lib/api'
import { balanceSeries } from '../../lib/chart-data'
import { formatCompactMoney, shortMonthName } from '../../lib/format'

interface Props {
  name: string
  months: MonthSummary[]
  /** The month (1 to 12) the sentence is about. */
  month: number
}

/** What the partner owes, said in words for the month and drawn over the year. */
export default function PartnerBalance({ name, months, month }: Props) {
  const { t } = useTranslation()
  const { settings, formatMoney } = useSettings()
  const owed = months[month - 1]?.realized.owed_to_date_cents ?? 0
  const amount = formatMoney(Math.abs(owed))

  return (
    <section aria-labelledby="overview-partner" className="rounded-panel bg-surface p-5 ring-1 ring-line">
      <h2 id="overview-partner" className="text-xl font-semibold tracking-tight">
        {t('overview.partner.title', { name })}
      </h2>
      <p className="mt-1 mb-4 text-sm">
        {owed > 0 && t('overview.partner.owes', { name, amount })}
        {owed < 0 && t('overview.partner.youOwe', { name, amount })}
        {owed === 0 && t('overview.partner.settled', { name })}
      </p>
      <BalanceLine
        values={balanceSeries(months, 'realized')}
        color="var(--owed)"
        label={t('overview.partner.line', { name })}
        title={t('overview.partner.series')}
        format={formatMoney}
        formatTick={(cents) => formatCompactMoney(cents, settings.locale, settings.currency)}
        monthLabel={(m) => shortMonthName(m, settings.locale)}
      />
    </section>
  )
}
