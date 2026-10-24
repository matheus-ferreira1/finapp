import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Button, ErrorMessage } from '../../components/ui'
import { api, type Category, type SplitRule } from '../../lib/api'
import { errorText, queryKeys } from '../../lib/queries'
import { blankDraft, toInput, type Draft } from '../../lib/transaction-form'
import TransactionFields from './TransactionFields'

interface Props {
  /** Date a fresh row starts with: today for the current month, else the 1st. */
  defaultDate: string
  categories: Category[]
  splitRules: SplitRule[]
}

/** The empty row at the top of the grid where a new transaction is typed. */
export default function NewTransactionRow({ defaultDate, categories, splitRules }: Props) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const locale = settings.locale

  const [edits, setEdits] = useState<Draft | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const draft = edits ?? blankDraft(defaultDate)

  const create = useMutation({
    mutationFn: api.createTransaction,
    onSuccess: async () => {
      setEdits(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions })
    },
  })

  const add = () => {
    const result = toInput(draft, locale)
    if (!result.ok) {
      setClientError(t(`transactions.errors.${result.error}`))
      return
    }
    setClientError(null)
    create.mutate(result.input)
  }

  const error = clientError ?? (create.isError ? errorText(create.error) : null)

  return (
    <tr aria-label={t('transactions.newRow')} className="bg-emerald-50/60 align-top dark:bg-emerald-950/30">
      <TransactionFields
        draft={draft}
        categories={categories}
        splitRules={splitRules}
        onChange={(next) => setEdits(next)}
        onBlur={() => {}}
        onEnter={add}
      />
      <td colSpan={2} />
      <td className="min-w-52 px-2 py-1">
        <Button variant="primary" onClick={add} disabled={create.isPending}>
          {t('actions.add')}
        </Button>
        <ErrorMessage message={error} />
      </td>
    </tr>
  )
}
