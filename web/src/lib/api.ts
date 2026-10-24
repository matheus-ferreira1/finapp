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

export type TransactionType = 'income' | 'expense' | 'settlement'

export interface Transaction {
  id: number
  date: string
  description: string
  type: TransactionType
  category_id: number | null
  amount_cents: number
  split_rule_id: number | null
  installment_number: number | null
  installment_total: number | null
  confirmed: boolean
  /** Computed by the server from the amount and the sharing rule. */
  my_cents: number
  shared_cents: number
  recurrence_id: number | null
  recurrence_month: string | null
}

export type TransactionInput = Omit<
  Transaction,
  'id' | 'my_cents' | 'shared_cents' | 'recurrence_id' | 'recurrence_month'
>

export interface Recurrence {
  id: number
  /** Day of the month; short months use their last day. */
  day: number
  description: string
  type: 'income' | 'expense'
  category_id: number | null
  estimated_amount_cents: number
  split_rule_id: number | null
  active: boolean
}

export type RecurrenceInput = Omit<Recurrence, 'id'>

export interface Generation {
  created: Transaction[]
  /** Recurrences that already had their transaction for the month. */
  skipped: number
}

export interface Totals {
  income_cents: number
  expense_cents: number
  balance_cents: number
}

export interface Figures {
  gross: Totals
  mine: Totals
  shared_cents: number
  settled_cents: number
  /** Shared minus settled, in the month. */
  owed_cents: number
  /** Owed since the beginning, up to the end of the month. */
  owed_to_date_cents: number
}

export interface MonthSummary {
  /** 1 to 12. */
  month: number
  /** Every transaction. */
  planned: Figures
  /** Confirmed transactions only. */
  realized: Figures
}

export interface MonthlyReport {
  year: number
  months: MonthSummary[]
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

  listTransactions: (month: string) => request<Transaction[]>('GET', `/api/transactions?month=${month}`),
  createTransaction: (input: TransactionInput) => request<Transaction>('POST', '/api/transactions', input),
  updateTransaction: (id: number, input: TransactionInput) =>
    request<Transaction>('PUT', `/api/transactions/${id}`, input),
  deleteTransaction: (id: number) => request('DELETE', `/api/transactions/${id}`),

  listRecurrences: () => request<Recurrence[]>('GET', '/api/recurrences'),
  createRecurrence: (input: RecurrenceInput) => request<Recurrence>('POST', '/api/recurrences', input),
  updateRecurrence: (id: number, input: RecurrenceInput) =>
    request<Recurrence>('PUT', `/api/recurrences/${id}`, input),
  deleteRecurrence: (id: number) => request('DELETE', `/api/recurrences/${id}`),
  generateRecurrences: (month: string) => request<Generation>('POST', '/api/recurrences/generate', { month }),

  monthlyReport: (year: number) => request<MonthlyReport>('GET', `/api/reports/monthly?year=${year}`),

  listSplitRules: () => request<SplitRule[]>('GET', '/api/split-rules?archived=true'),
  createSplitRule: (input: SplitRuleInput) => request<SplitRule>('POST', '/api/split-rules', input),
  updateSplitRule: (id: number, input: SplitRuleInput) => request<SplitRule>('PUT', `/api/split-rules/${id}`, input),
}
