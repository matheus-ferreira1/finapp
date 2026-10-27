import type { CategoryReportRow, Figures, MonthSummary, Transaction } from './api'

/** Which amount of an expense a chart shows: all that was paid, or only my part. */
export type View = 'gross' | 'mine'

export interface FlowNode {
  id: string
  /** The category name; empty for the nodes that are not a category (the page names those by `kind`). */
  label: string
  kind: 'income' | 'partner' | 'overspent' | 'expense' | 'leftover'
  categoryId: number | null
  value: number
}

export interface FlowLink {
  source: string
  target: string
  value: number
}

export interface Flow {
  sources: FlowNode[]
  targets: FlowNode[]
  links: FlowLink[]
}

/** Adds an amount to the node with this id, creating it on first use (keeps first-seen order). */
function accumulate(nodes: Map<string, FlowNode>, node: Omit<FlowNode, 'value'>, amount: number) {
  const known = nodes.get(node.id)
  if (known) known.value += amount
  else nodes.set(node.id, { ...node, value: amount })
}

/**
 * Where a month's money came from and where it went.
 *
 * Money comes from income categories (and, in the gross view, settlements received from the
 * partner); it goes to expense categories and whatever is left. When more went out than came
 * in, the difference is shown as an "overspent" source instead of a negative leftover, so every
 * node stays positive and both sides always add up to the same total.
 */
export function monthFlow(transactions: Transaction[], names: Map<number, string>, view: View): Flow {
  const sources = new Map<string, FlowNode>()
  const targets = new Map<string, FlowNode>()
  const nameOf = (id: number | null) => (id === null ? '' : (names.get(id) ?? ''))

  for (const tx of transactions) {
    if (tx.type === 'income') {
      accumulate(sources, { id: `income:${tx.category_id}`, label: nameOf(tx.category_id), kind: 'income', categoryId: tx.category_id }, tx.amount_cents)
    } else if (tx.type === 'settlement' && view === 'gross') {
      accumulate(sources, { id: 'partner', label: '', kind: 'partner', categoryId: null }, tx.amount_cents)
    } else if (tx.type === 'expense') {
      const amount = view === 'mine' ? tx.my_cents : tx.amount_cents
      accumulate(targets, { id: `expense:${tx.category_id}`, label: nameOf(tx.category_id), kind: 'expense', categoryId: tx.category_id }, amount)
    }
  }

  const income = sumValues(sources)
  const expense = sumValues(targets)
  if (income > expense) {
    targets.set('leftover', { id: 'leftover', label: '', kind: 'leftover', categoryId: null, value: income - expense })
  } else if (expense > income) {
    sources.set('overspent', { id: 'overspent', label: '', kind: 'overspent', categoryId: null, value: expense - income })
  }

  const sourceNodes = positive(sources)
  const targetNodes = positive(targets)
  const total = sumValues(sources)
  const links = sourceNodes.flatMap((s) =>
    targetNodes.map((t) => ({ source: s.id, target: t.id, value: (s.value * t.value) / total })),
  )
  return { sources: sourceNodes, targets: targetNodes, links }
}

const sumValues = (nodes: Map<string, FlowNode>) => [...nodes.values()].reduce((total, n) => total + n.value, 0)

const positive = (nodes: Map<string, FlowNode>) => [...nodes.values()].filter((n) => n.value > 0)

/** What came in, what went out and what is left (negative when overspent) in a month's flow. */
export function flowTotals(flow: Flow): { income: number; expense: number; balance: number } {
  const total = (nodes: FlowNode[], skip: FlowNode['kind']) => nodes.filter((n) => n.kind !== skip).reduce((sum, n) => sum + n.value, 0)
  const income = total(flow.sources, 'overspent')
  const expense = total(flow.targets, 'leftover')
  return { income, expense, balance: income - expense }
}

export interface PlanBar {
  month: number
  /** Already happened: drawn solid. */
  realized: number
  /** Planned but not yet confirmed: drawn hatched on top of the solid part. */
  pending: number
}

/** One bar per month for income or expenses, split into what is realized and what is still planned. */
export function planBars(months: MonthSummary[], view: View, measure: 'income' | 'expense'): PlanBar[] {
  const pick = (f: Figures) => f[view][`${measure}_cents`]
  return months.map((m) => {
    const realized = pick(m.realized)
    return { month: m.month, realized, pending: Math.max(0, pick(m.planned) - realized) }
  })
}

export interface StackSegment {
  categoryId: number
  name: string
  value: number
}

export interface MonthStack {
  month: number
  total: number
  segments: StackSegment[]
}

/** One stack per month of the year, a segment for every category that spent something in it. */
export function stackMonths(rows: CategoryReportRow[], hidden: ReadonlySet<number> = new Set()): MonthStack[] {
  const shown = rows.filter((row) => !hidden.has(row.category_id))
  return Array.from({ length: 12 }, (_, i) => {
    const segments = shown
      .filter((row) => row.months[i] > 0)
      .map((row) => ({ categoryId: row.category_id, name: row.name, value: row.months[i] }))
    return { month: i + 1, total: segments.reduce((total, s) => total + s.value, 0), segments }
  })
}

/** What the partner owes at the end of each month. */
export function balanceSeries(months: MonthSummary[], scope: 'planned' | 'realized'): number[] {
  return months.map((m) => m[scope].owed_to_date_cents)
}
