import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import i18n from './i18n'
import { SettingsProvider } from './app/SettingsProvider'
import { useSettings } from './app/settings-context'
import { renderWithProviders, stubSettings } from './test-utils'

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('pt-BR')
})

describe('App shell', () => {
  it('shows the tabs in Portuguese by default', async () => {
    stubSettings()
    renderWithProviders(<App />)

    const nav = screen.getByRole('navigation')
    for (const label of ['Visão Geral', 'Lançamentos', 'Resumo Mensal', 'Gastos por Categoria', 'Recorrências', 'Configuração']) {
      expect(await screen.findByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(nav).toBeInTheDocument()
  })

  it('opens the overview from the root and from unknown addresses', async () => {
    stubSettings()
    const { unmount } = renderWithProviders(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Visão Geral' })).toBeInTheDocument()
    unmount()

    renderWithProviders(<App />, { route: '/nowhere' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Visão Geral' })).toBeInTheDocument()
  })

  it('keeps Recurrences and Settings behind a More button for small screens', async () => {
    stubSettings()
    const user = userEvent.setup()
    renderWithProviders(<App />)
    await screen.findByRole('link', { name: 'Visão Geral' })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mais' }))

    const menu = screen.getByRole('list')
    expect(within(menu).getByRole('link', { name: 'Recorrências' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Configuração' })).toBeInTheDocument()

    await user.click(within(menu).getByRole('link', { name: 'Configuração' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Configuração' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('navigates between screens and marks the current tab', async () => {
    stubSettings()
    const user = userEvent.setup()
    renderWithProviders(<App />)

    await user.click(await screen.findByRole('link', { name: 'Configuração' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Configuração' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Configuração' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Lançamentos' })).not.toHaveAttribute('aria-current')
  })

  describe('More menu', () => {
    async function openMenu() {
      stubSettings()
      const user = userEvent.setup()
      renderWithProviders(<App />)
      await screen.findByRole('link', { name: 'Visão Geral' })
      await user.click(screen.getByRole('button', { name: 'Mais' }))
      expect(screen.getByRole('list')).toBeInTheDocument()
      return user
    }

    it('closes with Escape', async () => {
      const user = await openMenu()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('closes when pressing anywhere else', async () => {
      const user = await openMenu()
      await user.click(screen.getByRole('heading', { level: 1 }))
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('closes when another tab of the bar is chosen', async () => {
      const user = await openMenu()
      await user.click(screen.getByRole('link', { name: 'Lançamentos' }))
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('closes with its own button', async () => {
      const user = await openMenu()
      await user.click(screen.getByRole('button', { name: 'Mais' }))
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })
  })

  it.each([
    ['/overview', 'Visão Geral'],
    ['/transactions', 'Lançamentos'],
    ['/summary', 'Resumo Mensal'],
    ['/spending', 'Gastos por Categoria'],
    ['/recurrences', 'Recorrências'],
    ['/settings', 'Configuração'],
  ])('serves %s directly', async (route, title) => {
    stubSettings()
    renderWithProviders(<App />, { route })

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('switches to English when the locale setting is en', async () => {
    stubSettings({ partner_name: '', currency: 'USD', locale: 'en' })
    renderWithProviders(<App />)

    expect(await screen.findByRole('link', { name: 'Monthly Summary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spending by Category' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
  })

  it('tells the user when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderWithProviders(<App />)

    expect(await screen.findByText(/Não foi possível conectar ao servidor/)).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})

describe('settings formatters', () => {
  function Probe() {
    const { formatMoney, formatDate } = useSettings()
    return (
      <p>
        {formatMoney(123456)} | {formatDate('2026-11-03')}
      </p>
    )
  }

  it('format money and dates for the active settings', async () => {
    stubSettings({ partner_name: '', currency: 'USD', locale: 'en' })
    renderWithProviders(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )

    await waitFor(() => expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument())
    expect(screen.getByText(/11\/03\/2026/)).toBeInTheDocument()
  })

  it('default to Brazilian formatting until the settings arrive', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))) // never answers
    renderWithProviders(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )

    expect(screen.getByText(/R\$\s1\.234,56/)).toBeInTheDocument()
    expect(screen.getByText(/03\/11\/2026/)).toBeInTheDocument()
  })
})
