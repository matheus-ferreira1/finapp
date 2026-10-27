/** Formats an amount in cents as currency for the given locale. */
export function formatMoney(cents: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/** Formats an ISO date (YYYY-MM-DD) without letting the time zone shift the day. */
export function formatDate(iso: string, locale: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** Formats a month as MM/YYYY. */
export function formatMonthYear(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`
}

/** Formats an amount in cents without the cents and abbreviated, for chart axes: $12.5K. */
export function formatCompactMoney(cents: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(cents / 100)
}

/** The short name of a month of the year (1 to 12) in the locale: Mar. */
export function shortMonthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)))
}

/** A month written out with its year in the locale: October 2026. */
export function longMonthName(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

/** A change as a signed whole percent: +26%. */
export function formatPercentChange(fraction: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 }).format(fraction)
}
