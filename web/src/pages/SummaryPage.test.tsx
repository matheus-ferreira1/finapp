import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n from '../i18n'
import type { Figures, MonthSummary } from '../lib/api'
import { renderWithProviders, stubServer } from '../test-utils'

const none: Figures = {
  gross: { income_cents: 0, expense_cents: 0, balance_cents: 0 },
  mine: { income_cents: 0, expense_cents: 0, balance_cents: 0 },
  shared_cents: 0,
  settled_cents: 0,
  owed_cents: 0,
  owed_to_date_cents: 0,
}

/** Twelve months of zeros, with the given months replaced. */
function year(overrides: Record<number, Partial<MonthSummary>>): MonthSummary[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    return { month, planned: none, realized: none, ...overrides[month] }
  })
}

const january: MonthSummary = {
  month: 1,
  planned: {
    gross: { income_cents: 1000000, expense_cents: 300000, balance_cents: 700000 },
    mine: { income_cents: 850000, expense_cents: 200000, balance_cents: 650000 },
    shared_cents: 100000,
    settled_cents: 40000,
    owed_cents: 60000,
    owed_to_date_cents: 60000,
  },
  realized: {
    gross: { income_cents: 900000, expense_cents: 250000, balance_cents: 650000 },
    mine: { income_cents: 800000, expense_cents: 150000, balance_cents: 650000 },
    shared_cents: 50000,
    settled_cents: 40000,
    owed_cents: 10000,
    owed_to_date_cents: 10000,
  },
}
const february: MonthSummary = {
  month: 2,
  planned: {
    gross: { income_cents: 500000, expense_cents: 600000, balance_cents: -100000 },
    mine: { income_cents: 500000, expense_cents: 450000, balance_cents: 50000 },
    shared_cents: 150000,
    settled_cents: 0,
    owed_cents: 150000,
    owed_to_date_cents: 210000,
  },
  realized: none,
}

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

async function open({
  route = '/summary',
  monthly = year({ 1: january, 2: february }),
  monthlyFailure = null as string | null,
  today = new Date(2026, 9, 24),
} = {}) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(today)
  const server = stubServer({ monthly, monthlyFailure })
  const user = userEvent.setup()
  renderWithProviders(<App />, { route })
  await screen.findByRole('heading', { level: 1, name: 'Resumo Mensal' })
  return { server, user }
}

const table = (name: string) => screen.findByRole('table', { name })
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent?.replace(/\s/g, ' '))
const monthRow = (t: HTMLElement, label: string) => within(t).getByRole('row', { name: new RegExp(`^${label}`) })

describe('Year', () => {
  it('opens on the current year', async () => {
    const { server } = await open()
    await table('Bruto')

    expect(screen.getByLabelText('Ano')).toHaveValue(2026)
    expect(server.monthlyRequests).toEqual([2026])
  })

  it('opens on the year in the URL', async () => {
    const { server } = await open({ route: '/summary?year=2025' })
    await table('Bruto')

    expect(screen.getByLabelText('Ano')).toHaveValue(2025)
    expect(server.monthlyRequests).toEqual([2025])
  })

  it('falls back to the current year when the URL year is invalid', async () => {
    const { server } = await open({ route: '/summary?year=abc' })
    await table('Bruto')

    expect(server.monthlyRequests).toEqual([2026])
  })

  it('moves to the previous and next years', async () => {
    const { server, user } = await open()
    await table('Bruto')

    await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
    await waitFor(() => expect(screen.getByLabelText('Ano')).toHaveValue(2025))
    await user.click(screen.getByRole('button', { name: 'Próximo ano' }))
    await user.click(screen.getByRole('button', { name: 'Próximo ano' }))
    await waitFor(() => expect(screen.getByLabelText('Ano')).toHaveValue(2027))

    expect(server.monthlyRequests).toEqual([2026, 2025, 2026, 2027])
  })

  it('jumps to a typed year', async () => {
    const { server, user } = await open()
    await table('Bruto')

    const input = screen.getByLabelText('Ano')
    await user.clear(input)
    await user.type(input, '2024')

    await waitFor(() => expect(server.monthlyRequests.at(-1)).toBe(2024))
  })
})

describe('Year input', () => {
  it('goes back to the shown year when left with an incomplete one', async () => {
    const { server, user } = await open()
    await table('Bruto')

    const input = screen.getByLabelText('Ano')
    await user.clear(input)
    await user.type(input, '202')
    await user.tab()

    expect(input).toHaveValue(2026)
    expect(server.monthlyRequests).toEqual([2026])
  })

  it('keeps the focus while a year is typed', async () => {
    const { user } = await open()
    await table('Bruto')

    const input = screen.getByLabelText('Ano')
    await user.clear(input)
    await user.type(input, '2024')

    await waitFor(() => expect(screen.getByLabelText('Ano')).toHaveValue(2024))
    expect(screen.getByLabelText('Ano')).toHaveFocus()
  })

  it('stops at the first and last supported years', async () => {
    await open({ route: '/summary?year=1000' })
    await table('Bruto')
    expect(screen.getByRole('button', { name: 'Ano anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeEnabled()
  })

  it('stops at the last supported year', async () => {
    await open({ route: '/summary?year=9999' })
    await table('Bruto')
    expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeDisabled()
  })

  it('keeps the tables on screen while the next year loads', async () => {
    const { user } = await open()
    await table('Bruto')
    const answering = fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('year=2027') ? new Promise(() => {}) : answering(input, init),
    )

    await user.click(screen.getByRole('button', { name: 'Próximo ano' }))

    expect(screen.getByLabelText('Ano')).toHaveValue(2027)
    // the rows still belong to the year they were loaded for
    expect(monthRow(screen.getByRole('table', { name: 'Bruto' }), '01/2026')).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
  })
})

describe('Gross and mine tables', () => {
  it('lists the twelve months with the planned and realized figures side by side', async () => {
    await open()
    const gross = await table('Bruto')

    const rows = within(gross).getAllByRole('row')
    expect(rows).toHaveLength(2 + 12) // two header rows
    expect(within(gross).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Mês', 'Previsto', 'Realizado', 'Receitas', 'Despesas', 'Balanço', 'Receitas', 'Despesas', 'Balanço',
    ])
    expect(cells(monthRow(gross, '01/2026'))).toEqual([
      'R$ 10.000,00', 'R$ 3.000,00', 'R$ 7.000,00',
      'R$ 9.000,00', 'R$ 2.500,00', 'R$ 6.500,00',
    ])
    expect(cells(monthRow(gross, '12/2026'))[0]).toBe('R$ 0,00')
  })

  it('shows a negative balance', async () => {
    await open()
    const gross = await table('Bruto')

    expect(cells(monthRow(gross, '02/2026'))[2]).toBe('-R$ 1.000,00')
  })

  it('highlights only negative balances', async () => {
    await open()
    const gross = await table('Bruto')
    const february = within(monthRow(gross, '02/2026')).getAllByRole('cell')
    const january = within(monthRow(gross, '01/2026')).getAllByRole('cell')

    expect(february[2]).toHaveClass('text-red-700')
    expect(january[2]).not.toHaveClass('text-red-700')
    expect(february[1]).not.toHaveClass('text-red-700') // expenses are not a balance
  })

  it('shows my share in its own table', async () => {
    await open()
    const mine = await table('Meu')

    expect(cells(monthRow(mine, '01/2026'))).toEqual([
      'R$ 8.500,00', 'R$ 2.000,00', 'R$ 6.500,00',
      'R$ 8.000,00', 'R$ 1.500,00', 'R$ 6.500,00',
    ])
  })

  it('labels the months with the year being shown', async () => {
    await open({ route: '/summary?year=2025' })
    const gross = await table('Bruto')

    expect(monthRow(gross, '01/2025')).toBeInTheDocument()
  })
})

describe('Settlement table', () => {
  it('shows what is shared, settled and owed, month and to date', async () => {
    await open()
    const settlement = await table('Saldo a acertar')

    expect(within(settlement).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Mês', 'Previsto', 'Realizado',
      'Compartilhado', 'Acertos', 'Saldo do mês', 'Acumulado',
      'Compartilhado', 'Acertos', 'Saldo do mês', 'Acumulado',
    ])
    expect(cells(monthRow(settlement, '01/2026'))).toEqual([
      'R$ 1.000,00', 'R$ 400,00', 'R$ 600,00', 'R$ 600,00',
      'R$ 500,00', 'R$ 400,00', 'R$ 100,00', 'R$ 100,00',
    ])
    expect(cells(monthRow(settlement, '02/2026'))[3]).toBe('R$ 2.100,00')
  })
})

describe('States', () => {
  it('shows the error when the report cannot be loaded', async () => {
    await open({ monthlyFailure: 'database is locked' })

    expect(await screen.findByRole('alert')).toHaveTextContent('database is locked')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a loading message until the report arrives', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}))
    renderWithProviders(<App />, { route: '/summary' })

    expect(await screen.findByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('is translated to English', async () => {
    // the app switches to English because of the locale setting
    stubServer({
      settings: { partner_name: '', currency: 'USD', locale: 'en' },
      monthly: year({ 1: january }),
    })
    renderWithProviders(<App />, { route: '/summary?year=2026' })

    expect(await screen.findByRole('table', { name: 'Gross' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Mine' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Amount to settle' })).toBeInTheDocument()
    expect(screen.getByLabelText('Year')).toHaveValue(2026)
    expect(screen.getAllByRole('columnheader', { name: 'Planned' })).toHaveLength(3)
    expect(cells(monthRow(screen.getByRole('table', { name: 'Gross' }), '01/2026'))[0]).toBe('$10,000.00')
  })
})
