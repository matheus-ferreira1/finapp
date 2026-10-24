function decimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1)
  return parts.find((part) => part.type === 'decimal')?.value ?? '.'
}

/** Digits with optional thousands separators, e.g. "1234" or "1.234.567". */
function isWholeNumber(text: string, group: string): boolean {
  const escaped = group.replace('.', '\\.')
  return new RegExp(`^(\\d+|\\d{1,3}(${escaped}\\d{3})+)$`).test(text)
}

/**
 * Reads an amount typed by the user, in the given locale, as cents.
 *
 * Currency symbols and spaces are ignored. A lone separator that is not the
 * locale's decimal one is read as the decimal point when 1-2 digits follow it
 * ("1234.56" in pt-BR) and as a thousands separator otherwise ("1.234").
 * Anything else ambiguous or malformed returns null instead of guessing.
 */
export function parseMoney(text: string, locale: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, '')
  if (!cleaned || cleaned.includes('-')) return null

  const decimal = decimalSeparator(locale)
  const group = decimal === ',' ? '.' : ','

  let whole: string
  let fraction = ''

  if (cleaned.includes(decimal)) {
    const parts = cleaned.split(decimal)
    if (parts.length !== 2) return null
    ;[whole, fraction] = parts
    if (fraction.length < 1 || fraction.length > 2 || !isWholeNumber(whole, group)) return null
  } else if (cleaned.includes(group)) {
    const parts = cleaned.split(group)
    const last = parts[parts.length - 1]
    if (parts.length === 2 && last.length >= 1 && last.length <= 2 && /^\d+$/.test(parts[0])) {
      ;[whole, fraction] = parts
    } else if (isWholeNumber(cleaned, group)) {
      whole = parts.join('')
    } else {
      return null
    }
  } else {
    whole = cleaned
  }

  return Number(whole.replaceAll(group, '')) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Writes cents as an editable amount: locale decimal separator, no grouping. */
export function formatMoneyInput(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100)
}
