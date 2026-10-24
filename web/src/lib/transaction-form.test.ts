import type { Transaction } from './api'
import type { Category } from './api'
import { blankDraft, monthTotals, toDraft, toInput, withType, type Draft } from './transaction-form'

const rent: Transaction = {
  id: 1,
  date: '2026-11-03',
  description: 'Aluguel',
  type: 'expense',
  category_id: 5,
  amount_cents: 150000,
  split_rule_id: 10,
  installment_number: 2,
  installment_total: 12,
  confirmed: true,
  my_cents: 75000,
  shared_cents: 75000,
  recurrence_id: null,
  recurrence_month: null,
}

const draft = (changes: Partial<Draft> = {}): Draft => ({ ...toDraft(rent, 'pt-BR'), ...changes })

describe('toDraft', () => {
  it('turns a transaction into editable text', () => {
    expect(toDraft(rent, 'pt-BR')).toEqual({
      date: '2026-11-03',
      description: 'Aluguel',
      type: 'expense',
      categoryId: '5',
      amount: '1500,00',
      splitRuleId: '10',
      installment: '2/12',
      confirmed: true,
    })
  })

  it('uses empty text for what is missing', () => {
    const settlement: Transaction = {
      ...rent,
      type: 'settlement',
      category_id: null,
      split_rule_id: null,
      installment_number: null,
      installment_total: null,
    }
    expect(toDraft(settlement, 'en')).toMatchObject({ categoryId: '', splitRuleId: '', installment: '', amount: '1500.00' })
  })
})

describe('blankDraft', () => {
  it('starts an unconfirmed expense on the given date', () => {
    expect(blankDraft('2026-11-24')).toEqual({
      date: '2026-11-24',
      description: '',
      type: 'expense',
      categoryId: '',
      amount: '',
      splitRuleId: '',
      installment: '',
      confirmed: false,
    })
  })
})

describe('toInput', () => {
  it('converts a draft into the API payload', () => {
    expect(toInput(draft(), 'pt-BR')).toEqual({
      ok: true,
      input: {
        date: '2026-11-03',
        description: 'Aluguel',
        type: 'expense',
        category_id: 5,
        amount_cents: 150000,
        split_rule_id: 10,
        installment_number: 2,
        installment_total: 12,
        confirmed: true,
      },
    })
  })

  it('trims the description and understands the typed amount', () => {
    const result = toInput(draft({ description: '  Mercado  ', amount: '1.234,56' }), 'pt-BR')
    expect(result).toMatchObject({ ok: true, input: { description: 'Mercado', amount_cents: 123456 } })
  })

  it('drops category, rule and installment that do not apply to the type', () => {
    expect(toInput(draft({ type: 'settlement' }), 'pt-BR')).toMatchObject({
      ok: true,
      input: { category_id: null, split_rule_id: null },
    })
    expect(toInput(draft({ type: 'income' }), 'pt-BR')).toMatchObject({
      ok: true,
      input: { category_id: 5, split_rule_id: null },
    })
  })

  it('treats a blank installment as none and accepts spaces around the slash', () => {
    expect(toInput(draft({ installment: '' }), 'pt-BR')).toMatchObject({
      input: { installment_number: null, installment_total: null },
    })
    expect(toInput(draft({ installment: ' 3 / 10 ' }), 'pt-BR')).toMatchObject({
      input: { installment_number: 3, installment_total: 10 },
    })
  })

  it('leaves a missing category as null for the server to judge', () => {
    expect(toInput(draft({ categoryId: '' }), 'pt-BR')).toMatchObject({ ok: true, input: { category_id: null } })
  })

  it.each([
    ['amount', { amount: '' }, 'invalidAmount'],
    ['amount', { amount: 'abc' }, 'invalidAmount'],
    ['amount', { amount: '0' }, 'invalidAmount'],
    ['date', { date: '' }, 'invalidDate'],
    ['date', { date: '03/11/2026' }, 'invalidDate'],
    ['installment', { installment: '2' }, 'invalidInstallment'],
    ['installment', { installment: '0/12' }, 'invalidInstallment'],
    ['installment', { installment: '13/12' }, 'invalidInstallment'],
    ['installment', { installment: 'a/b' }, 'invalidInstallment'],
  ])('rejects an invalid %s (%j) before calling the server', (_field, changes, error) => {
    expect(toInput(draft(changes as Partial<Draft>), 'pt-BR')).toEqual({ ok: false, error })
  })
})

describe('monthTotals', () => {
  const tx = (changes: Partial<Transaction>): Transaction => ({ ...rent, ...changes })

  it('sums each kind and splits expenses into my part and shared', () => {
    const totals = monthTotals([
      tx({ type: 'income', amount_cents: 500000, my_cents: 500000, shared_cents: 0 }),
      tx({ type: 'expense', amount_cents: 20000, my_cents: 10000, shared_cents: 10000 }),
      tx({ type: 'expense', amount_cents: 3000, my_cents: 3000, shared_cents: 0 }),
      tx({ type: 'settlement', amount_cents: 4000, my_cents: 0, shared_cents: 0 }),
    ])

    expect(totals).toEqual({ income: 500000, expense: 23000, settlement: 4000, mine: 13000, shared: 10000 })
  })

  it('is all zeros for an empty month', () => {
    expect(monthTotals([])).toEqual({ income: 0, expense: 0, settlement: 0, mine: 0, shared: 0 })
  })
})

describe('withType', () => {
  const categories: Category[] = [
    { id: 1, name: 'Salary', kind: 'income', archived: false },
    { id: 5, name: 'Housing', kind: 'expense', archived: false },
  ]

  it('keeps a category of the new kind', () => {
    expect(withType(draft({ categoryId: '5' }), 'expense', categories)).toMatchObject({ type: 'expense', categoryId: '5' })
  })

  it('clears a category of another kind', () => {
    expect(withType(draft({ categoryId: '5' }), 'income', categories)).toMatchObject({ type: 'income', categoryId: '' })
  })

  it('drops the sharing rule unless the row is an expense', () => {
    expect(withType(draft(), 'income', categories).splitRuleId).toBe('')
    expect(withType(draft(), 'settlement', categories).splitRuleId).toBe('')
    expect(withType(draft(), 'expense', categories).splitRuleId).toBe('10')
  })

  it('drops the category of a settlement', () => {
    expect(withType(draft({ categoryId: '5' }), 'settlement', categories)).toMatchObject({ categoryId: '', type: 'settlement' })
  })
})
