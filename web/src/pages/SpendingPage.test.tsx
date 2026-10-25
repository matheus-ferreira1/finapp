import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n from '../i18n'
import type { CategoryReportRow } from '../lib/api'
import { renderWithProviders, stubServer } from '../test-utils'

const months = (amounts: Record<number, number>) => Array.from({ length: 12 }, (_, i) => amounts[i + 1] ?? 0)

const rent: CategoryReportRow = {
  category_id: 1,
  name: 'Moradia',
  archived: false,
  months: months({ 1: 200000, 2: 200000 }),
  total_cents: 400000,
}
const food: CategoryReportRow = {
  category_id: 2,
  name: 'Mercado',
  archived: false,
  months: months({ 1: 50000, 3: 25050 }),
  total_cents: 75050,
}
const gym: CategoryReportRow = {
  category_id: 3,
  name: 'Academia',
  archived: true,
  months: months({ 12: 9000 }),
  total_cents: 9000,
}

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

async function open({
  route = '/spending',
  categoryRows = [rent, food],
  categoryReportFailure = null as string | null,
  today = new Date(2026, 9, 24),
} = {}) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(today)
  const server = stubServer({ categoryRows, categoryReportFailure })
  const user = userEvent.setup()
  renderWithProviders(<App />, { route })
  await screen.findByRole('heading', { level: 1, name: 'Gastos por Categoria' })
  return { server, user }
}

const table = () => screen.findByRole('table', { name: 'Gastos por Categoria' })
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent?.replace(/\s/g, ' '))
const categoryRow = (t: HTMLElement, name: string) => within(t).getByRole('row', { name: new RegExp(`^${name}`) })

describe('Table', () => {
  it('lists each category with its twelve months and a total', async () => {
    await open()
    const spending = await table()

    expect(within(spending).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Categoria', '01/2026', '02/2026', '03/2026', '04/2026', '05/2026', '06/2026',
      '07/2026', '08/2026', '09/2026', '10/2026', '11/2026', '12/2026', 'Total',
    ])
    expect(cells(categoryRow(spending, 'Moradia'))).toEqual([
      'R$ 2.000,00', 'R$ 2.000,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00',
      'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 4.000,00',
    ])
    expect(cells(categoryRow(spending, 'Mercado'))[2]).toBe('R$ 250,50')
  })

  it('adds a footer with the total of each month and of the year', async () => {
    await open()
    const spending = await table()

    const footer = within(spending).getByRole('row', { name: /^Total/ })
    expect(cells(footer)).toEqual([
      'R$ 2.500,00', 'R$ 2.000,00', 'R$ 250,50', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00',
      'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 4.750,50',
    ])
  })

  it('marks archived categories', async () => {
    await open({ categoryRows: [rent, gym] })
    const spending = await table()

    expect(categoryRow(spending, 'Academia')).toHaveTextContent('Arquivada')
    expect(categoryRow(spending, 'Moradia')).not.toHaveTextContent('Arquivada')
  })

  it('never wraps the text, so it scrolls instead', async () => {
    await open()

    expect(await table()).toHaveClass('whitespace-nowrap')
  })

  it('tells when there is no spending', async () => {
    await open({ categoryRows: [] })

    expect(await screen.findByText('Nenhum gasto neste ano.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('Options', () => {
  it('opens on the gross, planned view of the current year', async () => {
    const { server } = await open()
    await table()

    expect(screen.getByLabelText('Ano')).toHaveValue(2026)
    expect(screen.getByLabelText('Visão')).toHaveValue('gross')
    expect(screen.getByLabelText('Valores')).toHaveValue('all')
    expect(server.categoryReportRequests).toEqual([{ year: 2026, view: 'gross', scope: 'all' }])
  })

  it('opens on the options in the URL', async () => {
    const { server } = await open({ route: '/spending?year=2025&view=mine&scope=confirmed' })
    await table()

    expect(screen.getByLabelText('Ano')).toHaveValue(2025)
    expect(screen.getByLabelText('Visão')).toHaveValue('mine')
    expect(screen.getByLabelText('Valores')).toHaveValue('confirmed')
    expect(server.categoryReportRequests).toEqual([{ year: 2025, view: 'mine', scope: 'confirmed' }])
  })

  it('falls back to the defaults when the URL options are invalid', async () => {
    const { server } = await open({ route: '/spending?year=abc&view=net&scope=some' })
    await table()

    expect(server.categoryReportRequests).toEqual([{ year: 2026, view: 'gross', scope: 'all' }])
  })

  it('switches between gross and mine, and between planned and realized', async () => {
    const { server, user } = await open()
    await table()

    await user.selectOptions(screen.getByLabelText('Visão'), 'Meu')
    await user.selectOptions(screen.getByLabelText('Valores'), 'Realizado')

    await waitFor(() =>
      expect(server.categoryReportRequests.at(-1)).toEqual({ year: 2026, view: 'mine', scope: 'confirmed' }),
    )
  })

  it('keeps the other options when the year changes', async () => {
    const { server, user } = await open({ route: '/spending?view=mine&scope=confirmed' })
    await table()

    await user.click(screen.getByRole('button', { name: 'Ano anterior' }))

    await waitFor(() =>
      expect(server.categoryReportRequests.at(-1)).toEqual({ year: 2025, view: 'mine', scope: 'confirmed' }),
    )
  })

  it('keeps the year when another option changes', async () => {
    const { server, user } = await open({ route: '/spending?year=2024' })
    await table()

    await user.selectOptions(screen.getByLabelText('Visão'), 'Meu')

    await waitFor(() =>
      expect(server.categoryReportRequests.at(-1)).toEqual({ year: 2024, view: 'mine', scope: 'all' }),
    )
  })

  it('keeps the table on screen while the next year loads', async () => {
    const { user } = await open()
    await table()
    const answering = fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('year=2027') ? new Promise(() => {}) : answering(input, init),
    )

    await user.click(screen.getByRole('button', { name: 'Próximo ano' }))

    expect(screen.getByLabelText('Ano')).toHaveValue(2027)
    // the columns still belong to the year they were loaded for
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: '01/2026' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument()
  })
})

describe('States', () => {
  it('shows the error when the report cannot be loaded', async () => {
    await open({ categoryReportFailure: 'database is locked' })

    expect(await screen.findByRole('alert')).toHaveTextContent('database is locked')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a loading message until the report arrives', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}))
    renderWithProviders(<App />, { route: '/spending' })

    expect(await screen.findByText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('is translated to English', async () => {
    stubServer({
      settings: { partner_name: '', currency: 'USD', locale: 'en' },
      categoryRows: [rent],
    })
    renderWithProviders(<App />, { route: '/spending?year=2026' })

    const spending = await screen.findByRole('table', { name: 'Spending by Category' })
    expect(within(spending).getByRole('columnheader', { name: 'Category' })).toBeInTheDocument()
    expect(screen.getByLabelText('View')).toHaveValue('gross')
    expect(screen.getByLabelText('Amounts')).toHaveValue('all')
    expect(screen.getByLabelText('Year')).toHaveValue(2026)
    expect(cells(categoryRow(spending, 'Moradia'))[0]).toBe('$2,000.00')
  })
})
