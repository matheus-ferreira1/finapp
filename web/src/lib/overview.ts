import type { CategoryReportRow } from './api'

const TREND_MONTHS = 6

export interface TopCategory {
  categoryId: number
  name: string
  value: number
  /** Spent the month before; null when that month is not known (January without the previous year). */
  previous: number | null
  /** Change from the previous month as a fraction (0.25 is +25%); null when there is nothing to compare with. */
  change: number | null
  /** The last six months up to this one, oldest first. */
  trend: number[]
}

/**
 * The categories with the biggest spending in a month (0 to 11), each compared with the month
 * before. January looks into `previousYear` for December, and for the trend, when it is given.
 */
export function topCategories(
  rows: CategoryReportRow[],
  monthIndex: number,
  limit = 3,
  previousYear?: CategoryReportRow[],
): TopCategory[] {
  return rows
    .filter((row) => row.months[monthIndex] > 0)
    .sort((a, b) => b.months[monthIndex] - a.months[monthIndex])
    .slice(0, limit)
    .map((row) => {
      const before = previousYear?.find((r) => r.category_id === row.category_id)?.months ?? (previousYear ? Array(12).fill(0) : null)
      const value = row.months[monthIndex]
      const previous = monthIndex > 0 ? row.months[monthIndex - 1] : (before?.[11] ?? null)

      // the month at position `offset` months before this one, if known
      const at = (offset: number): number | null => {
        const index = monthIndex - offset
        if (index >= 0) return row.months[index]
        return before?.[12 + index] ?? null
      }
      const trend: number[] = []
      for (let offset = TREND_MONTHS - 1; offset >= 0; offset--) {
        const amount = at(offset)
        if (amount !== null) trend.push(amount)
      }

      return {
        categoryId: row.category_id,
        name: row.name,
        value,
        previous,
        change: previous ? (value - previous) / previous : null,
        trend,
      }
    })
}
