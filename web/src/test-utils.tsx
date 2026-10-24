import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { Category, Recurrence, RecurrenceInput, Settings, SplitRule, Transaction, TransactionInput } from './lib/api'

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
  transactions: Transaction[]
  recurrences: Recurrence[]
  /** `recurrenceId:YYYY-MM` of what was already generated. */
  generated: string[]
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
    transactions: [],
    recurrences: [],
    generated: [],
    splitRulesInUse: [],
    writes: [],
    ...initial,
  }
  let nextId = 100

  /** Mirrors the server: validation errors and the computed my/shared amounts. */
  const saveTransaction = (id: number, body: TransactionInput): Response | Transaction => {
    if (!(body.amount_cents > 0)) return json(400, { error: 'amount must be greater than zero' })
    if (body.type !== 'settlement' && body.category_id === null) {
      return json(400, { error: 'category is required for income and expense' })
    }
    const rule = state.splitRules.find((r) => r.id === body.split_rule_id)
    let my = body.amount_cents
    let shared = 0
    if (body.type === 'settlement') my = 0
    if (body.type === 'expense' && rule) {
      my = Math.floor((body.amount_cents * rule.my_percent + 50) / 100)
      shared = body.amount_cents - my
    }
    return { ...body, id, my_cents: my, shared_cents: shared, recurrence_id: null, recurrence_month: null }
  }

  const saveRecurrence = (id: number, body: RecurrenceInput): Response | Recurrence => {
    if (!Number.isInteger(body.day) || body.day < 1 || body.day > 31) {
      return json(400, { error: 'day must be between 1 and 31' })
    }
    if (body.description.trim() === '') return json(400, { error: 'description is required' })
    if (!(body.estimated_amount_cents > 0)) return json(400, { error: 'amount must be greater than zero' })
    if (body.category_id === null) return json(400, { error: 'category is required for income and expense' })
    return { ...body, id }
  }

  /** Mirrors the idempotent generation: one transaction per recurrence and month. */
  const generate = (month: string) => {
    const [year, m] = month.split('-').map(Number)
    const lastDay = new Date(year, m, 0).getDate()
    const created: Transaction[] = []
    let skipped = 0
    for (const rec of [...state.recurrences].sort((a, b) => a.day - b.day || a.id - b.id)) {
      if (!rec.active) continue
      const key = `${rec.id}:${month}`
      if (state.generated.includes(key)) {
        skipped++
        continue
      }
      const date = `${month}-${String(Math.min(rec.day, lastDay)).padStart(2, '0')}`
      const tx = saveTransaction(nextId++, {
        date, description: rec.description, type: rec.type, category_id: rec.category_id,
        amount_cents: rec.estimated_amount_cents, split_rule_id: rec.split_rule_id,
        installment_number: null, installment_total: null, confirmed: false,
      }) as Transaction
      tx.recurrence_id = rec.id
      tx.recurrence_month = month
      state.transactions.push(tx)
      state.generated.push(key)
      created.push(tx)
    }
    return { created, skipped }
  }

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

    if (path === '/api/transactions' && method === 'GET') {
      const month = url.searchParams.get('month') ?? ''
      const inMonth = state.transactions.filter((t) => t.date.startsWith(month))
      return json(200, inMonth.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id))
    }
    if (path === '/api/transactions' && method === 'POST') {
      const saved = saveTransaction(nextId++, body as unknown as TransactionInput)
      if (saved instanceof Response) return saved
      state.transactions.push(saved)
      return json(201, saved)
    }
    if (path.startsWith('/api/transactions/') && method === 'PUT') {
      const index = state.transactions.findIndex((t) => t.id === id)
      if (index < 0) return json(404, { error: 'not found' })
      const saved = saveTransaction(id, body as unknown as TransactionInput)
      if (saved instanceof Response) return saved
      state.transactions[index] = saved
      return json(200, saved)
    }
    if (path.startsWith('/api/transactions/') && method === 'DELETE') {
      const index = state.transactions.findIndex((t) => t.id === id)
      if (index < 0) return json(404, { error: 'not found' })
      state.transactions.splice(index, 1)
      return new Response(null, { status: 204 })
    }

    if (path === '/api/recurrences' && method === 'GET') {
      return json(200, [...state.recurrences].sort((a, b) => a.day - b.day || a.id - b.id))
    }
    if (path === '/api/recurrences' && method === 'POST') {
      const saved = saveRecurrence(nextId++, body as unknown as RecurrenceInput)
      if (saved instanceof Response) return saved
      state.recurrences.push(saved)
      return json(201, saved)
    }
    if (path === '/api/recurrences/generate' && method === 'POST') {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.month))) {
        return json(400, { error: 'month must be in the YYYY-MM format' })
      }
      return json(200, generate(String(body.month)))
    }
    if (path.startsWith('/api/recurrences/') && method === 'PUT') {
      const index = state.recurrences.findIndex((r) => r.id === id)
      if (index < 0) return json(404, { error: 'not found' })
      const saved = saveRecurrence(id, body as unknown as RecurrenceInput)
      if (saved instanceof Response) return saved
      state.recurrences[index] = saved
      return json(200, saved)
    }
    if (path.startsWith('/api/recurrences/') && method === 'DELETE') {
      const index = state.recurrences.findIndex((r) => r.id === id)
      if (index < 0) return json(404, { error: 'not found' })
      state.recurrences.splice(index, 1)
      return new Response(null, { status: 204 })
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
