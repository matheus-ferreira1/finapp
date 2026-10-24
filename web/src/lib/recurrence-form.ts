import type { Category, Recurrence, RecurrenceInput } from './api'
import { formatMoneyInput, parseMoney } from './money'

type RecurrenceType = RecurrenceInput['type']

/** A recurrence row as the user edits it: everything is text until it is saved. */
export interface RecurrenceDraft {
  day: string
  description: string
  type: RecurrenceType
  categoryId: string
  amount: string
  splitRuleId: string
  active: boolean
}

export type RecurrenceDraftError = 'invalidDay' | 'descriptionRequired' | 'invalidAmount'

export type RecurrenceResult =
  | { ok: true; input: RecurrenceInput }
  | { ok: false; error: RecurrenceDraftError }

export function toRecurrenceDraft(rec: Recurrence, locale: string): RecurrenceDraft {
  return {
    day: String(rec.day),
    description: rec.description,
    type: rec.type,
    categoryId: rec.category_id === null ? '' : String(rec.category_id),
    amount: formatMoneyInput(rec.estimated_amount_cents, locale),
    splitRuleId: rec.split_rule_id === null ? '' : String(rec.split_rule_id),
    active: rec.active,
  }
}

export function blankRecurrenceDraft(): RecurrenceDraft {
  return { day: '1', description: '', type: 'expense', categoryId: '', amount: '', splitRuleId: '', active: true }
}

/** Changes the type of a row, dropping what no longer applies to it. */
export function withRecurrenceType(draft: RecurrenceDraft, type: RecurrenceType, categories: Category[]): RecurrenceDraft {
  const category = categories.find((c) => String(c.id) === draft.categoryId)
  const keepCategory = !category || category.kind === type
  return {
    ...draft,
    type,
    categoryId: keepCategory ? draft.categoryId : '',
    splitRuleId: type === 'expense' ? draft.splitRuleId : '',
  }
}

/**
 * Converts what the user typed into the API payload. A missing category is left
 * for the server to judge, like on the transactions grid.
 */
export function toRecurrenceInput(draft: RecurrenceDraft, locale: string): RecurrenceResult {
  if (!/^\d+$/.test(draft.day.trim())) return { ok: false, error: 'invalidDay' }
  const day = Number(draft.day)
  if (day < 1 || day > 31) return { ok: false, error: 'invalidDay' }

  const description = draft.description.trim()
  if (description === '') return { ok: false, error: 'descriptionRequired' }

  const amount = parseMoney(draft.amount, locale)
  if (amount === null || amount <= 0) return { ok: false, error: 'invalidAmount' }

  return {
    ok: true,
    input: {
      day,
      description,
      type: draft.type,
      category_id: draft.categoryId === '' ? null : Number(draft.categoryId),
      estimated_amount_cents: amount,
      split_rule_id: draft.type === 'expense' && draft.splitRuleId !== '' ? Number(draft.splitRuleId) : null,
      active: draft.active,
    },
  }
}
