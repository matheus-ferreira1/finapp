/**
 * Ten saturated hues, readable on both the light and the dark page. They are CSS variables
 * (defined in index.css) so each theme can tune its own shade.
 */
export const CATEGORY_PALETTE = [
  'var(--cat-mango)',
  'var(--cat-jambo)',
  'var(--cat-acai)',
  'var(--cat-sky)',
  'var(--cat-lime)',
  'var(--cat-coral)',
  'var(--cat-teal)',
  'var(--cat-cobalt)',
  'var(--cat-papaya)',
  'var(--cat-olive)',
] as const

/**
 * The colour of a category. It depends on the id alone, never on a position in a list, so
 * archiving a category or reading it from another report does not change its colour.
 */
export function categoryColor(id: number | null): string {
  if (id === null) return 'var(--color-ink-muted)'
  const n = CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[((id % n) + n) % n]
}
