/**
 * The eight validated categorical hues (dataviz palette: lightness band, colour-blind separation and
 * normal-vision separation checked on both surfaces). Colour is never the only cue: charts always
 * carry a legend and a table. They are CSS variables
 * (defined in index.css) so each theme can tune its own shade.
 */
export const CATEGORY_PALETTE = [
  'var(--cat-blue)',
  'var(--cat-orange)',
  'var(--cat-aqua)',
  'var(--cat-yellow)',
  'var(--cat-magenta)',
  'var(--cat-green)',
  'var(--cat-violet)',
  'var(--cat-red)',
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
