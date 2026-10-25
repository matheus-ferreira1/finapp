import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import YearNav from '../components/YearNav'
import { ErrorMessage, Field } from '../components/ui'
import type { CategoryReportScope, CategoryReportView } from '../lib/api'
import { currentYear, parseYear } from '../lib/month'
import { errorText, useCategoryReport } from '../lib/queries'
import SpendingTable from './spending/SpendingTable'

const VIEWS: CategoryReportView[] = ['gross', 'mine']
const SCOPES: CategoryReportScope[] = ['all', 'confirmed']

const SELECT_CLASS =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

/** The value of a URL parameter when it is one of the options, else the first option. */
const oneOf = <T extends string>(options: T[], value: string | null): T => options.find((o) => o === value) ?? options[0]

export default function Spending() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const year = parseYear(params.get('year')) ?? currentYear()
  const view = oneOf(VIEWS, params.get('view'))
  const scope = oneOf(SCOPES, params.get('scope'))
  const report = useCategoryReport(year, view, scope)

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        updated.set(key, value)
        return updated
      },
      { replace: true },
    )

  return (
    <>
      <PageHeader title={t('nav.spending')}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('spending.view')}>
            <select className={SELECT_CLASS} value={view} onChange={(e) => setParam('view', e.target.value)}>
              {VIEWS.map((v) => (
                <option key={v} value={v}>
                  {t(`spending.views.${v}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('spending.scope')}>
            <select className={SELECT_CLASS} value={scope} onChange={(e) => setParam('scope', e.target.value)}>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {t(`spending.scopes.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <YearNav year={year} onChange={(next) => setParam('year', String(next))} />
        </div>
      </PageHeader>

      <ErrorMessage message={report.isError ? errorText(report.error) : null} />
      {report.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}

      {report.isSuccess &&
        (report.data.rows.length === 0 ? (
          <p className="text-sm text-slate-500">{t('spending.empty')}</p>
        ) : (
          <SpendingTable year={report.data.year} rows={report.data.rows} />
        ))}
    </>
  )
}
