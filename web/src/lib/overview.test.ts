import { describe, expect, it } from 'vitest'
import type { CategoryReportRow } from './api'
import { topCategories } from './overview'

const row = (id: number, name: string, months: number[]): CategoryReportRow => ({
  category_id: id,
  name,
  archived: false,
  months: [...months, ...Array(12 - months.length).fill(0)],
  total_cents: months.reduce((a, b) => a + b, 0),
})

describe('topCategories', () => {
  const rows = [
    row(1, 'Housing', [100, 100, 200]),
    row(2, 'Groceries', [50, 60, 30]),
    row(3, 'Leisure', [0, 0, 10]),
    row(4, 'Transport', [20, 20, 90]),
    row(5, 'Gym', [5, 5, 0]),
  ]

  it('takes the biggest spending of the month, biggest first', () => {
    expect(topCategories(rows, 2).map((c) => [c.name, c.value])).toEqual([
      ['Housing', 200],
      ['Transport', 90],
      ['Groceries', 30],
    ])
  })

  it('leaves out categories that spent nothing in the month', () => {
    expect(topCategories(rows, 2, 5).map((c) => c.name)).not.toContain('Gym')
  })

  it('compares with the previous month as a fraction', () => {
    const housing = topCategories(rows, 2)[0]
    expect(housing.previous).toBe(100)
    expect(housing.change).toBe(1) // doubled
    expect(topCategories(rows, 2)[2].change).toBeCloseTo(-0.5) // 60 -> 30
  })

  it('has no change to show when the previous month had no spending', () => {
    const leisure = topCategories(rows, 2, 5).find((c) => c.name === 'Leisure')
    expect(leisure?.previous).toBe(0)
    expect(leisure?.change).toBeNull()
  })

  it('returns the last six months as the trend, oldest first', () => {
    const housing = topCategories(rows, 2)[0]
    expect(housing.trend).toEqual([100, 100, 200])
    const later = topCategories([row(1, 'Housing', [1, 2, 3, 4, 5, 6, 7, 8])], 7)[0]
    expect(later.trend).toEqual([3, 4, 5, 6, 7, 8])
  })

  it('looks at the previous year for January', () => {
    const january = [row(1, 'Housing', [300])]
    const december = [row(1, 'Housing', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 150])]

    const [housing] = topCategories(january, 0, 3, december)

    expect(housing.previous).toBe(150)
    expect(housing.change).toBe(1)
    // the six months up to January, reaching into the previous year
    expect(housing.trend).toEqual([0, 0, 0, 0, 150, 300])
  })

  it('shows no comparison for January when the previous year is not known', () => {
    const [housing] = topCategories([row(1, 'Housing', [300])], 0)
    expect(housing.previous).toBeNull()
    expect(housing.change).toBeNull()
  })
})
