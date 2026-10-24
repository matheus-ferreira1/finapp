import { useTranslation } from 'react-i18next'
import { CELL_CLASS as CELL } from '../../components/ui'
import type { Category, SplitRule } from '../../lib/api'
import { withRecurrenceType, type RecurrenceDraft } from '../../lib/recurrence-form'

const TYPES = ['income', 'expense'] as const

export interface RecurrenceFieldsProps {
  draft: RecurrenceDraft
  categories: Category[]
  splitRules: SplitRule[]
  /** `immediate` is set for controls with no "finished typing" moment, so the row can save at once. */
  onChange: (next: RecurrenceDraft, immediate: boolean) => void
  onBlur: () => void
  onEnter: () => void
}

/** The editable cells of a recurrence row. The caller wraps them in a <tr>. */
export default function RecurrenceFields({ draft, categories, splitRules, onChange, onBlur, onEnter }: RecurrenceFieldsProps) {
  const { t } = useTranslation()

  const text = (field: 'day' | 'description' | 'amount', extra = {}) => (
    <input
      aria-label={t(`recurrences.columns.${field}`)}
      className={CELL}
      value={draft[field]}
      onChange={(e) => onChange({ ...draft, [field]: e.target.value }, false)}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      {...extra}
    />
  )

  const categoryOptions = categories.filter(
    (c) => c.kind === draft.type && (!c.archived || String(c.id) === draft.categoryId),
  )
  const ruleOptions = splitRules.filter((r) => !r.archived || String(r.id) === draft.splitRuleId)

  return (
    <>
      <td className="w-20 p-0.5">{text('day', { inputMode: 'numeric' })}</td>
      <td className="min-w-48 p-0.5">{text('description')}</td>
      <td className="w-28 p-0.5">
        <select
          aria-label={t('recurrences.columns.type')}
          className={CELL}
          value={draft.type}
          onChange={(e) => onChange(withRecurrenceType(draft, e.target.value as (typeof TYPES)[number], categories), true)}
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`transactions.types.${type}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-40 p-0.5">
        <select
          aria-label={t('recurrences.columns.category')}
          className={CELL}
          value={draft.categoryId}
          onChange={(e) => onChange({ ...draft, categoryId: e.target.value }, true)}
        >
          <option value="">{t('transactions.noCategory')}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="w-32 p-0.5">{text('amount', { inputMode: 'decimal', className: `${CELL} text-right` })}</td>
      <td className="w-36 p-0.5">
        <select
          aria-label={t('recurrences.columns.split')}
          className={CELL}
          value={draft.splitRuleId}
          disabled={draft.type !== 'expense'}
          onChange={(e) => onChange({ ...draft, splitRuleId: e.target.value }, true)}
        >
          <option value="">{t('transactions.onlyMine')}</option>
          {ruleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </td>
      <td className="w-20 p-0.5 text-center">
        <input
          type="checkbox"
          aria-label={t('recurrences.columns.active')}
          checked={draft.active}
          onChange={(e) => onChange({ ...draft, active: e.target.checked }, true)}
          className="size-4 accent-emerald-600"
        />
      </td>
    </>
  )
}
