import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Button, ErrorMessage } from '../../components/ui'
import { api, type Category, type SplitRule, type Transaction, type TransactionInput } from '../../lib/api'
import { errorText, queryKeys } from '../../lib/queries'
import { toDraft, toInput, type Draft } from '../../lib/transaction-form'
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

  // What the user changed since the last save; everything else follows the server.
  const [edits, setEdits] = useState<Partial<Draft>>({})
  const [clientError, setClientError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const saved = toDraft(tx, locale)
  const draft: Draft = { ...saved, ...edits }

  // The payload being saved, so Enter followed by blur does not save it twice.
  const inFlight = useRef<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions })

  const update = useMutation({
    mutationFn: (input: TransactionInput) => api.updateTransaction(tx.id, input),
    onSuccess: refresh,
    onSettled: () => {
      inFlight.current = null
    },
  })
  const remove = useMutation({ mutationFn: () => api.deleteTransaction(tx.id), onSuccess: refresh })

  /** Saves `next` unless it is invalid or identical to what is stored. */
  const commit = (next: Draft, sent: Partial<Draft>) => {
    const result = toInput(next, locale)
    if (!result.ok) {
      setClientError(t(`transactions.errors.${result.error}`))
      return
    }
    setClientError(null)

    const stored = toInput(saved, locale)
    if (stored.ok && JSON.stringify(stored.input) === JSON.stringify(result.input)) return

    const payload = JSON.stringify(result.input)
    if (payload === inFlight.current) return
    inFlight.current = payload

    update.mutate(result.input, {
      // Forget the edits that were just saved, unless the user kept typing meanwhile.
      onSuccess: () => setEdits((current) => (current === sent ? {} : current)),
    })
  }

  const change = (next: Draft, immediate: boolean) => {
    setEdits(next)
    if (immediate) commit(next, next)
  }

  const error = clientError ?? (update.isError ? errorText(update.error) : remove.isError ? errorText(remove.error) : null)

  return (
    <tr aria-label={tx.description || tx.date} className="border-t border-slate-200 align-top dark:border-slate-800">
      <TransactionFields
        draft={draft}
        categories={categories}
        splitRules={splitRules}
        onChange={change}
        onBlur={() => commit(draft, edits)}
        onEnter={() => commit(draft, edits)}
      />
      <td className="px-2 py-1 text-right text-sm tabular-nums">{formatMoney(tx.my_cents)}</td>
      <td className="px-2 py-1 text-right text-sm tabular-nums">{formatMoney(tx.shared_cents)}</td>
      <td className="min-w-52 px-2 py-1">
        {confirmingDelete ? (
          <span className="flex gap-2">
            <Button
              variant="primary"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('transactions.confirmDelete')}
            </Button>
            <Button onClick={() => setConfirmingDelete(false)}>{t('actions.cancel')}</Button>
          </span>
        ) : (
          <Button onClick={() => setConfirmingDelete(true)} aria-label={`${t('transactions.delete')} ${tx.description || tx.date}`}>
            {t('transactions.delete')}
          </Button>
        )}
        <ErrorMessage message={error} />
      </td>
    </tr>
  )
}
