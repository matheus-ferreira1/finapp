import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n from '../i18n'
import type { Category, SplitRule } from '../lib/api'
import { renderWithProviders, stubServer } from '../test-utils'

const salary: Category = { id: 1, name: 'Salário', kind: 'income', archived: false }
const food: Category = { id: 2, name: 'Alimentação', kind: 'expense', archived: false }
const gym: Category = { id: 3, name: 'Academia', kind: 'expense', archived: true }
const half: SplitRule = { id: 10, name: '50/50', my_percent: 50, archived: false }

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

async function openSettings(initial: Parameters<typeof stubServer>[0] = {}) {
  const server = stubServer(initial)
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/settings' })
  await screen.findByRole('heading', { level: 1, name: 'Configuração' })
  return { server, user }
}

const region = (name: string) => screen.findByRole('region', { name })

describe('General preferences', () => {
  it('shows the current values', async () => {
    await openSettings({ settings: { partner_name: 'Ana', currency: 'USD', locale: 'en' } })
    // the app switches to English because of the locale setting
    const general = await region('General')

    expect(within(general).getByLabelText("Partner's name")).toHaveValue('Ana')
    expect(within(general).getByLabelText('Currency code')).toHaveValue('USD')
    expect(within(general).getByLabelText('Language')).toHaveValue('en')
  })

  it('saves the changes and applies the new language right away', async () => {
    const { server, user } = await openSettings()
    const general = await region('Geral')

    await user.type(within(general).getByLabelText('Nome do(a) parceiro(a)'), 'Ana')
    await user.clear(within(general).getByLabelText('Código da moeda'))
    await user.type(within(general).getByLabelText('Código da moeda'), 'usd')
    await user.selectOptions(within(general).getByLabelText('Idioma'), 'en')
    await user.click(within(general).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('region', { name: 'General' })).toBeInTheDocument()
    expect(server.writes).toEqual([
      { method: 'PUT', path: '/api/settings', body: { partner_name: 'Ana', currency: 'USD', locale: 'en' } },
    ])
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved')
    expect(screen.getByRole('link', { name: 'Monthly Summary' })).toBeInTheDocument()
  })

  it('shows the server error when saving fails', async () => {
    const { user } = await openSettings()
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PUT'
        ? Promise.resolve(new Response(JSON.stringify({ error: 'invalid setting' }), { status: 400 }))
        : original(input, init),
    )
    const general = await region('Geral')

    await user.type(within(general).getByLabelText('Nome do(a) parceiro(a)'), 'Ana')
    await user.click(within(general).getByRole('button', { name: 'Salvar' }))

    expect(await within(general).findByRole('alert')).toHaveTextContent('invalid setting')
  })
})

describe('Categories', () => {
  it('lists income and expense categories separately and marks archived ones', async () => {
    await openSettings({ categories: [salary, food, gym] })
    const income = await region('Receitas')
    const expense = await region('Despesas')

    expect(await within(income).findByText('Salário')).toBeInTheDocument()
    expect(within(income).queryByText('Alimentação')).not.toBeInTheDocument()
    expect(await within(expense).findByText('Alimentação')).toBeInTheDocument()
    expect(within(expense).getByText('Academia')).toBeInTheDocument()
    expect(within(expense).getByText('Arquivada')).toBeInTheDocument()
  })

  it('adds a category of the section kind', async () => {
    const { server, user } = await openSettings()
    const expense = await region('Despesas')

    await user.type(within(expense).getByLabelText('Nome da nova categoria'), 'Transporte')
    await user.click(within(expense).getByRole('button', { name: 'Adicionar' }))

    expect(await within(expense).findByText('Transporte')).toBeInTheDocument()
    expect(server.writes).toEqual([
      { method: 'POST', path: '/api/categories', body: { name: 'Transporte', kind: 'expense' } },
    ])
    expect(within(expense).getByLabelText('Nome da nova categoria')).toHaveValue('')
  })

  it('does not submit a blank name', async () => {
    const { server, user } = await openSettings()
    const expense = await region('Despesas')

    await user.type(within(expense).getByLabelText('Nome da nova categoria'), '   ')
    await user.click(within(expense).getByRole('button', { name: 'Adicionar' }))

    expect(server.writes).toEqual([])
  })

  it('shows the server error for a duplicate', async () => {
    const { user } = await openSettings({ categories: [food] })
    const expense = await region('Despesas')
    await within(expense).findByText('Alimentação')

    await user.type(within(expense).getByLabelText('Nome da nova categoria'), 'Alimentação')
    await user.click(within(expense).getByRole('button', { name: 'Adicionar' }))

    expect(await within(expense).findByRole('alert')).toHaveTextContent('already exists')
  })

  it('renames a category', async () => {
    const { server, user } = await openSettings({ categories: [food] })
    const expense = await region('Despesas')

    await user.click(await within(expense).findByRole('button', { name: 'Editar Alimentação' }))
    const input = within(expense).getByLabelText('Nome')
    await user.clear(input)
    await user.type(input, 'Mercado')
    await user.click(within(expense).getByRole('button', { name: 'Salvar' }))

    expect(await within(expense).findByText('Mercado')).toBeInTheDocument()
    expect(within(expense).queryByText('Alimentação')).not.toBeInTheDocument()
    expect(server.writes).toEqual([
      { method: 'PUT', path: '/api/categories/2', body: { name: 'Mercado', kind: 'expense', archived: false } },
    ])
  })

  it('cancels an edit without saving', async () => {
    const { server, user } = await openSettings({ categories: [food] })
    const expense = await region('Despesas')

    await user.click(await within(expense).findByRole('button', { name: 'Editar Alimentação' }))
    await user.type(within(expense).getByLabelText('Nome'), ' x')
    await user.click(within(expense).getByRole('button', { name: 'Cancelar' }))

    expect(within(expense).getByText('Alimentação')).toBeInTheDocument()
    expect(server.writes).toEqual([])
  })

  it('archives and restores a category', async () => {
    const { server, user } = await openSettings({ categories: [food] })
    const expense = await region('Despesas')

    await user.click(await within(expense).findByRole('button', { name: 'Arquivar Alimentação' }))
    expect(await within(expense).findByText('Arquivada')).toBeInTheDocument()

    await user.click(within(expense).getByRole('button', { name: 'Restaurar Alimentação' }))
    await waitFor(() => expect(within(expense).queryByText('Arquivada')).not.toBeInTheDocument())

    expect(server.writes.map((w) => w.body)).toEqual([
      { name: 'Alimentação', kind: 'expense', archived: true },
      { name: 'Alimentação', kind: 'expense', archived: false },
    ])
  })
})

describe('Split rules', () => {
  it('lists the rules with both shares', async () => {
    await openSettings({ splitRules: [half, { id: 11, name: 'Casa', my_percent: 30, archived: false }] })
    const rules = await region('Compartilhamento')

    expect(await within(rules).findByText('50/50', { selector: 'span' })).toBeInTheDocument()
    expect(within(rules).getByText('Casa')).toBeInTheDocument()
    expect(within(rules).getByText('30/70')).toBeInTheDocument()
  })

  it('names a new rule after its shares when no name is given', async () => {
    const { server, user } = await openSettings()
    const rules = await region('Compartilhamento')

    await user.type(within(rules).getByLabelText('Minha parte (%)'), '30')
    await user.click(within(rules).getByRole('button', { name: 'Adicionar' }))

    expect(await within(rules).findByText('30/70', { selector: 'span' })).toBeInTheDocument()
    expect(server.writes).toEqual([
      { method: 'POST', path: '/api/split-rules', body: { name: '30/70', my_percent: 30 } },
    ])
  })

  it('uses the given name', async () => {
    const { server, user } = await openSettings()
    const rules = await region('Compartilhamento')

    await user.type(within(rules).getByLabelText('Nome da regra'), 'Mercado')
    await user.type(within(rules).getByLabelText('Minha parte (%)'), '40')
    await user.click(within(rules).getByRole('button', { name: 'Adicionar' }))

    expect(await within(rules).findByText('Mercado')).toBeInTheDocument()
    expect(server.writes[0].body).toEqual({ name: 'Mercado', my_percent: 40 })
  })

  it.each(['', '101', '-5'])('rejects the percent "%s" before calling the server', async (percent) => {
    const { server, user } = await openSettings()
    const rules = await region('Compartilhamento')

    if (percent) await user.type(within(rules).getByLabelText('Minha parte (%)'), percent)
    await user.click(within(rules).getByRole('button', { name: 'Adicionar' }))

    expect(await within(rules).findByRole('alert')).toHaveTextContent('0 e 100')
    expect(server.writes).toEqual([])
  })

  it('edits name and percent of an unused rule', async () => {
    const { server, user } = await openSettings({ splitRules: [half] })
    const rules = await region('Compartilhamento')

    await user.click(await within(rules).findByRole('button', { name: 'Editar 50/50' }))
    const percent = within(rules).getByLabelText('Minha parte da regra (%)')
    await user.clear(percent)
    await user.type(percent, '60')
    await user.click(within(rules).getByRole('button', { name: 'Salvar' }))

    expect(await within(rules).findByText('60/40')).toBeInTheDocument()
    expect(server.writes).toEqual([
      { method: 'PUT', path: '/api/split-rules/10', body: { name: '50/50', my_percent: 60, archived: false } },
    ])
  })

  it('explains why the percent of a rule in use cannot change', async () => {
    const { user } = await openSettings({ splitRules: [half], splitRulesInUse: [10] })
    const rules = await region('Compartilhamento')

    await user.click(await within(rules).findByRole('button', { name: 'Editar 50/50' }))
    const percent = within(rules).getByLabelText('Minha parte da regra (%)')
    await user.clear(percent)
    await user.type(percent, '60')
    await user.click(within(rules).getByRole('button', { name: 'Salvar' }))

    expect(await within(rules).findByRole('alert')).toHaveTextContent('in use')
    expect(within(rules).getByLabelText('Minha parte da regra (%)')).toBeInTheDocument()
  })

  it('archives and restores a rule', async () => {
    const { server, user } = await openSettings({ splitRules: [half] })
    const rules = await region('Compartilhamento')

    await user.click(await within(rules).findByRole('button', { name: 'Arquivar 50/50' }))
    expect(await within(rules).findByText('Arquivada')).toBeInTheDocument()
    await user.click(within(rules).getByRole('button', { name: 'Restaurar 50/50' }))
    await waitFor(() => expect(within(rules).queryByText('Arquivada')).not.toBeInTheDocument())

    expect(server.writes.map((w) => (w.body as { archived: boolean }).archived)).toEqual([true, false])
  })
})
