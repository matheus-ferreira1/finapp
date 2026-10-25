import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type CategoryReportScope, type CategoryReportView } from './api'

export const queryKeys = {
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  splitRules: ['split-rules'] as const,
  transactions: ['transactions'] as const,
  recurrences: ['recurrences'] as const,
  monthlyReport: ['monthly-report'] as const,
  categoryReport: ['category-report'] as const,
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

export const useMonthlyReport = (year: number) =>
  useQuery({
    queryKey: [...queryKeys.monthlyReport, year],
    queryFn: () => api.monthlyReport(year),
    // keep the tables on screen while another year loads
    placeholderData: keepPreviousData,
  })

export const useCategoryReport = (year: number, view: CategoryReportView, scope: CategoryReportScope) =>
  useQuery({
    queryKey: [...queryKeys.categoryReport, year, view, scope],
    queryFn: () => api.categoryReport(year, view, scope),
    // keep the table on screen while another year or option loads
    placeholderData: keepPreviousData,
  })
