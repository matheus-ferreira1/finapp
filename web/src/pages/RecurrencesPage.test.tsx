import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n from '../i18n'
import type { Category, Recurrence, SplitRule, Transaction } from '../lib/api'
import { renderWithProviders, stubServer } from '../test-utils'

const categories: Category[] = [
  { id: 1, name: 'Salário', kind: 'income', archived: false },
  { id: 2, name: 'Academia', kind: 'expense', archived: false },
  { id: 3, name: 'Moradia', kind: 'expense', archived: false },
  { id: 4, name: 'Antiga', kind: 'expense', archived: true },
]
const splitRules: SplitRule[] = [
  { id: 10, name: '50/50', my_percent: 50, archived: false },
  { id: 11, name: '30/70', my_percent: 30, archived: true },
]
const salary: Recurrence = {
  id: 1, day: 5, description: 'Salário', type: 'income', category_id: 1, estimated_amount_cents: 850000,
  split_rule_id: null, active: true,
}
const power: Recurrence = {
  id: 2, day: 31, description: 'Luz', type: 'expense', category_id: 3, estimated_amount_cents: 18050,
  split_rule_id: 10, active: true,
}
const gym: Recurrence = {
  id: 3, day: 10, description: 'Academia mensal', type: 'expense', category_id: 2, estimated_amount_cents: 9000,
  split_rule_id: null, active: false,
}

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

async function open({
  recurrences = [power, salary, gym],
  generated = [] as string[],
  transactions = [] as Transaction[],
  today = new Date(2026, 9, 24),
} = {}) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(today)
  const server = stubServer({ categories, splitRules, recurrences: structuredClone(recurrences), generated, transactions })
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/recurrences' })
  await screen.findByRole('heading', { level: 1, name: 'Recorrências' })
  return { server, user }
}

const row = (name: string) => screen.findByRole('row', { name })
const generatePanel = () => screen.findByRole('region', { name: 'Gerar lançamentos do mês' })
const optionTexts = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent)

describe('Listing', () => {
  it('shows the recurrences ordered by day', async () => {
    await open()
    await row('Salário')

    const names = screen.getAllByRole('row').map((r) => r.getAttribute('aria-label')).filter(Boolean)
    expect(names).toEqual(['Nova recorrência', 'Salário', 'Academia mensal', 'Luz'])
  })

  it('shows every field of a recurrence', async () => {
    await open()
    const r = await row('Luz')

    expect(within(r).getByLabelText('Dia')).toHaveValue('31')
    expect(within(r).getByLabelText('Descrição')).toHaveValue('Luz')
    expect(within(r).getByLabelText('Tipo')).toHaveValue('expense')
    expect(within(r).getByLabelText('Categoria')).toHaveValue('3')
    expect(within(r).getByLabelText('Valor estimado')).toHaveValue('180,50')
    expect(within(r).getByLabelText('Compartilhamento')).toHaveValue('10')
    expect(within(r).getByLabelText('Ativa')).toBeChecked()
  })

  it('shows inactive recurrences unchecked', async () => {
    await open()
    expect(within(await row('Academia mensal')).getByLabelText('Ativa')).not.toBeChecked()
  })

  it('says so when there are none and still offers the new row', async () => {
    await open({ recurrences: [] })

    expect(await screen.findByText('Nenhuma recorrência cadastrada.')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: 'Nova recorrência' })).toBeInTheDocument()
  })
})

describe('Editing in place', () => {
  it('saves a text change on blur, sending the whole row', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    const description = within(r).getByLabelText('Descrição')
    await user.clear(description)
    await user.type(description, 'Energia')
    await user.tab()

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0]).toEqual({
      method: 'PUT',
      path: '/api/recurrences/2',
      body: {
        day: 31, description: 'Energia', type: 'expense', category_id: 3, estimated_amount_cents: 18050,
        split_rule_id: 10, active: true,
      },
    })
    expect(await row('Energia')).toBeInTheDocument()
  })

  it('does not call the server when nothing changed', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    await user.click(within(r).getByLabelText('Descrição'))
    await user.tab()

    expect(server.writes).toEqual([])
  })

  it('reads the estimated amount in the locale', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    const amount = within(r).getByLabelText('Valor estimado')
    await user.clear(amount)
    await user.type(amount, '1.234,56')
    await user.tab()

    await waitFor(() => expect(server.writes[0]?.body).toMatchObject({ estimated_amount_cents: 123456 }))
  })

  it.each([
    ['Valor estimado', 'abc', 'Informe um valor maior que zero.'],
    ['Dia', '32', 'Informe um dia entre 1 e 31.'],
    ['Dia', '0', 'Informe um dia entre 1 e 31.'],
    ['Descrição', '   ', 'Informe uma descrição.'],
  ])('rejects %s = %j before calling the server and keeps what was typed', async (label, value, message) => {
    const { server, user } = await open()
    const r = await row('Luz')

    const field = within(r).getByLabelText(label)
    await user.clear(field)
    await user.type(field, value)
    await user.tab()

    expect(await within(r).findByRole('alert')).toHaveTextContent(message)
    expect(field).toHaveValue(value)
    expect(server.writes).toEqual([])
  })

  it('toggles active immediately', async () => {
    const { server, user } = await open()
    const r = await row('Academia mensal')

    await user.click(within(r).getByLabelText('Ativa'))

    await waitFor(() => expect(server.writes).toHaveLength(1))
    expect(server.writes[0].body).toMatchObject({ active: true })
    await waitFor(() => expect(within(r).getByLabelText('Ativa')).toBeChecked())
  })

  it('changes the sharing rule immediately', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    await user.selectOptions(within(r).getByLabelText('Compartilhamento'), '')

    await waitFor(() => expect(server.writes[0].body).toMatchObject({ split_rule_id: null }))
  })

  it('offers only categories of the row type and the active sharing rules', async () => {
    await open()
    const expense = await row('Luz')
    const income = await row('Salário')

    expect(optionTexts(within(expense).getByLabelText('Categoria'))).toEqual(['—', 'Academia', 'Moradia'])
    expect(optionTexts(within(income).getByLabelText('Categoria'))).toEqual(['—', 'Salário'])
    expect(optionTexts(within(expense).getByLabelText('Compartilhamento'))).toEqual(['Só meu', '50/50'])
    expect(within(income).getByLabelText('Compartilhamento')).toBeDisabled()
  })

  it('drops category and rule that do not fit when the type changes', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    await user.selectOptions(within(r).getByLabelText('Tipo'), 'income')

    expect(await within(r).findByRole('alert')).toHaveTextContent('category is required')
    expect(server.writes[0].body).toMatchObject({ type: 'income', category_id: null, split_rule_id: null })
  })

  it('shows a server error in the row and keeps the draft', async () => {
    const { user } = await open()
    const r = await row('Luz')

    await user.selectOptions(within(r).getByLabelText('Categoria'), '')

    expect(await within(r).findByRole('alert')).toHaveTextContent('category is required')
    expect(within(r).getByLabelText('Categoria')).toHaveValue('')
  })
})

describe('New recurrence', () => {
  it('starts as an active expense on day 1', async () => {
    await open()
    const r = await screen.findByRole('row', { name: 'Nova recorrência' })

    expect(within(r).getByLabelText('Dia')).toHaveValue('1')
    expect(within(r).getByLabelText('Tipo')).toHaveValue('expense')
    expect(within(r).getByLabelText('Ativa')).toBeChecked()
  })

  it('creates the recurrence and clears the row', async () => {
    const { server, user } = await open()
    const r = await screen.findByRole('row', { name: 'Nova recorrência' })

    await user.clear(within(r).getByLabelText('Dia'))
    await user.type(within(r).getByLabelText('Dia'), '15')
    await user.type(within(r).getByLabelText('Descrição'), 'Internet')
    await user.type(within(r).getByLabelText('Valor estimado'), '129,90')
    await user.selectOptions(within(r).getByLabelText('Categoria'), '3')
    await user.click(within(r).getByRole('button', { name: 'Adicionar' }))

    expect(await row('Internet')).toBeInTheDocument()
    expect(server.writes).toEqual([
      {
        method: 'POST',
        path: '/api/recurrences',
        body: {
          day: 15, description: 'Internet', type: 'expense', category_id: 3, estimated_amount_cents: 12990,
          split_rule_id: null, active: true,
        },
      },
    ])
    expect(within(r).getByLabelText('Descrição')).toHaveValue('')
    expect(within(r).getByLabelText('Dia')).toHaveValue('1')
  })

  it('does not call the server without a description or a valid amount', async () => {
    const { server, user } = await open()
    const r = await screen.findByRole('row', { name: 'Nova recorrência' })

    await user.click(within(r).getByRole('button', { name: 'Adicionar' }))
    expect(await within(r).findByRole('alert')).toHaveTextContent('Informe uma descrição.')

    await user.type(within(r).getByLabelText('Descrição'), 'Internet')
    await user.click(within(r).getByRole('button', { name: 'Adicionar' }))
    expect(await within(r).findByRole('alert')).toHaveTextContent('Informe um valor maior que zero.')
    expect(server.writes).toEqual([])
  })

  it('keeps what was typed when the server refuses it', async () => {
    const { user } = await open()
    const r = await screen.findByRole('row', { name: 'Nova recorrência' })

    await user.type(within(r).getByLabelText('Descrição'), 'Internet')
    await user.type(within(r).getByLabelText('Valor estimado'), '10')
    await user.click(within(r).getByRole('button', { name: 'Adicionar' })) // no category

    expect(await within(r).findByRole('alert')).toHaveTextContent('category is required')
    expect(within(r).getByLabelText('Descrição')).toHaveValue('Internet')
  })
})

describe('Deleting', () => {
  it('asks for confirmation inside the row, then deletes', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    await user.click(within(r).getByRole('button', { name: 'Excluir Luz' }))
    expect(server.writes).toEqual([])
    await user.click(within(r).getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => expect(screen.queryByRole('row', { name: 'Luz' })).not.toBeInTheDocument())
    expect(server.writes).toEqual([{ method: 'DELETE', path: '/api/recurrences/2', body: {} }])
  })

  it('keeps the row when cancelled', async () => {
    const { server, user } = await open()
    const r = await row('Luz')

    await user.click(within(r).getByRole('button', { name: 'Excluir Luz' }))
    await user.click(within(r).getByRole('button', { name: 'Cancelar' }))

    expect(within(r).getByRole('button', { name: 'Excluir Luz' })).toBeInTheDocument()
    expect(server.writes).toEqual([])
  })
})

describe('Generating a month', () => {
  it('offers the current month and creates the transactions of the active recurrences', async () => {
    const { server, user } = await open({ today: new Date(2026, 10, 24) })
    const panel = await generatePanel()

    expect(within(panel).getByLabelText('Mês')).toHaveValue('2026-11')
    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))

    expect(await within(panel).findByRole('status')).toHaveTextContent('2 lançamentos criados.')
    expect(server.writes).toEqual([{ method: 'POST', path: '/api/recurrences/generate', body: { month: '2026-11' } }])
    expect(server.transactions.map((t) => [t.description, t.date, t.confirmed])).toEqual([
      ['Salário', '2026-11-05', false],
      ['Luz', '2026-11-30', false], // day 31 falls back to the last day of November
    ])
  })

  it('links to the transactions of the generated month', async () => {
    const { user } = await open({ today: new Date(2026, 10, 24) })
    const panel = await generatePanel()

    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))

    const link = await within(panel).findByRole('link', { name: 'Ver lançamentos de 11/2026' })
    expect(link).toHaveAttribute('href', '/transactions?month=2026-11')
  })

  it('generates the month picked in the calendar', async () => {
    const { server, user } = await open()
    const panel = await generatePanel()

    fireEvent.change(within(panel).getByLabelText('Mês'), { target: { value: '2027-02' } })
    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))

    await waitFor(() => expect(server.writes[0]?.body).toEqual({ month: '2027-02' }))
    await waitFor(() => expect(server.transactions.find((t) => t.description === 'Luz')?.date).toBe('2027-02-28'))
  })

  it('creates nothing the second time and says why', async () => {
    const { server, user } = await open({ today: new Date(2026, 10, 24) })
    const panel = await generatePanel()
    const button = within(panel).getByRole('button', { name: 'Gerar lançamentos' })

    await user.click(button)
    await within(panel).findByText('2 lançamentos criados.')
    await user.click(button)

    expect(await within(panel).findByRole('status')).toHaveTextContent('Nada a gerar: todas as recorrências ativas já foram geradas neste mês.')
    expect(server.transactions).toHaveLength(2)
  })

  it('reports how many already existed', async () => {
    const { user } = await open({ today: new Date(2026, 10, 24), generated: ['1:2026-11'] })
    const panel = await generatePanel()

    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))

    expect(await within(panel).findByRole('status')).toHaveTextContent('1 lançamento criado. 1 já existia.')
  })

  it('says there is nothing to generate without active recurrences', async () => {
    const { user } = await open({ recurrences: [gym] })
    const panel = await generatePanel()

    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))

    expect(await within(panel).findByRole('status')).toHaveTextContent('Nenhuma recorrência ativa para gerar.')
  })

  it('asks for a month when none is picked', async () => {
    const { user } = await open()
    const panel = await generatePanel()

    fireEvent.change(within(panel).getByLabelText('Mês'), { target: { value: '' } })
    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Escolha o mês a gerar.')
  })

  it('refreshes the transactions of the month', async () => {
    const { user } = await open({ today: new Date(2026, 10, 24) })
    const panel = await generatePanel()

    await user.click(within(panel).getByRole('button', { name: 'Gerar lançamentos' }))
    await user.click(await within(panel).findByRole('link', { name: 'Ver lançamentos de 11/2026' }))

    expect(await screen.findByRole('row', { name: 'Luz' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: 'Salário' })).toBeInTheDocument()
  })
})
