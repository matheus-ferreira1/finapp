const pad = (n: number) => String(n).padStart(2, '0')

/** The month (YYYY-MM) of a date, in local time. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/** The year of a date, in local time. */
export function currentYear(now: Date = new Date()): number {
  return now.getFullYear()
}

export function isValidMonth(value: string | null): value is string {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function monthParts(month: string): { year: number; month: number } {
  const [year, m] = month.split('-').map(Number)
  return { year, month: m }
}

/** Moves a month (YYYY-MM) forward or backward. */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: m } = monthParts(month)
  const total = year * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Today as an ISO date (YYYY-MM-DD), in local time. */
export function todayISO(now: Date = new Date()): string {
  return `${currentMonth(now)}-${pad(now.getDate())}`
}

export const MIN_YEAR = 1000
export const MAX_YEAR = 9999

/** A four-digit year, or null when the value is not one. */
export function parseYear(value: string | null): number | null {
  return value !== null && /^[1-9]\d{3}$/.test(value) ? Number(value) : null
}
