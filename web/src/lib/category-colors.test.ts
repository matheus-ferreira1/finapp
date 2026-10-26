import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE, categoryColor } from './category-colors'

describe('categoryColor', () => {
  it('depends on the id alone', () => {
    expect(categoryColor(7)).toBe(categoryColor(7))
  })

  it('cycles through the palette', () => {
    expect(categoryColor(0)).toBe(CATEGORY_PALETTE[0])
    expect(categoryColor(CATEGORY_PALETTE.length)).toBe(CATEGORY_PALETTE[0])
    expect(categoryColor(CATEGORY_PALETTE.length + 3)).toBe(CATEGORY_PALETTE[3])
  })

  it('gives neighbouring ids different colours', () => {
    for (let id = 1; id < 30; id++) expect(categoryColor(id)).not.toBe(categoryColor(id + 1))
  })

  it('stays inside the palette for negative ids', () => {
    expect(CATEGORY_PALETTE).toContain(categoryColor(-3))
  })

  it('has eight distinct hues', () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(8)
  })

  it('falls back to a neutral colour for a missing category', () => {
    expect(categoryColor(null)).toBe('var(--color-ink-muted)')
  })
})
