import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Category, Settings, SplitRule } from './lib/api'

export const defaultSettings: Settings = { partner_name: '', currency: 'BRL', locale: 'pt-BR' }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Replaces fetch with a fake server answering GET /api/settings. */
export function stubSettings(settings: Settings = defaultSettings) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/settings') return Promise.resolve(json(200, settings))
    return Promise.resolve(json(404, { error: 'not found' }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export interface FakeServerState {
  settings: Settings
  categories: Category[]
  splitRules: SplitRule[]
  /** Split rule ids whose percent is frozen (used by transactions). */
  splitRulesInUse: number[]
  /** Every non-GET request received, in order. */
  writes: { method: string; path: string; body: unknown }[]
}

/**
 * Replaces fetch with an in-memory fake of the settings, categories and split
 * rules endpoints, mirroring the server's validation and conflict responses.
 */
export function stubServer(initial: Partial<FakeServerState> = {}) {
  const state: FakeServerState = {
    settings: { ...defaultSettings },
    categories: [],
    splitRules: [],
    splitRulesInUse: [],
    writes: [],
    ...initial,
  }
  let nextId = 100

  const handle = (method: string, url: URL, body: Record<string, unknown>): Response => {
    const path = url.pathname
    const id = Number(path.split('/')[3])

    if (path === '/api/settings') {
      if (method === 'PUT') state.settings = { ...state.settings, ...(body as Partial<Settings>) }
      return json(200, state.settings)
    }

    if (path === '/api/categories' && method === 'GET') {
      const all = url.searchParams.get('archived') === 'true'
      return json(200, state.categories.filter((c) => all || !c.archived))
    }
    if (path === '/api/categories' && method === 'POST') {
      if (state.categories.some((c) => c.name === body.name && c.kind === body.kind)) {
        return json(409, { error: 'already exists' })
      }
      const created = { id: nextId++, archived: false, ...body } as Category
      state.categories.push(created)
      return json(201, created)
    }
    if (path.startsWith('/api/categories/') && method === 'PUT') {
      const index = state.categories.findIndex((c) => c.id === id)
      if (index < 0) return json(404, { error: 'not found' })
      state.categories[index] = { ...state.categories[index], ...body } as Category
      return json(200, state.categories[index])
    }

    if (path === '/api/split-rules' && method === 'GET') {
      const all = url.searchParams.get('archived') === 'true'
      return json(200, state.splitRules.filter((r) => all || !r.archived))
    }
    if (path === '/api/split-rules' && method === 'POST') {
      if (state.splitRules.some((r) => r.name === body.name)) return json(409, { error: 'already exists' })
      const created = { id: nextId++, archived: false, ...body } as SplitRule
      state.splitRules.push(created)
      return json(201, created)
    }
    if (path.startsWith('/api/split-rules/') && method === 'PUT') {
      const index = state.splitRules.findIndex((r) => r.id === id)
      if (index < 0) return json(404, { error: 'not found' })
      if (state.splitRulesInUse.includes(id) && body.my_percent !== state.splitRules[index].my_percent) {
        return json(409, { error: 'split rule is in use, archive it and create a new one instead of changing its percent' })
      }
      state.splitRules[index] = { ...state.splitRules[index], ...body } as SplitRule
      return json(200, state.splitRules[index])
    }

    return json(404, { error: 'not found' })
  }

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const url = new URL(String(input), 'http://localhost')
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    if (method !== 'GET') state.writes.push({ method, path: url.pathname, body })
    return Promise.resolve(handle(method, url, body))
  })
  vi.stubGlobal('fetch', fetchMock)
  return state
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
