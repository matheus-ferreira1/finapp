import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Button, ErrorMessage } from '../../components/ui'
import { api, type Category, type SplitRule } from '../../lib/api'
import { errorText, queryKeys } from '../../lib/queries'
import { blankRecurrenceDraft, toRecurrenceInput, type RecurrenceDraft } from '../../lib/recurrence-form'
import RecurrenceFields from './RecurrenceFields'

interface Props {
  categories: Category[]
  splitRules: SplitRule[]
}

/** The empty row at the top of the grid where a new recurrence is typed. */
export default function NewRecurrenceRow({ categories, splitRules }: Props) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const locale = settings.locale

  const [edits, setEdits] = useState<RecurrenceDraft | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: api.createRecurrence,
    onSuccess: async () => {
      setEdits(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.recurrences })
    },
  })

  const draft = edits ?? blankRecurrenceDraft()

  const add = () => {
    const result = toRecurrenceInput(draft, locale)
    if (!result.ok) {
      setInvalid(result.error)
      return
    }
    setInvalid(null)
    create.mutate(result.input)
  }

  const error = invalid ? t(`recurrences.errors.${invalid}`) : create.isError ? errorText(create.error) : null

  return (
    <tr aria-label={t('recurrences.newRow')} className="bg-emerald-50/60 align-top dark:bg-emerald-950/30">
      <RecurrenceFields
        draft={draft}
        categories={categories}
        splitRules={splitRules}
        onChange={(next) => setEdits(next)}
        onBlur={() => {}}
        onEnter={add}
      />
      <td className="min-w-52 px-2 py-1">
        <Button variant="primary" onClick={add} disabled={create.isPending}>
          {t('actions.add')}
        </Button>
        <ErrorMessage message={error} />
      </td>
    </tr>
  )
}
