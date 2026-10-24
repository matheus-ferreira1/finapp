import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n from '../i18n'
import type { Category, SplitRule, Transaction } from '../lib/api'
import { renderWithProviders, stubServer } from '../test-utils'

const categories: Category[] = [
  { id: 1, name: 'Salário', kind: 'income', archived: false },
  { id: 2, name: 'Alimentação', kind: 'expense', archived: false },
  { id: 3, name: 'Moradia', kind: 'expense', archived: false },
  { id: 4, name: 'Academia', kind: 'expense', archived: true },
]
const splitRules: SplitRule[] = [
  { id: 10, name: '50/50', my_percent: 50, archived: false },
  { id: 11, name: '30/70', my_percent: 30, archived: true },
]

const base = {
  split_rule_id: null,
  installment_number: null,
  installment_total: null,
  recurrence_id: null,
  recurrence_month: null,
}
const salary: Transaction = {
  ...base, id: 1, date: '2026-11-05', description: 'Salário nov', type: 'income', category_id: 1,
  amount_cents: 500000, confirmed: true, my_cents: 500000, shared_cents: 0,
}
const rent: Transaction = {
  ...base, id: 2, date: '2026-11-03', description: 'Aluguel', type: 'expense', category_id: 3,
  amount_cents: 150000, split_rule_id: 10, installment_number: 2, installment_total: 12,
  confirmed: true, my_cents: 75000, shared_cents: 75000,
}
const settlement: Transaction = {
  ...base, id: 3, date: '2026-11-20', description: 'Acerto Ana', type: 'settlement', category_id: null,
  amount_cents: 4000, confirmed: true, my_cents: 0, shared_cents: 0,
}
const internet: Transaction = {
  ...base, id: 4, date: '2026-12-10', description: 'Internet', type: 'expense', category_id: 3,
  amount_cents: 8000, confirmed: false, my_cents: 8000, shared_cents: 0,
}

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

/** Opens the screen with a fake server; `today` fixes the current date. */
async function open({ route = '/transactions?month=2026-11', today = new Date(2026, 9, 24), transactions = [rent, salary, settlement, internet] } = {}) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(today)
  const server = stubServer({ categories, splitRules, transactions: structuredClone(transactions) })
  const user = userEvent.setup()
  renderWithProviders(<App />, { route })
  await screen.findByRole('heading', { level: 1, name: 'Lançamentos' })
  return { server, user }
}

const row = (name: string) => screen.findByRole('row', { name })
const optionTexts = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent)

describe('Listing', () => {
  it('shows the month in date order with the computed amounts', async () => {
    await open()
    await row('Aluguel')

    const names = screen.getAllByRole('row').map((r) => r.getAttribute('aria-label')).filter(Boolean)
    expect(names).toEqual(['Novo lançamento', 'Aluguel', 'Salário nov', 'Acerto Ana'])

    const rent = await row('Aluguel')
    expect(within(rent).getByLabelText('Descrição')).toHaveValue('Aluguel')
    expect(within(rent).getByLabelText('Data')).toHaveValue('2026-11-03')
    expect(within(rent).getByLabelText('Valor')).toHaveValue('1500,00')
    expect(within(rent).getByLabelText('Tipo')).toHaveValue('expense')
    expect(within(rent).getByLabelText('Categoria')).toHaveValue('3')
    expect(within(rent).getByLabelText('Compartilhamento')).toHaveValue('10')
    expect(within(rent).getByLabelText('Parcela')).toHaveValue('2/12')
    expect(within(rent).getByLabelText('Confirmado')).toBeChecked()
    expect(within(rent).getAllByText('R$ 750,00')).toHaveLength(2) // my amount and shared amount
  })

  it('totals the month in the footer', async () => {
    await open()
    await row('Aluguel')
    const totals = screen.getByRole('group', { name: 'Totais do mês' })

    const value = (term: string) => within(totals).getByText(term).parentElement
    expect(value('Receitas')).toHaveTextContent('R$ 5.000,00')
    expect(value('Despesas')).toHaveTextContent('R$ 1.500,00')
    expect(value('Acertos')).toHaveTextContent('R$ 40,00')
    expect(value('Minha parte')).toHaveTextContent('R$ 750,00')
    expect(value('Compartilhado')).toHaveTextContent('R$ 750,00')
  })

  it('says so when the month is empty and still offers the new row', async () => {
    await open({ transactions: [] })

    expect(await screen.findByText('Nenhum lançamento neste mês.')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: 'Novo lançamento' })).toBeInTheDocument()
  })
})

describe('Month navigation', () => {
  it('moves between months and shows each month', async () => {
    const { user } = await open()
    await row('Aluguel')
    expect(screen.getByText('11/2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await row('Internet')).toBeInTheDocument()
    expect(screen.getByText('12/2026')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: 'Aluguel' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(await row('Aluguel')).toBeInTheDocument()
  })

  it('jumps to a month picked from the calendar', async () => {
    await open()
    await row('Aluguel')

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-12' } })

    expect(await row('Internet')).toBeInTheDocument()
  })

  it('opens the current month when none is given', async () => {
    await open({ route: '/transactions', today: new Date(2026, 10, 24) })

    expect(await row('Aluguel')).toBeInTheDocument()
    expect(screen.getByText('11/2026')).toBeInTheDocument()
  })

  it('falls back to the current month when the URL is invalid', async () => {
    await open({ route: '/transactions?month=banana', today: new Date(2026, 10, 24) })

    expect(await row('Aluguel')).toBeInTheDocument()
  })
})

describe('Editing a row in place', () => {
  it('saves a text change when the field loses focus, sending the whole row', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    const description = within(r).getByLabelText('Descrição')
    await user.clear(description)
    await user.type(description, 'Aluguel nov')
    await user.tab()

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0]).toEqual({
      method: 'PUT',
      path: '/api/transactions/2',
      body: {
        date: '2026-11-03', description: 'Aluguel nov', type: 'expense', category_id: 3, amount_cents: 150000,
        split_rule_id: 10, installment_number: 2, installment_total: 12, confirmed: true,
      },
    })
    expect(await row('Aluguel nov')).toBeInTheDocument()
  })

  it('saves with Enter', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.type(within(r).getByLabelText('Descrição'), ' x{Enter}')

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ description: 'Aluguel x' })
  })

  it('does not call the server when nothing changed', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.click(within(r).getByLabelText('Descrição'))
    await user.tab()

    expect(server.writes).toEqual([])
  })

  it('reads the amount in the locale and refreshes the computed amounts', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    const amount = within(r).getByLabelText('Valor')
    await user.clear(amount)
    await user.type(amount, '1.600,00')
    await user.tab()

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ amount_cents: 160000 })
    await waitFor(() => expect(within(r).getAllByText('R$ 800,00')).toHaveLength(2))
  })

  it('rejects an invalid amount without calling the server and keeps what was typed', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    const amount = within(r).getByLabelText('Valor')
    await user.clear(amount)
    await user.type(amount, 'abc')
    await user.tab()

    expect(await within(r).findByRole('alert')).toHaveTextContent('Informe um valor maior que zero.')
    expect(amount).toHaveValue('abc')
    expect(server.writes).toEqual([])
  })

  it('saves a changed date and moves the row out of the month', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    const date = within(r).getByLabelText('Data')
    await user.click(date) // a user focuses the field before changing it
    fireEvent.change(date, { target: { value: '2026-12-02' } })
    await user.tab()

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ date: '2026-12-02' })
    await waitFor(() => expect(screen.queryByRole('row', { name: 'Aluguel' })).not.toBeInTheDocument())
  })

  it('edits the installment and rejects a malformed one', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')
    const installment = within(r).getByLabelText('Parcela')

    await user.clear(installment)
    await user.type(installment, '3')
    await user.tab()
    expect(await within(r).findByRole('alert')).toHaveTextContent('parcela/total')
    expect(server.writes).toEqual([])

    await user.clear(installment)
    await user.type(installment, '3/12')
    await user.tab()
    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ installment_number: 3, installment_total: 12 })
  })

  it('toggles confirmed immediately', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.click(within(r).getByLabelText('Confirmado'))

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ confirmed: false })
    await waitFor(() => expect(within(r).getByLabelText('Confirmado')).not.toBeChecked())
  })

  it('changes the sharing rule immediately and recomputes the amounts', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.selectOptions(within(r).getByLabelText('Compartilhamento'), '')

    await waitFor(() => expect(server.writes[0].body).toMatchObject({ split_rule_id: null }))
    await waitFor(() => expect(within(r).getByText('R$ 1.500,00', { selector: 'td' })).toBeInTheDocument())
  })

  it('offers only the categories of the row type and the active sharing rules', async () => {
    await open()
    const expense = await row('Aluguel')
    const income = await row('Salário nov')

    expect(optionTexts(within(expense).getByLabelText('Categoria'))).toEqual(['—', 'Alimentação', 'Moradia'])
    expect(optionTexts(within(income).getByLabelText('Categoria'))).toEqual(['—', 'Salário'])
    expect(optionTexts(within(expense).getByLabelText('Compartilhamento'))).toEqual(['Só meu', '50/50'])
  })

  it('keeps an archived category visible on the rows that still use it', async () => {
    await open({ transactions: [{ ...rent, category_id: 4 }] })
    const r = await row('Aluguel')

    expect(within(r).getByLabelText('Categoria')).toHaveValue('4')
    expect(optionTexts(within(r).getByLabelText('Categoria'))).toContain('Academia')
  })

  it('turns a row into a settlement: no category, no sharing rule', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.selectOptions(within(r).getByLabelText('Tipo'), 'settlement')

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ type: 'settlement', category_id: null, split_rule_id: null })
    await waitFor(() => expect(within(r).getByLabelText('Categoria')).toBeDisabled())
    expect(within(r).getByLabelText('Compartilhamento')).toBeDisabled()
  })

  it('clears a category of the wrong kind when the type changes', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.selectOptions(within(r).getByLabelText('Tipo'), 'income')

    // Moradia is an expense category, so it cannot stay on an income row.
    expect(await within(r).findByRole('alert')).toHaveTextContent('category is required')
    expect(server.writes[0].body).toMatchObject({ type: 'income', category_id: null, split_rule_id: null })
  })

  it('shows the server error in the row and keeps the draft', async () => {
    const { user } = await open()
    const r = await row('Aluguel')

    await user.selectOptions(within(r).getByLabelText('Categoria'), '')

    expect(await within(r).findByRole('alert')).toHaveTextContent('category is required for income and expense')
    expect(within(r).getByLabelText('Categoria')).toHaveValue('')
  })
})

describe('New transaction', () => {
  it('starts as an unconfirmed expense on the first day of another month', async () => {
    await open()
    const r = await screen.findByRole('row', { name: 'Novo lançamento' })

    expect(within(r).getByLabelText('Data')).toHaveValue('2026-11-01')
    expect(within(r).getByLabelText('Tipo')).toHaveValue('expense')
    expect(within(r).getByLabelText('Confirmado')).not.toBeChecked()
  })

  it('starts today when the month is the current one', async () => {
    await open({ today: new Date(2026, 10, 24) })
    const r = await screen.findByRole('row', { name: 'Novo lançamento' })

    expect(within(r).getByLabelText('Data')).toHaveValue('2026-11-24')
  })

  it('creates the transaction and clears the row', async () => {
    const { server, user } = await open()
    const r = await screen.findByRole('row', { name: 'Novo lançamento' })

    await user.type(within(r).getByLabelText('Descrição'), 'Mercado')
    await user.type(within(r).getByLabelText('Valor'), '85,90')
    await user.selectOptions(within(r).getByLabelText('Categoria'), '2')
    await user.selectOptions(within(r).getByLabelText('Compartilhamento'), '10')
    await user.click(within(r).getByRole('button', { name: 'Adicionar' }))

    expect(await row('Mercado')).toBeInTheDocument()
    expect(server.writes).toEqual([
      {
        method: 'POST',
        path: '/api/transactions',
        body: {
          date: '2026-11-01', description: 'Mercado', type: 'expense', category_id: 2, amount_cents: 8590,
          split_rule_id: 10, installment_number: null, installment_total: null, confirmed: false,
        },
      },
    ])
    expect(within(r).getByLabelText('Descrição')).toHaveValue('')
    expect(within(r).getByLabelText('Valor')).toHaveValue('')
  })

  it('does not call the server without a valid amount', async () => {
    const { server, user } = await open()
    const r = await screen.findByRole('row', { name: 'Novo lançamento' })

    await user.click(within(r).getByRole('button', { name: 'Adicionar' }))

    expect(await within(r).findByRole('alert')).toHaveTextContent('Informe um valor maior que zero.')
    expect(server.writes).toEqual([])
  })

  it('keeps what was typed when the server refuses it', async () => {
    const { user } = await open()
    const r = await screen.findByRole('row', { name: 'Novo lançamento' })

    await user.type(within(r).getByLabelText('Descrição'), 'Mercado')
    await user.type(within(r).getByLabelText('Valor'), '10')
    await user.click(within(r).getByRole('button', { name: 'Adicionar' })) // no category chosen

    expect(await within(r).findByRole('alert')).toHaveTextContent('category is required')
    expect(within(r).getByLabelText('Descrição')).toHaveValue('Mercado')
  })
})

describe('Deleting', () => {
  it('asks for confirmation inside the row, then deletes', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.click(within(r).getByRole('button', { name: 'Excluir Aluguel' }))
    expect(server.writes).toEqual([])
    await user.click(within(r).getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => expect(screen.queryByRole('row', { name: 'Aluguel' })).not.toBeInTheDocument())
    expect(server.writes).toEqual([{ method: 'DELETE', path: '/api/transactions/2', body: {} }])
  })

  it('keeps the row when the deletion is cancelled', async () => {
    const { server, user } = await open()
    const r = await row('Aluguel')

    await user.click(within(r).getByRole('button', { name: 'Excluir Aluguel' }))
    await user.click(within(r).getByRole('button', { name: 'Cancelar' }))

    expect(within(r).getByRole('button', { name: 'Excluir Aluguel' })).toBeInTheDocument()
    expect(server.writes).toEqual([])
  })
})
