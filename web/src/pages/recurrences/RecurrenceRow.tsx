import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Button, ErrorMessage } from '../../components/ui'
import { api, type Category, type Recurrence, type SplitRule } from '../../lib/api'
import { errorText, queryKeys } from '../../lib/queries'
import { toRecurrenceDraft, toRecurrenceInput } from '../../lib/recurrence-form'
import { useDraftRow } from '../../lib/useDraftRow'
import RecurrenceFields from './RecurrenceFields'

interface Props {
  recurrence: Recurrence
  categories: Category[]
  splitRules: SplitRule[]
}

export default function RecurrenceRow({ recurrence, categories, splitRules }: Props) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const locale = settings.locale
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.recurrences })

  const row = useDraftRow({
    saved: toRecurrenceDraft(recurrence, locale),
    toInput: (draft) => toRecurrenceInput(draft, locale),
    save: (input) => api.updateRecurrence(recurrence.id, input),
    onSaved: refresh,
  })
  const remove = useMutation({ mutationFn: () => api.deleteRecurrence(recurrence.id), onSuccess: refresh })

  const error = row.invalid
    ? t(`recurrences.errors.${row.invalid}`)
    : (row.serverError ?? (remove.isError ? errorText(remove.error) : null))

  return (
    <tr aria-label={recurrence.description} className="border-t border-slate-200 align-top dark:border-slate-800">
      <RecurrenceFields
        draft={row.draft}
        categories={categories}
        splitRules={splitRules}
        onChange={row.change}
        onBlur={row.commit}
        onEnter={row.commit}
      />
      <td className="min-w-52 px-2 py-1">
        {confirmingDelete ? (
          <span className="flex gap-2">
            <Button variant="primary" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t('transactions.confirmDelete')}
            </Button>
            <Button onClick={() => setConfirmingDelete(false)}>{t('actions.cancel')}</Button>
          </span>
        ) : (
          <Button onClick={() => setConfirmingDelete(true)} aria-label={`${t('transactions.delete')} ${recurrence.description}`}>
            {t('transactions.delete')}
          </Button>
        )}
        <ErrorMessage message={error} />
      </td>
    </tr>
  )
}
