import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { ErrorMessage, Section } from '../components/ui'
import type { Figures } from '../lib/api'
import { currentYear, parseYear } from '../lib/month'
import { errorText, useMonthlyReport } from '../lib/queries'
import FiguresTable, { type FigureColumn } from './summary/FiguresTable'
import YearNav from './summary/YearNav'

const totalsColumns = (view: 'gross' | 'mine'): FigureColumn[] => [
  { key: 'income', amount: (f: Figures) => f[view].income_cents },
  { key: 'expense', amount: (f: Figures) => f[view].expense_cents },
  { key: 'balance', amount: (f: Figures) => f[view].balance_cents, signed: true },
]

const SECTIONS = [
  { id: 'gross', columns: totalsColumns('gross') },
  { id: 'mine', columns: totalsColumns('mine') },
  {
    id: 'settlement',
    columns: [
      { key: 'shared', amount: (f: Figures) => f.shared_cents },
      { key: 'settled', amount: (f: Figures) => f.settled_cents },
      { key: 'owed', amount: (f: Figures) => f.owed_cents, signed: true },
      { key: 'owedToDate', amount: (f: Figures) => f.owed_to_date_cents, signed: true },
    ],
  },
] satisfies { id: string; columns: FigureColumn[] }[]

export default function Summary() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const year = parseYear(params.get('year')) ?? currentYear()
  const report = useMonthlyReport(year)

  return (
    <>
      <PageHeader title={t('nav.summary')}>
        <YearNav year={year} onChange={(next) => setParams({ year: String(next) })} />
      </PageHeader>

      <ErrorMessage message={report.isError ? errorText(report.error) : null} />
      {report.isPending && <p className="text-sm text-slate-500">{t('common.loading')}</p>}

      {report.isSuccess &&
        SECTIONS.map(({ id, columns }) => (
          <Section key={id} id={`summary-${id}`} title={t(`summary.sections.${id}`)}>
            <FiguresTable headingId={`summary-${id}`} year={year} months={report.data.months} columns={columns} />
          </Section>
        ))}
    </>
  )
}
