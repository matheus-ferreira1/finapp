import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../app/settings-context'
import { Button, ErrorMessage, Field, Section, TextInput } from '../../components/ui'
import { api, type Settings } from '../../lib/api'
import { errorText, queryKeys } from '../../lib/queries'

const LOCALES = ['pt-BR', 'en'] as const

export default function GeneralSettings() {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  // Only what the user edited; everything else follows the loaded settings.
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const form: Settings = { ...settings, ...draft }
  const change = (changes: Partial<Settings>) => setDraft({ ...draft, ...changes })

  const save = useMutation({
    mutationFn: () => api.updateSettings(form),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.settings, saved)
      setDraft({})
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Section id="settings-general" title={t('settings.general.title')}>
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
        <Field label={t('settings.general.partnerName')}>
          <TextInput
            value={form.partner_name}
            maxLength={100}
            onChange={(e) => change({ partner_name: e.target.value })}
          />
        </Field>
        <Field label={t('settings.general.currency')}>
          <TextInput
            value={form.currency}
            maxLength={3}
            onChange={(e) => change({ currency: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label={t('settings.general.language')}>
          <select
            value={form.locale}
            onChange={(e) => change({ locale: e.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t(`settings.languages.${locale}`)}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('actions.save')}
          </Button>
          {save.isSuccess && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
              {t('settings.general.saved')}
            </p>
          )}
        </div>
        <ErrorMessage message={save.isError ? errorText(save.error) : null} />
      </form>
    </Section>
  )
}
