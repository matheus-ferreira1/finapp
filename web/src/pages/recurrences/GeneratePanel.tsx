import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button, ErrorMessage, Section, TextInput } from '../../components/ui'
import { api, type Generation } from '../../lib/api'
import { formatMonthYear } from '../../lib/format'
import { currentMonth, isValidMonth, monthParts } from '../../lib/month'
import { errorText, queryKeys } from '../../lib/queries'

/** Creates the transactions of the active recurrences for a chosen month. */
export default function GeneratePanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth())
  const [chooseMonth, setChooseMonth] = useState(false)

  const generate = useMutation({
    mutationFn: api.generateRecurrences,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
  })

  const submit = () => {
    if (!isValidMonth(month)) {
      setChooseMonth(true)
      return
    }
    setChooseMonth(false)
    generate.mutate(month)
  }

  const error = chooseMonth
    ? t('recurrences.generate.chooseMonth')
    : generate.isError
      ? errorText(generate.error)
      : null

  const generatedMonth = generate.variables
  const monthLabel = generatedMonth
    ? formatMonthYear(monthParts(generatedMonth).year, monthParts(generatedMonth).month)
    : ''

  return (
    <Section id="recurrences-generate" title={t('recurrences.generate.title')}>
      <p className="mb-3 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('recurrences.generate.hint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('recurrences.generate.month')}
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <Button variant="primary" onClick={submit} disabled={generate.isPending}>
          {t('recurrences.generate.button')}
        </Button>
      </div>

      <ErrorMessage message={error} />
      {generate.isSuccess && generatedMonth && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <p role="status">{summary(generate.data, t)}</p>
          <Link
            to={`/transactions?month=${generatedMonth}`}
            className="font-medium text-emerald-700 underline dark:text-emerald-300"
          >
            {t('recurrences.generate.view', { month: monthLabel })}
          </Link>
        </div>
      )}
    </Section>
  )
}

function summary(result: Generation, t: (key: string, options?: Record<string, unknown>) => string): string {
  const created = result.created.length
  if (created === 0) {
    return t(result.skipped > 0 ? 'recurrences.generate.nothing' : 'recurrences.generate.noActive')
  }
  const parts = [t('recurrences.generate.created', { count: created })]
  if (result.skipped > 0) parts.push(t('recurrences.generate.existed', { count: result.skipped }))
  return parts.join(' ')
}
