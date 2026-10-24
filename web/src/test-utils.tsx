import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Settings } from './lib/api'

export const defaultSettings: Settings = { partner_name: '', currency: 'BRL', locale: 'pt-BR' }

/** Replaces fetch with a fake server answering GET /api/settings. */
export function stubSettings(settings: Settings = defaultSettings) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/settings') {
      return Promise.resolve(
        new Response(JSON.stringify(settings), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
    }
    return Promise.resolve(new Response(JSON.stringify({ error: 'not found' }), { status: 404 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
