import type { Category, Transaction, TransactionInput, TransactionType } from './api'
import { formatMoneyInput, parseMoney } from './money'

/** A transaction row as the user edits it: everything is text until it is saved. */
export interface Draft {
  date: string
  description: string
  type: TransactionType
  categoryId: string
  amount: string
  splitRuleId: string
  /** "2/12", or empty when the transaction is not an installment. */
  installment: string
  confirmed: boolean
}

export type DraftError = 'invalidAmount' | 'invalidDate' | 'invalidInstallment'

export type DraftResult = { ok: true; input: TransactionInput } | { ok: false; error: DraftError }

export function toDraft(tx: Transaction, locale: string): Draft {
  return {
    date: tx.date,
    description: tx.description,
    type: tx.type,
    categoryId: tx.category_id === null ? '' : String(tx.category_id),
    amount: formatMoneyInput(tx.amount_cents, locale),
    splitRuleId: tx.split_rule_id === null ? '' : String(tx.split_rule_id),
    installment: tx.installment_number === null ? '' : `${tx.installment_number}/${tx.installment_total}`,
    confirmed: tx.confirmed,
  }
}

export function blankDraft(date: string): Draft {
  return {
    date,
    description: '',
    type: 'expense',
    categoryId: '',
    amount: '',
    splitRuleId: '',
    installment: '',
    confirmed: false,
  }
}

/** Changes the type of a row, dropping what no longer applies to it. */
export function withType(draft: Draft, type: TransactionType, categories: Category[]): Draft {
  const category = categories.find((c) => String(c.id) === draft.categoryId)
  const keepCategory = type !== 'settlement' && (!category || category.kind === type)
  return {
    ...draft,
    type,
    categoryId: keepCategory ? draft.categoryId : '',
    splitRuleId: type === 'expense' ? draft.splitRuleId : '',
  }
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/**
 * Converts what the user typed into the API payload. Problems that only the
 * user can fix (amount, date, installment) are reported here; the server still
 * judges the rest, such as a missing category.
 */
export function toInput(draft: Draft, locale: string): DraftResult {
  if (!isRealDate(draft.date)) return { ok: false, error: 'invalidDate' }

  const amount = parseMoney(draft.amount, locale)
  if (amount === null || amount <= 0) return { ok: false, error: 'invalidAmount' }

  let installmentNumber: number | null = null
  let installmentTotal: number | null = null
  if (draft.installment.trim() !== '') {
    const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(draft.installment)
    if (!match) return { ok: false, error: 'invalidInstallment' }
    installmentNumber = Number(match[1])
    installmentTotal = Number(match[2])
    if (installmentNumber < 1 || installmentNumber > installmentTotal) return { ok: false, error: 'invalidInstallment' }
  }

  const hasCategory = draft.type !== 'settlement' && draft.categoryId !== ''
  const hasRule = draft.type === 'expense' && draft.splitRuleId !== ''

  return {
    ok: true,
    input: {
      date: draft.date,
      description: draft.description.trim(),
      type: draft.type,
      category_id: hasCategory ? Number(draft.categoryId) : null,
      amount_cents: amount,
      split_rule_id: hasRule ? Number(draft.splitRuleId) : null,
      installment_number: installmentNumber,
      installment_total: installmentTotal,
      confirmed: draft.confirmed,
    },
  }
}

export interface MonthTotals {
  income: number
  expense: number
  settlement: number
  /** My part of the expenses. */
  mine: number
  /** The part of the expenses my partner owes me. */
  shared: number
}

export function monthTotals(transactions: Transaction[]): MonthTotals {
  const totals: MonthTotals = { income: 0, expense: 0, settlement: 0, mine: 0, shared: 0 }
  for (const tx of transactions) {
    totals[tx.type] += tx.amount_cents
    if (tx.type === 'expense') {
      totals.mine += tx.my_cents
      totals.shared += tx.shared_cents
    }
  }
  return totals
}
