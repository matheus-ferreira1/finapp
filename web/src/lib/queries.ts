import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const queryKeys = {
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  splitRules: ['split-rules'] as const,
  transactions: ['transactions'] as const,
  recurrences: ['recurrences'] as const,
}

export const useCategories = () => useQuery({ queryKey: queryKeys.categories, queryFn: api.listCategories })

export const useSplitRules = () => useQuery({ queryKey: queryKeys.splitRules, queryFn: api.listSplitRules })

/** The message to show for a failed request. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useTransactions = (month: string) =>
  useQuery({ queryKey: [...queryKeys.transactions, month], queryFn: () => api.listTransactions(month) })

export const useRecurrences = () => useQuery({ queryKey: queryKeys.recurrences, queryFn: api.listRecurrences })
