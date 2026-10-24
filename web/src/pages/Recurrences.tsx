import { useTranslation } from 'react-i18next'
import PageHeader from '../components/PageHeader'
import { useCategories, useRecurrences, useSplitRules } from '../lib/queries'
import GeneratePanel from './recurrences/GeneratePanel'
import NewRecurrenceRow from './recurrences/NewRecurrenceRow'
import RecurrenceRow from './recurrences/RecurrenceRow'

const COLUMNS = ['day', 'description', 'type', 'category', 'amount', 'split', 'active'] as const

export default function Recurrences() {
  const { t } = useTranslation()
  const recurrences = useRecurrences()
  const { data: categories = [] } = useCategories()
  const { data: splitRules = [] } = useSplitRules()
  const rows = recurrences.data ?? []

  return (
    <>
      <PageHeader title={t('nav.recurrences')} />
      <GeneratePanel />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-left">
          <thead>
            <tr className="text-xs font-medium text-slate-500">
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-2 py-2 font-medium">
                  {t(`recurrences.columns.${column}`)}
                </th>
              ))}
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            <NewRecurrenceRow categories={categories} splitRules={splitRules} />
            {rows.map((recurrence) => (
              <RecurrenceRow key={recurrence.id} recurrence={recurrence} categories={categories} splitRules={splitRules} />
            ))}
          </tbody>
        </table>
      </div>

      {recurrences.isSuccess && rows.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">{t('recurrences.empty')}</p>
      )}
    </>
  )
}
