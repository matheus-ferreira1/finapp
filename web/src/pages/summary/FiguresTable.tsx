import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import type { Figures, MonthSummary } from '../../lib/api'
import { formatMonthYear } from '../../lib/format'

export interface FigureColumn {
  /** Translation key under `summary.columns`. */
  key: string
  amount: (figures: Figures) => number
  /** Colours a negative amount red; only meaningful for balances. */
  signed?: boolean
}

const SCOPES = ['planned', 'realized'] as const

interface Props {
  /** Id of the heading that names the table. */
  headingId: string
  year: number
  months: MonthSummary[]
  columns: FigureColumn[]
}

/** One row per month, with the planned and realized figures side by side. */
export default function FiguresTable({ headingId, year, months, columns }: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useSettings()

  return (
    <div className="overflow-x-auto">
      <table aria-labelledby={headingId} className="w-full min-w-[40rem] border-collapse whitespace-nowrap text-right tabular-nums">
        <thead>
          <tr className="text-xs font-medium text-slate-500">
            <th scope="col" rowSpan={2} className="px-2 py-2 text-left align-bottom font-medium">
              {t('summary.columns.month')}
            </th>
            {SCOPES.map((scope) => (
              <th
                key={scope}
                scope="colgroup"
                colSpan={columns.length}
                className="border-l border-slate-200 px-2 py-2 text-center font-medium dark:border-slate-800"
              >
                {t(`summary.scopes.${scope}`)}
              </th>
            ))}
          </tr>
          <tr className="text-xs font-medium text-slate-500">
            {SCOPES.flatMap((scope) =>
              columns.map((column, i) => (
                <th
                  key={`${scope}-${column.key}`}
                  scope="col"
                  className={`px-2 py-2 font-medium ${i === 0 ? 'border-l border-slate-200 dark:border-slate-800' : ''}`}
                >
                  {t(`summary.columns.${column.key}`)}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {months.map((summary) => (
            <tr key={summary.month} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900">
              <th scope="row" className="px-2 py-1.5 text-left text-sm font-medium">
                {formatMonthYear(year, summary.month)}
              </th>
              {SCOPES.flatMap((scope) =>
                columns.map((column, i) => {
                  const amount = column.amount(summary[scope])
                  const negative = column.signed && amount < 0
                  return (
                    <td
                      key={`${scope}-${column.key}`}
                      className={[
                        'px-2 py-1.5 text-sm',
                        i === 0 ? 'border-l border-slate-200 dark:border-slate-800' : '',
                        negative ? 'text-red-700 dark:text-red-300' : '',
                      ].join(' ')}
                    >
                      {formatMoney(amount)}
                    </td>
                  )
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
