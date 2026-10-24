import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, ErrorMessage, Field, Section, TextInput } from '../../components/ui'
import { api, type Category, type CategoryKind } from '../../lib/api'
import { errorText, queryKeys, useCategories } from '../../lib/queries'

export default function CategorySection({ kind }: { kind: CategoryKind }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const [name, setName] = useState('')

  const create = useMutation({
    mutationFn: () => api.createCategory({ name: name.trim(), kind }),
    onSuccess: async () => {
      setName('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) create.mutate()
  }

  const ofKind = categories.filter((c) => c.kind === kind)

  return (
    <Section id={`settings-categories-${kind}`} title={t(`settings.categories.${kind}`)}>
      {ofKind.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">{t('common.empty')}</p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-200 dark:divide-slate-800">
          {ofKind.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <Field label={t('settings.categories.newName')}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {t('actions.add')}
        </Button>
      </form>
      <ErrorMessage message={create.isError ? errorText(create.error) : null} />
    </Section>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  const update = useMutation({
    mutationFn: (changes: { name: string; archived: boolean }) =>
      api.updateCategory(category.id, { kind: category.kind, ...changes }),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) update.mutate({ name: name.trim(), archived: category.archived })
  }

  const startEditing = () => {
    update.reset()
    setName(category.name)
    setEditing(true)
  }

  return (
    <li className="py-2">
      {editing ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Field label={t('common.name')}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {t('actions.save')}
          </Button>
          <Button onClick={() => setEditing(false)}>{t('actions.cancel')}</Button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <span className={category.archived ? 'text-slate-500 line-through' : ''}>{category.name}</span>
          {category.archived && <Badge>{t('common.archived')}</Badge>}
          <span className="ml-auto flex gap-2">
            <Button onClick={startEditing} aria-label={`${t('actions.edit')} ${category.name}`}>
              {t('actions.edit')}
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() => update.mutate({ name: category.name, archived: !category.archived })}
              aria-label={`${t(category.archived ? 'actions.restore' : 'actions.archive')} ${category.name}`}
            >
              {t(category.archived ? 'actions.restore' : 'actions.archive')}
            </Button>
          </span>
        </div>
      )}
      <ErrorMessage message={update.isError ? errorText(update.error) : null} />
    </li>
  )
}
