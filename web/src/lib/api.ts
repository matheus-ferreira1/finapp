export interface Settings {
  partner_name: string
  currency: string
  locale: string
}

export type CategoryKind = 'income' | 'expense'

export interface Category {
  id: number
  name: string
  kind: CategoryKind
  archived: boolean
}

export interface CategoryInput {
  name: string
  kind: CategoryKind
  archived?: boolean
}

export interface SplitRule {
  id: number
  name: string
  /** Percentage of the expense that is mine; the rest is shared. */
  my_percent: number
  archived: boolean
}

export interface SplitRuleInput {
  name: string
  my_percent: number
  archived?: boolean
}

/** An error response from the server, carrying its HTTP status and message. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // not JSON: fall through to the generic message
  }
  return `Request failed (${response.status})`
}

async function request<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) throw new ApiError(response.status, await errorMessage(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  request,
  getSettings: () => request<Settings>('GET', '/api/settings'),
  updateSettings: (settings: Partial<Settings>) => request<Settings>('PUT', '/api/settings', settings),

  // Lists include archived items: the settings screen manages them, other screens filter.
  listCategories: () => request<Category[]>('GET', '/api/categories?archived=true'),
  createCategory: (input: CategoryInput) => request<Category>('POST', '/api/categories', input),
  updateCategory: (id: number, input: CategoryInput) => request<Category>('PUT', `/api/categories/${id}`, input),

  listSplitRules: () => request<SplitRule[]>('GET', '/api/split-rules?archived=true'),
  createSplitRule: (input: SplitRuleInput) => request<SplitRule>('POST', '/api/split-rules', input),
  updateSplitRule: (id: number, input: SplitRuleInput) => request<SplitRule>('PUT', `/api/split-rules/${id}`, input),
}
