import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import type { Transaction } from '../../lib/api'
import { monthTotals } from '../../lib/transaction-form'

const TERMS = ['income', 'expense', 'settlement', 'mine', 'shared'] as const

export default function MonthTotals({ transactions }: { transactions: Transaction[] }) {
  const { t } = useTranslation()
  const { formatMoney } = useSettings()
  const totals = monthTotals(transactions)

  return (
    <div role="group" aria-label={t('transactions.totals.label')} className="mt-6">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {TERMS.map((term) => (
          <div key={term} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
            <dt className="text-xs text-slate-500">{t(`transactions.totals.${term}`)}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMoney(totals[term])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
