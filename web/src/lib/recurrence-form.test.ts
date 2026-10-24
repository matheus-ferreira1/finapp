import type { Category, Recurrence } from './api'
import {
  blankRecurrenceDraft,
  toRecurrenceDraft,
  toRecurrenceInput,
  withRecurrenceType,
  type RecurrenceDraft,
} from './recurrence-form'

const electricity: Recurrence = {
  id: 1,
  day: 31,
  description: 'Luz',
  type: 'expense',
  category_id: 5,
  estimated_amount_cents: 18050,
  split_rule_id: 10,
  active: true,
}

const draft = (changes: Partial<RecurrenceDraft> = {}): RecurrenceDraft => ({
  ...toRecurrenceDraft(electricity, 'pt-BR'),
  ...changes,
})

describe('toRecurrenceDraft', () => {
  it('turns a recurrence into editable text', () => {
    expect(toRecurrenceDraft(electricity, 'pt-BR')).toEqual({
      day: '31',
      description: 'Luz',
      type: 'expense',
      categoryId: '5',
      amount: '180,50',
      splitRuleId: '10',
      active: true,
    })
  })

  it('uses empty text for a missing sharing rule', () => {
    expect(toRecurrenceDraft({ ...electricity, split_rule_id: null }, 'en')).toMatchObject({
      splitRuleId: '',
      amount: '180.50',
    })
  })
})

describe('blankRecurrenceDraft', () => {
  it('starts as an active expense on the first day', () => {
    expect(blankRecurrenceDraft()).toEqual({
      day: '1',
      description: '',
      type: 'expense',
      categoryId: '',
      amount: '',
      splitRuleId: '',
      active: true,
    })
  })
})

describe('toRecurrenceInput', () => {
  it('converts a draft into the API payload', () => {
    expect(toRecurrenceInput(draft(), 'pt-BR')).toEqual({
      ok: true,
      input: {
        day: 31,
        description: 'Luz',
        type: 'expense',
        category_id: 5,
        estimated_amount_cents: 18050,
        split_rule_id: 10,
        active: true,
      },
    })
  })

  it('trims the description and reads the amount in the locale', () => {
    expect(toRecurrenceInput(draft({ description: '  Internet ', amount: '1.234,56' }), 'pt-BR')).toMatchObject({
      ok: true,
      input: { description: 'Internet', estimated_amount_cents: 123456 },
    })
  })

  it('drops the sharing rule from an income and leaves a missing category to the server', () => {
    expect(toRecurrenceInput(draft({ type: 'income' }), 'pt-BR')).toMatchObject({
      ok: true,
      input: { split_rule_id: null },
    })
    expect(toRecurrenceInput(draft({ categoryId: '' }), 'pt-BR')).toMatchObject({
      ok: true,
      input: { category_id: null },
    })
  })

  it.each([
    [{ day: '' }, 'invalidDay'],
    [{ day: '0' }, 'invalidDay'],
    [{ day: '32' }, 'invalidDay'],
    [{ day: '1.5' }, 'invalidDay'],
    [{ day: 'x' }, 'invalidDay'],
    [{ description: '   ' }, 'descriptionRequired'],
    [{ amount: '' }, 'invalidAmount'],
    [{ amount: '0' }, 'invalidAmount'],
    [{ amount: 'abc' }, 'invalidAmount'],
  ])('rejects %j before calling the server', (changes, error) => {
    expect(toRecurrenceInput(draft(changes as Partial<RecurrenceDraft>), 'pt-BR')).toEqual({ ok: false, error })
  })

  it('accepts the first and last days of a month', () => {
    expect(toRecurrenceInput(draft({ day: '1' }), 'pt-BR')).toMatchObject({ ok: true, input: { day: 1 } })
    expect(toRecurrenceInput(draft({ day: '31' }), 'pt-BR')).toMatchObject({ ok: true, input: { day: 31 } })
  })
})

describe('withRecurrenceType', () => {
  const categories: Category[] = [
    { id: 1, name: 'Salário', kind: 'income', archived: false },
    { id: 5, name: 'Moradia', kind: 'expense', archived: false },
  ]

  it('keeps a category of the new kind', () => {
    expect(withRecurrenceType(draft(), 'expense', categories)).toMatchObject({ categoryId: '5', splitRuleId: '10' })
  })

  it('clears a category of another kind and drops the sharing rule on an income', () => {
    expect(withRecurrenceType(draft(), 'income', categories)).toMatchObject({
      type: 'income',
      categoryId: '',
      splitRuleId: '',
    })
  })
})
