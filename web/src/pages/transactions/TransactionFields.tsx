import { useTranslation } from 'react-i18next'
import type { Category, SplitRule, TransactionType } from '../../lib/api'
import { CELL_CLASS as CELL } from '../../components/ui'
import { withType, type Draft } from '../../lib/transaction-form'

const TYPES: TransactionType[] = ['income', 'expense', 'settlement']

export interface FieldsProps {
  draft: Draft
  categories: Category[]
  splitRules: SplitRule[]
  /**
   * Called when a field changes. `immediate` is set for controls that have no
   * "finished typing" moment (selects, checkbox), so the row can save at once.
   */
  onChange: (next: Draft, immediate: boolean) => void
  /** The user left a text field or pressed Enter. */
  onBlur: () => void
  onEnter: () => void
}

/** The editable cells of a transaction row. The caller wraps them in a <tr>. */
export default function TransactionFields({ draft, categories, splitRules, onChange, onBlur, onEnter }: FieldsProps) {
  const { t } = useTranslation()

  const text = (field: 'date' | 'description' | 'amount' | 'installment', label: string, extra = {}) => (
    <input
      aria-label={label}
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
      <td className="min-w-36 p-0.5">{text('date', t('transactions.columns.date'), { type: 'date' })}</td>
      <td className="min-w-48 p-0.5">{text('description', t('transactions.columns.description'))}</td>
      <td className="min-w-28 p-0.5">
        <select
          aria-label={t('transactions.columns.type')}
          className={CELL}
          value={draft.type}
          onChange={(e) => onChange(withType(draft, e.target.value as TransactionType, categories), true)}
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
          aria-label={t('transactions.columns.category')}
          className={CELL}
          value={draft.categoryId}
          disabled={draft.type === 'settlement'}
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
      <td className="min-w-32 p-0.5">{text('amount', t('transactions.columns.amount'), { inputMode: 'decimal', className: `${CELL} text-right` })}</td>
      <td className="min-w-36 p-0.5">
        <select
          aria-label={t('transactions.columns.split')}
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
      <td className="min-w-24 p-0.5">{text('installment', t('transactions.columns.installment'), { placeholder: '2/12' })}</td>
      <td className="min-w-24 p-0.5 text-center">
        <input
          type="checkbox"
          aria-label={t('transactions.columns.confirmed')}
          checked={draft.confirmed}
          onChange={(e) => onChange({ ...draft, confirmed: e.target.checked }, true)}
          className="size-4 accent-emerald-600"
        />
      </td>
    </>
  )
}
