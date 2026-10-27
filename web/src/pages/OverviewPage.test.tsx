import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n from '../i18n'
import type { Category, CategoryReportRow, Figures, MonthSummary, Settings, Transaction } from '../lib/api'
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
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, planned: none, realized: none, ...overrides[i + 1] }))
}

const category = (id: number, name: string, kind: Category['kind']): Category => ({ id, name, kind, archived: false })
const CATEGORIES = [category(1, 'Salário', 'income'), category(10, 'Moradia', 'expense'), category(11, 'Mercado', 'expense')]

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount_cents'>): Transaction {
  return {
    date: '2026-10-05',
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

const SALARY = tx({ id: 1, type: 'income', category_id: 1, amount_cents: 900000 })
const RENT = tx({ id: 2, type: 'expense', category_id: 10, amount_cents: 250000, my_cents: 125000, shared_cents: 125000 })
const GROCERIES = tx({ id: 3, type: 'expense', category_id: 11, amount_cents: 50000 })

const row = (id: number, name: string, months: Record<number, number>): CategoryReportRow => {
  const values = Array.from({ length: 12 }, (_, i) => months[i + 1] ?? 0)
  return { category_id: id, name, archived: false, months: values, total_cents: values.reduce((a, b) => a + b, 0) }
}

const owing = (cents: number): Partial<MonthSummary> => ({ realized: { ...none, owed_to_date_cents: cents } })

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

async function open({
  route = '/overview',
  transactions = [SALARY, RENT, GROCERIES],
  categoryRows = [row(10, 'Moradia', { 9: 200000, 10: 250000 }), row(11, 'Mercado', { 9: 100000, 10: 50000 })],
  monthly = year({ 10: owing(10000) }),
  settings = { partner_name: '', currency: 'BRL', locale: 'pt-BR' } as Settings,
  monthlyFailure = null as string | null,
  title = 'Visão Geral',
} = {}) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24))
  const server = stubServer({ settings, categories: CATEGORIES, transactions, categoryRows, monthly, monthlyFailure })
  const user = userEvent.setup()
  renderWithProviders(<App />, { route })
  await screen.findByRole('heading', { level: 1, name: title })
  return { server, user }
}

describe('Overview page', () => {
  it('says in one sentence what came in, what went out and what is left', async () => {
    await open()

    const hero = await screen.findByText(/Entraram/)
    expect(hero).toHaveTextContent('Entraram R$ 9.000,00, saíram R$ 3.000,00 e sobraram R$ 6.000,00.')
  })

  it('says how much was overspent when more went out than came in', async () => {
    await open({ transactions: [GROCERIES, RENT] })

    expect(await screen.findByText(/Entraram/)).toHaveTextContent('Entraram R$ 0,00, saíram R$ 3.000,00 e faltaram R$ 3.000,00.')
  })

  it('uses the word order of the language', async () => {
    await open({ settings: { partner_name: '', currency: 'USD', locale: 'en' }, title: 'Overview' })

    expect(await screen.findByText(/came in/)).toHaveTextContent('$9,000.00 came in, $3,000.00 went out and $6,000.00 was left over.')
  })

  it('draws where the money came from and where it went', async () => {
    await open()

    const flow = await screen.findByRole('group', { name: /Fluxo do dinheiro em outubro de 2026/ })
    for (const name of ['Salário', 'Moradia', 'Mercado', 'Sobrou']) expect(within(flow).getByText(name)).toBeInTheDocument()
    expect(within(flow).getByLabelText(/Salário → Moradia: R\$ 2\.500,00/)).toBeInTheDocument()
  })

  it('asks for the first transaction when the month has none', async () => {
    await open({ transactions: [] })

    expect(await screen.findByText('Nada registrado neste mês ainda.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Adicionar lançamento' })).toHaveAttribute('href', '/transactions?month=2026-10')
    expect(screen.queryByText(/Entraram/)).not.toBeInTheDocument()
  })

  it('shows only my share of the expenses in the mine view', async () => {
    const { server, user } = await open()
    await screen.findByText(/Entraram/)

    await user.click(screen.getByRole('button', { name: 'Meu' }))

    expect(await screen.findByText(/Entraram/)).toHaveTextContent('saíram R$ 1.750,00')
    expect(server.categoryReportRequests.at(-1)).toMatchObject({ year: 2026, view: 'mine', scope: 'all' })
  })

  it('opens in the requested month and view', async () => {
    const { server } = await open({ route: '/overview?month=2026-09&view=mine', transactions: [{ ...SALARY, date: '2026-09-05' }] })

    expect(await screen.findByText(/Entraram/)).toHaveTextContent('Entraram R$ 9.000,00, saíram R$ 0,00')
    expect(screen.getByRole('button', { name: 'Meu' })).toHaveAttribute('aria-pressed', 'true')
    expect(server.categoryReportRequests[0]).toMatchObject({ view: 'mine' })
  })

  it('moves to another month', async () => {
    const { user } = await open()
    await screen.findByText(/Entraram/)

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))

    expect(await screen.findByText('Nada registrado neste mês ainda.')).toBeInTheDocument()
  })

  it('draws the year, switching between expenses and income', async () => {
    const { user } = await open()

    expect(await screen.findByRole('group', { name: 'Despesas em 2026, mês a mês' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Receitas' }))
    expect(screen.getByRole('group', { name: 'Receitas em 2026, mês a mês' })).toBeInTheDocument()
  })

  describe('top expenses', () => {
    it('lists the biggest ones with the change since last month', async () => {
      await open()

      const top = await screen.findByRole('region', { name: 'Maiores despesas' })
      const items = within(top).getAllByRole('listitem')
      expect(items).toHaveLength(2)
      expect(items[0]).toHaveTextContent('Moradia')
      expect(items[0]).toHaveTextContent('+25% em relação ao mês anterior')
      expect(items[0]).toHaveTextContent('R$ 2.500,00')
      expect(items[1]).toHaveTextContent('Mercado')
      expect(items[1]).toHaveTextContent('-50% em relação ao mês anterior')
      expect(within(items[0]).getByRole('img', { name: 'Moradia, últimos meses' })).toBeInTheDocument()
    })

    it('compares January with December of the previous year', async () => {
      const { server } = await open({ route: '/overview?month=2026-01', categoryRows: [row(10, 'Moradia', { 1: 300000 })] })
      await screen.findByRole('region', { name: 'Maiores despesas' })

      await waitFor(() => expect(server.categoryReportRequests.map((r) => r.year).sort()).toEqual([2025, 2026]))
    })

    it('does not fetch the previous year outside January', async () => {
      const { server } = await open()
      await screen.findByRole('region', { name: 'Maiores despesas' })

      expect(server.categoryReportRequests.every((r) => r.year === 2026)).toBe(true)
    })

    it('is left out when nothing was spent', async () => {
      await open({ categoryRows: [] })
      await screen.findByText(/Entraram/)

      expect(screen.queryByRole('region', { name: 'Maiores despesas' })).not.toBeInTheDocument()
    })
  })

  describe('partner balance', () => {
    const withPartner: Settings = { partner_name: 'Ana', currency: 'BRL', locale: 'pt-BR' }

    it('is left out when no partner is set', async () => {
      await open()
      await screen.findByText(/Entraram/)

      expect(screen.queryByRole('region', { name: /Com / })).not.toBeInTheDocument()
    })

    it('says what the partner owes at the end of the month', async () => {
      await open({ settings: withPartner })

      const partner = await screen.findByRole('region', { name: 'Com Ana' })
      expect(partner).toHaveTextContent('Ana te deve R$ 100,00')
      expect(within(partner).getByRole('group', { name: 'Quanto Ana te deve no fim de cada mês' })).toBeInTheDocument()
    })

    it('says what the user owes when the balance is negative', async () => {
      await open({ settings: withPartner, monthly: year({ 10: owing(-25000) }) })

      expect(await screen.findByRole('region', { name: 'Com Ana' })).toHaveTextContent('Você deve R$ 250,00 a Ana')
    })

    it('says they are settled up at zero', async () => {
      await open({ settings: withPartner, monthly: year({ 10: owing(0) }) })

      expect(await screen.findByRole('region', { name: 'Com Ana' })).toHaveTextContent('Você e Ana estão quites')
    })
  })

  it('shows one error when the reports cannot be loaded', async () => {
    await open({ monthlyFailure: 'database is locked' })

    expect(await screen.findByRole('alert')).toHaveTextContent('database is locked')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
