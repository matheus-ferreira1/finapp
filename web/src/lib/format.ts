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
