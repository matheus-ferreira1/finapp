import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, ErrorMessage, Field, Section, TextInput } from '../../components/ui'
import { api, type SplitRule } from '../../lib/api'
import { errorText, queryKeys, useSplitRules } from '../../lib/queries'

const shares = (myPercent: number) => `${myPercent}/${100 - myPercent}`

/** Parses a whole percentage between 0 and 100; null when invalid. */
function parsePercent(raw: string): number | null {
  if (!/^-?\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return value >= 0 && value <= 100 ? value : null
}

export default function SplitRuleSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: rules = [] } = useSplitRules()
  const [name, setName] = useState('')
  const [percent, setPercent] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (input: { name: string; my_percent: number }) => api.createSplitRule(input),
    onSuccess: async () => {
      setName('')
      setPercent('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.splitRules })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const myPercent = parsePercent(percent)
    if (myPercent === null) {
      setValidationError(t('settings.splitRules.invalidPercent'))
      return
    }
    setValidationError(null)
    create.mutate({ name: name.trim() || shares(myPercent), my_percent: myPercent })
  }

  return (
    <Section id="settings-split-rules" title={t('settings.splitRules.title')}>
      <p className="mb-3 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('settings.splitRules.hint')}</p>

      {rules.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">{t('common.empty')}</p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-200 dark:divide-slate-800">
          {rules.map((rule) => (
            <SplitRuleRow key={rule.id} rule={rule} />
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
        <Field label={t('settings.splitRules.newName')}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('settings.splitRules.myPercent')}>
          <TextInput
            type="number"
            inputMode="numeric"
            className="w-28"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {t('actions.add')}
        </Button>
      </form>
      <ErrorMessage message={validationError ?? (create.isError ? errorText(create.error) : null)} />
    </Section>
  )
}

function SplitRuleRow({ rule }: { rule: SplitRule }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(rule.name)
  const [percent, setPercent] = useState(String(rule.my_percent))
  const [validationError, setValidationError] = useState<string | null>(null)

  const update = useMutation({
    mutationFn: (changes: { name: string; my_percent: number; archived: boolean }) =>
      api.updateSplitRule(rule.id, changes),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.splitRules })
    },
  })

  const startEditing = () => {
    update.reset()
    setValidationError(null)
    setName(rule.name)
    setPercent(String(rule.my_percent))
    setEditing(true)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const myPercent = parsePercent(percent)
    if (myPercent === null) {
      setValidationError(t('settings.splitRules.invalidPercent'))
      return
    }
    setValidationError(null)
    update.mutate({ name: name.trim() || shares(myPercent), my_percent: myPercent, archived: rule.archived })
  }

  return (
    <li className="py-2">
      {editing ? (
        <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-2">
          <Field label={t('common.name')}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('settings.splitRules.editPercent')}>
            <TextInput
              type="number"
              inputMode="numeric"
              className="w-28"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {t('actions.save')}
          </Button>
          <Button onClick={() => setEditing(false)}>{t('actions.cancel')}</Button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <span className={rule.archived ? 'text-slate-500 line-through' : ''}>{rule.name}</span>
          <small className="text-slate-500">{shares(rule.my_percent)}</small>
          {rule.archived && <Badge>{t('common.archived')}</Badge>}
          <span className="ml-auto flex gap-2">
            <Button onClick={startEditing} aria-label={`${t('actions.edit')} ${rule.name}`}>
              {t('actions.edit')}
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ name: rule.name, my_percent: rule.my_percent, archived: !rule.archived })
              }
              aria-label={`${t(rule.archived ? 'actions.restore' : 'actions.archive')} ${rule.name}`}
            >
              {t(rule.archived ? 'actions.restore' : 'actions.archive')}
            </Button>
          </span>
        </div>
      )}
      <ErrorMessage message={validationError ?? (update.isError ? errorText(update.error) : null)} />
    </li>
  )
}
