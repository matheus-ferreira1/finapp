import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Button, ErrorMessage } from '../../components/ui'
import { api, type Category, type SplitRule, type Transaction } from '../../lib/api'
import { errorText, queryKeys } from '../../lib/queries'
import { toDraft, toInput } from '../../lib/transaction-form'
import { useDraftRow } from '../../lib/useDraftRow'
import TransactionFields from './TransactionFields'

interface Props {
  transaction: Transaction
  categories: Category[]
  splitRules: SplitRule[]
}

export default function TransactionRow({ transaction: tx, categories, splitRules }: Props) {
  const { t } = useTranslation()
  const { settings, formatMoney } = useSettings()
  const queryClient = useQueryClient()
  const locale = settings.locale
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions })

  const row = useDraftRow({
    saved: toDraft(tx, locale),
    toInput: (draft) => toInput(draft, locale),
    save: (input) => api.updateTransaction(tx.id, input),
    onSaved: refresh,
  })
  const remove = useMutation({ mutationFn: () => api.deleteTransaction(tx.id), onSuccess: refresh })

  const error = row.invalid
    ? t(`transactions.errors.${row.invalid}`)
    : (row.serverError ?? (remove.isError ? errorText(remove.error) : null))

  return (
    <tr aria-label={tx.description || tx.date} className="border-t border-slate-200 align-top dark:border-slate-800">
      <TransactionFields
        draft={row.draft}
        categories={categories}
        splitRules={splitRules}
        onChange={row.change}
        onBlur={row.commit}
        onEnter={row.commit}
      />
      <td className="px-2 py-1 text-right text-sm tabular-nums">{formatMoney(tx.my_cents)}</td>
      <td className="px-2 py-1 text-right text-sm tabular-nums">{formatMoney(tx.shared_cents)}</td>
      <td className="min-w-52 px-2 py-1">
        {confirmingDelete ? (
          <span className="flex gap-2">
            <Button variant="primary" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t('transactions.confirmDelete')}
            </Button>
            <Button onClick={() => setConfirmingDelete(false)}>{t('actions.cancel')}</Button>
          </span>
        ) : (
          <Button
            onClick={() => setConfirmingDelete(true)}
            aria-label={`${t('transactions.delete')} ${tx.description || tx.date}`}
          >
            {t('transactions.delete')}
          </Button>
        )}
        <ErrorMessage message={error} />
      </td>
    </tr>
  )
}
