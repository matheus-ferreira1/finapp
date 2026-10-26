import { fireEvent, render, screen } from '@testing-library/react'
import { monthFlow, type MonthStack, type PlanBar } from '../../lib/chart-data'
import type { Transaction } from '../../lib/api'
import { categoryColor } from '../../lib/category-colors'
import BalanceLine from './BalanceLine'
import FlowChart from './FlowChart'
import PlanBars from './PlanBars'
import Sparkline from './Sparkline'
import StackedBars from './StackedBars'

const format = (cents: number) => `$${(cents / 100).toFixed(2)}`
const monthLabel = (m: number) => `M${m}`
const shared = { format, formatTick: format, monthLabel }

describe('PlanBars', () => {
  const bars: PlanBar[] = [
    { month: 1, realized: 80000, pending: 20000 },
    { month: 2, realized: 0, pending: 50000 },
    { month: 3, realized: 30000, pending: 0 },
  ]
  const renderBars = () =>
    render(<PlanBars bars={bars} color="var(--income)" label="Income per month" legend={{ realized: 'Realized', pending: 'Planned' }} {...shared} />)

  it('describes the chart for people who cannot see it', () => {
    renderBars()
    expect(screen.getByRole('group', { name: 'Income per month' })).toBeInTheDocument()
  })

  it('draws the realized part solid and the planned part hatched', () => {
    const { container } = renderBars()
    const fills = [...container.querySelectorAll('svg[role="group"] path')].map((p) => p.getAttribute('fill'))

    expect(fills.filter((f) => f === 'var(--income)')).toHaveLength(2) // months 1 and 3
    expect(fills.filter((f) => f?.startsWith('url(#hatch-'))).toHaveLength(2) // months 1 and 2
  })

  it('names every month with its total, reachable by keyboard', () => {
    renderBars()
    expect(screen.getByLabelText('M1: $1000.00')).toHaveAttribute('tabindex', '0')
    expect(screen.getByLabelText('M2: $500.00')).toBeInTheDocument()
  })

  it('shows realized and planned amounts on focus and hides them on blur', () => {
    renderBars()
    const month = screen.getByLabelText('M1: $1000.00')

    fireEvent.focus(month)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('M1')
    expect(tip).toHaveTextContent('Realized$800.00')
    expect(tip).toHaveTextContent('Planned$200.00')

    fireEvent.blur(month)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('explains the solid and hatched marks in a legend', () => {
    renderBars()
    expect(screen.getByText('Realized')).toBeInTheDocument()
    expect(screen.getByText('Planned')).toBeInTheDocument()
  })
})

describe('StackedBars', () => {
  const stacks: MonthStack[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, segments: [] }))
  stacks[0] = {
    month: 1,
    total: 400,
    segments: [
      { categoryId: 10, name: 'Housing', value: 300 },
      { categoryId: 11, name: 'Groceries', value: 100 },
    ],
  }

  it('colours each segment with its category colour', () => {
    const { container } = render(<StackedBars stacks={stacks} label="Spending" {...shared} />)
    const fills = [...container.querySelectorAll('svg path')].map((p) => p.getAttribute('fill'))
    expect(fills).toEqual([categoryColor(10), categoryColor(11)])
  })

  it('lists the categories of a month in the tooltip, top of the stack first', () => {
    render(<StackedBars stacks={stacks} label="Spending" {...shared} />)

    fireEvent.mouseEnter(screen.getByLabelText('M1: $4.00'))

    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toMatch(/Groceries\$1\.00.*Housing\$3\.00/)
  })

  it('draws an empty year without failing', () => {
    const empty = stacks.map((s) => ({ ...s, total: 0, segments: [] }))
    const { container } = render(<StackedBars stacks={empty} label="Spending" {...shared} />)
    expect(container.querySelectorAll('svg path')).toHaveLength(0)
  })
})

describe('BalanceLine', () => {
  const values = [0, 100, 250, 250, 80, 0, 0, 0, 0, 0, 0, 0]

  it('draws one line with a marker for each month', () => {
    const { container } = render(<BalanceLine values={values} color="var(--owed)" label="Owed" title="Owed" {...shared} />)
    expect(container.querySelectorAll('svg path[stroke="var(--owed)"]')).toHaveLength(1)
    expect(container.querySelectorAll('g[tabindex="0"]')).toHaveLength(12)
  })

  it('shows the amount of a month on hover', () => {
    render(<BalanceLine values={values} color="var(--owed)" label="Owed" title="Owed" {...shared} />)
    fireEvent.mouseEnter(screen.getByLabelText('M3: $2.50'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Owed$2.50')
  })

  it('keeps a zero line when the balance goes negative', () => {
    const { container } = render(<BalanceLine values={[100, -50, 20]} color="var(--owed)" label="Owed" title="Owed" {...shared} />)
    expect(container.querySelectorAll('line[stroke="var(--ink-muted)"]')).toHaveLength(1)
  })
})

describe('Sparkline', () => {
  it('is an image with a text alternative', () => {
    render(<Sparkline values={[1, 3, 2]} color="var(--cat-blue)" label="Housing, last 3 months" />)
    expect(screen.getByRole('img', { name: 'Housing, last 3 months' })).toBeInTheDocument()
  })

  it('copes with a single value', () => {
    render(<Sparkline values={[5]} color="var(--cat-blue)" label="One month" />)
    expect(screen.getByRole('img', { name: 'One month' })).toBeInTheDocument()
  })
})

describe('FlowChart', () => {
  const tx = (partial: Partial<Transaction>): Transaction => ({
    id: 1,
    date: '2026-01-10',
    description: '',
    type: 'expense',
    category_id: null,
    amount_cents: 0,
    split_rule_id: null,
    installment_number: null,
    installment_total: null,
    confirmed: true,
    my_cents: partial.amount_cents ?? 0,
    shared_cents: 0,
    recurrence_id: null,
    recurrence_month: null,
    ...partial,
  })
  const names = new Map([
    [1, 'Salary'],
    [10, 'Housing'],
  ])
  const kindLabels = { partner: 'Partner', overspent: 'Overspent', leftover: 'Left over', uncategorized: 'No category' }
  const props = { label: 'Money flow', kindLabels, format }

  it('names where money came from and where it went, with the amounts', () => {
    const flow = monthFlow([tx({ type: 'income', category_id: 1, amount_cents: 100000 }), tx({ category_id: 10, amount_cents: 60000 })], names, 'gross')
    render(<FlowChart flow={flow} {...props} />)

    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('Housing')).toBeInTheDocument()
    expect(screen.getByText('Left over')).toBeInTheDocument()
    expect(screen.getByText('$400.00')).toBeInTheDocument()
  })

  it('labels the overspent source when more went out than came in', () => {
    const flow = monthFlow([tx({ type: 'income', category_id: 1, amount_cents: 1000 }), tx({ category_id: 10, amount_cents: 5000 })], names, 'gross')
    render(<FlowChart flow={flow} {...props} />)
    expect(screen.getByText('Overspent')).toBeInTheDocument()
    expect(screen.queryByText('Left over')).not.toBeInTheDocument()
  })

  it('describes each ribbon and shows its amount on focus', () => {
    const flow = monthFlow([tx({ type: 'income', category_id: 1, amount_cents: 100000 }), tx({ category_id: 10, amount_cents: 60000 })], names, 'gross')
    render(<FlowChart flow={flow} {...props} />)

    fireEvent.focus(screen.getByLabelText('Salary → Housing: $600.00'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Salary → Housing')
  })

  it('draws the ribbons in only when asked to', () => {
    const flow = monthFlow([tx({ type: 'income', category_id: 1, amount_cents: 100000 }), tx({ category_id: 10, amount_cents: 60000 })], names, 'gross')
    const { container, rerender } = render(<FlowChart flow={flow} {...props} />)
    expect(container.querySelector('.flow-draw')).toBeNull()

    rerender(<FlowChart flow={flow} {...props} animate />)
    expect(container.querySelector('.flow-draw')).not.toBeNull()
  })

  it('draws an empty month without failing', () => {
    render(<FlowChart flow={{ sources: [], targets: [], links: [] }} {...props} />)
    expect(screen.getByRole('group', { name: 'Money flow' })).toBeInTheDocument()
  })
})
