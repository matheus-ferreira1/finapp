import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { ErrorMessage } from '../components/ui'
import { currentMonth, isValidMonth, todayISO } from '../lib/month'
import { errorText, useCategories, useSplitRules, useTransactions } from '../lib/queries'
import MonthNav from './transactions/MonthNav'
import MonthTotals from './transactions/MonthTotals'
import NewTransactionRow from './transactions/NewTransactionRow'
import TransactionRow from './transactions/TransactionRow'

const COLUMNS = ['date', 'description', 'type', 'category', 'amount', 'split', 'installment', 'confirmed', 'mine', 'shared'] as const

export default function Transactions() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()

  const requested = params.get('month')
  const month = isValidMonth(requested) ? requested : currentMonth()

  const transactions = useTransactions(month)
  const { data: categories = [] } = useCategories()
  const { data: splitRules = [] } = useSplitRules()
  const rows = transactions.data ?? []

  const defaultDate = month === currentMonth() ? todayISO() : `${month}-01`

  return (
    <>
      <PageHeader title={t('nav.transactions')}>
        <MonthNav month={month} onChange={(next) => setParams({ month: next })} />
      </PageHeader>

      <ErrorMessage message={transactions.isError ? errorText(transactions.error) : null} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[72rem] border-collapse text-left">
          <thead>
            <tr className="text-xs font-medium text-slate-500">
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-2 py-2 font-medium">
                  {t(`transactions.columns.${column}`)}
                </th>
              ))}
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            <NewTransactionRow key={month} defaultDate={defaultDate} categories={categories} splitRules={splitRules} />
            {rows.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} categories={categories} splitRules={splitRules} />
            ))}
          </tbody>
        </table>
      </div>

      {transactions.isSuccess && rows.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">{t('transactions.empty')}</p>
      )}

      <MonthTotals transactions={rows} />
    </>
  )
}
