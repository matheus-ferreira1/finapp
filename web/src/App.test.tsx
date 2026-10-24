import { screen, waitFor } from '@testing-library/react'
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
  it('shows the five tabs in Portuguese by default', async () => {
    stubSettings()
    renderWithProviders(<App />)

    const nav = screen.getByRole('navigation')
    for (const label of ['Lançamentos', 'Resumo Mensal', 'Gastos por Categoria', 'Recorrências', 'Configuração']) {
      expect(await screen.findByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(nav).toBeInTheDocument()
  })

  it('opens the transactions screen from the root', async () => {
    stubSettings()
    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Lançamentos' })).toBeInTheDocument()
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

  it.each([
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor')
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
