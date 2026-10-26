import { describe, expect, it } from 'vitest'
import type { CategoryReportRow, Figures, MonthSummary, Transaction } from './api'
import { balanceSeries, monthFlow, planBars, stackMonths } from './chart-data'

const NAMES = new Map([
  [1, 'Salary'],
  [2, 'Freelance'],
  [10, 'Housing'],
  [11, 'Groceries'],
])

function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount_cents'>): Transaction {
  return {
    id: 1,
    date: '2026-01-10',
    description: '',
    category_id: null,
    split_rule_id: null,
    installment_number: null,
    installment_total: null,
    confirmed: true,
    my_cents: partial.type === 'expense' ? partial.amount_cents : 0,
    shared_cents: 0,
    recurrence_id: null,
    recurrence_month: null,
    ...partial,
  }
}

const sum = (nodes: { value: number }[]) => nodes.reduce((total, n) => total + n.value, 0)

describe('monthFlow', () => {
  const salary = tx({ type: 'income', category_id: 1, amount_cents: 500000 })
  const freelance = tx({ type: 'income', category_id: 2, amount_cents: 100000 })
  const rent = tx({ type: 'expense', category_id: 10, amount_cents: 200000, my_cents: 100000, shared_cents: 100000 })
  const food = tx({ type: 'expense', category_id: 11, amount_cents: 100000 })
  const settlement = tx({ type: 'settlement', amount_cents: 50000 })

  it('sums income per category and expenses per category, with the leftover as a target', () => {
    const flow = monthFlow([salary, freelance, rent, food, rent], NAMES, 'gross')

    expect(flow.sources.map((n) => [n.label, n.value])).toEqual([
      ['Salary', 500000],
      ['Freelance', 100000],
    ])
    expect(flow.targets.map((n) => [n.label, n.value, n.kind])).toEqual([
      ['Housing', 400000, 'expense'],
      ['Groceries', 100000, 'expense'],
      ['', 100000, 'leftover'],
    ])
  })

  it('balances: what comes in equals what goes out', () => {
    const flow = monthFlow([salary, freelance, rent, food], NAMES, 'gross')
    expect(sum(flow.sources)).toBe(sum(flow.targets))
    expect(sum(flow.links)).toBeCloseTo(sum(flow.sources))
  })

  it('counts settlements received as a partner source in the gross view', () => {
    const flow = monthFlow([salary, settlement, food], NAMES, 'gross')
    expect(flow.sources.find((n) => n.kind === 'partner')?.value).toBe(50000)
  })

  it('ignores settlements and cuts expenses to my part in the mine view', () => {
    const flow = monthFlow([salary, settlement, rent], NAMES, 'mine')
    expect(flow.sources.map((n) => n.kind)).toEqual(['income'])
    expect(flow.targets.find((n) => n.label === 'Housing')?.value).toBe(100000)
  })

  it('turns a deficit into an overspent source so every node stays positive', () => {
    const flow = monthFlow([freelance, rent, food], NAMES, 'gross')

    expect(flow.sources.find((n) => n.kind === 'overspent')?.value).toBe(200000)
    expect(flow.targets.some((n) => n.kind === 'leftover')).toBe(false)
    expect([...flow.sources, ...flow.targets].every((n) => n.value > 0)).toBe(true)
    expect(sum(flow.sources)).toBe(sum(flow.targets))
  })

  it('splits each source over the targets in proportion', () => {
    const flow = monthFlow([salary, freelance, food], NAMES, 'gross')
    const link = flow.links.find((l) => l.source === 'income:1' && l.target === 'expense:11')
    // 500k of 600k income, 100k of 600k going to groceries
    expect(link?.value).toBeCloseTo((500000 * 100000) / 600000)
  })

  it('is empty when nothing moved', () => {
    expect(monthFlow([], NAMES, 'gross')).toEqual({ sources: [], targets: [], links: [] })
  })

  it('names a category it does not know with an empty label rather than failing', () => {
    const flow = monthFlow([tx({ type: 'expense', category_id: 99, amount_cents: 100 })], NAMES, 'gross')
    expect(flow.targets[0].label).toBe('')
  })
})

function figures(income: number, expense: number): Figures {
  const totals = { income_cents: income, expense_cents: expense, balance_cents: income - expense }
  return { gross: totals, mine: totals, shared_cents: 0, settled_cents: 0, owed_cents: 0, owed_to_date_cents: 0 }
}

function month(m: number, planned: Figures, realized: Figures): MonthSummary {
  return { month: m, planned, realized }
}

describe('planBars', () => {
  const months = [month(1, figures(1000, 400), figures(800, 400)), month(2, figures(500, 300), figures(0, 0))]

  it('splits a month into the realized part and what is still only planned', () => {
    expect(planBars(months, 'gross', 'income')).toEqual([
      { month: 1, realized: 800, pending: 200 },
      { month: 2, realized: 0, pending: 500 },
    ])
  })

  it('reads the chosen measure and view', () => {
    expect(planBars(months, 'mine', 'expense').map((b) => b.realized + b.pending)).toEqual([400, 300])
  })

  it('never reports a negative pending amount', () => {
    const odd = [month(1, figures(100, 0), figures(150, 0))]
    expect(planBars(odd, 'gross', 'income')[0].pending).toBe(0)
  })
})

describe('stackMonths', () => {
  const row = (id: number, name: string, months: number[]): CategoryReportRow => ({
    category_id: id,
    name,
    archived: false,
    months: [...months, ...Array(12 - months.length).fill(0)],
    total_cents: months.reduce((a, b) => a + b, 0),
  })

  it('builds one stack per month with a segment per category that has spending', () => {
    const stacks = stackMonths([row(10, 'Housing', [300, 0]), row(11, 'Groceries', [100, 50])])

    expect(stacks).toHaveLength(12)
    expect(stacks[0]).toEqual({
      month: 1,
      total: 400,
      segments: [
        { categoryId: 10, name: 'Housing', value: 300 },
        { categoryId: 11, name: 'Groceries', value: 100 },
      ],
    })
    expect(stacks[1].segments.map((s) => s.categoryId)).toEqual([11])
    expect(stacks[2]).toEqual({ month: 3, total: 0, segments: [] })
  })

  it('can leave categories out, keeping the others where they are', () => {
    const stacks = stackMonths([row(10, 'Housing', [300]), row(11, 'Groceries', [100])], new Set([10]))
    expect(stacks[0].total).toBe(100)
    expect(stacks[0].segments.map((s) => s.categoryId)).toEqual([11])
  })
})

describe('balanceSeries', () => {
  it('reads what the partner owes at the end of each month for the chosen scope', () => {
    const a = { ...figures(0, 0), owed_to_date_cents: 100 }
    const b = { ...figures(0, 0), owed_to_date_cents: 40 }
    const months = [month(1, a, b), month(2, b, a)]

    expect(balanceSeries(months, 'planned')).toEqual([100, 40])
    expect(balanceSeries(months, 'realized')).toEqual([40, 100])
  })
})
