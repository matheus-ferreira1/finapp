import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Badge } from '../../components/ui'
import type { CategoryReportRow } from '../../lib/api'
import { formatMonthYear } from '../../lib/format'

const MONTHS = Array.from({ length: 12 }, (_, i) => i)

interface Props {
  year: number
  rows: CategoryReportRow[]
}

/** One row per category, one column per month, and the totals of each. */
export default function SpendingTable({ year, rows }: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useSettings()
  const monthTotals = MONTHS.map((m) => rows.reduce((sum, row) => sum + row.months[m], 0))
  const yearTotal = rows.reduce((sum, row) => sum + row.total_cents, 0)

  return (
    <div className="overflow-x-auto">
      <table aria-label={t('nav.spending')} className="w-full min-w-[56rem] border-collapse whitespace-nowrap text-right tabular-nums">
        <thead>
          <tr className="text-xs font-medium text-slate-500">
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {t('spending.columns.category')}
            </th>
            {MONTHS.map((m) => (
              <th key={m} scope="col" className="px-2 py-2 font-medium">
                {formatMonthYear(year, m + 1)}
              </th>
            ))}
            <th scope="col" className="border-l border-slate-200 px-2 py-2 font-medium dark:border-slate-800">
              {t('spending.columns.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category_id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900">
              <th scope="row" className="px-2 py-1.5 text-left text-sm font-medium">
                <span className="flex items-center gap-2">
                  {row.name}
                  {row.archived && <Badge>{t('common.archived')}</Badge>}
                </span>
              </th>
              {MONTHS.map((m) => (
                <td key={m} className="px-2 py-1.5 text-sm">
                  {formatMoney(row.months[m])}
                </td>
              ))}
              <td className="border-l border-slate-200 px-2 py-1.5 text-sm font-medium dark:border-slate-800">
                {formatMoney(row.total_cents)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-300 font-semibold dark:border-slate-700">
            <th scope="row" className="px-2 py-2 text-left text-sm">
              {t('spending.columns.total')}
            </th>
            {monthTotals.map((total, m) => (
              <td key={m} className="px-2 py-2 text-sm">
                {formatMoney(total)}
              </td>
            ))}
            <td className="border-l border-slate-200 px-2 py-2 text-sm dark:border-slate-800">{formatMoney(yearTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
