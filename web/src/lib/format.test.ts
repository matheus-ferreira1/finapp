import { formatDate, formatMoney, formatMonthYear, formatCompactMoney, formatPercentChange, longMonthName, shortMonthName } from './format'

// Intl uses a no-break space between symbol and number; compare with a plain one.
const plain = (s: string) => s.replace(/ /g, ' ')

describe('formatMoney', () => {
  it.each([
    [123456, 'pt-BR', 'BRL', 'R$ 1.234,56'],
    [123456, 'en', 'USD', '$1,234.56'],
    [5, 'pt-BR', 'BRL', 'R$ 0,05'],
    [0, 'pt-BR', 'BRL', 'R$ 0,00'],
    [-1000, 'pt-BR', 'BRL', '-R$ 10,00'],
    [100001, 'en', 'BRL', 'R$1,000.01'],
  ])('formats %i cents as %s/%s', (cents, locale, currency, expected) => {
    expect(plain(formatMoney(cents, locale, currency))).toBe(expected)
  })
})

describe('formatDate', () => {
  it('formats an ISO date in the locale without shifting the day across time zones', () => {
    expect(formatDate('2026-11-03', 'pt-BR')).toBe('03/11/2026')
    expect(formatDate('2026-11-03', 'en')).toBe('11/03/2026')
    expect(formatDate('2026-01-01', 'pt-BR')).toBe('01/01/2026')
    expect(formatDate('2026-12-31', 'pt-BR')).toBe('31/12/2026')
  })
})

describe('formatMonthYear', () => {
  it('uses MM/YYYY', () => {
    expect(formatMonthYear(2026, 1)).toBe('01/2026')
    expect(formatMonthYear(2026, 11)).toBe('11/2026')
  })
})

describe('formatCompactMoney', () => {
  it('drops the cents and abbreviates thousands for chart axes', () => {
    expect(formatCompactMoney(1250000, 'en', 'USD')).toBe('$12.5K')
    expect(formatCompactMoney(0, 'en', 'USD')).toBe('$0')
  })

  it('follows the locale', () => {
    expect(formatCompactMoney(1000000, 'pt-BR', 'BRL').replace(/\s/g, ' ')).toMatch(/^R\$ 10 mil$/)
  })
})

describe('shortMonthName', () => {
  it('names a month of the year in the locale', () => {
    expect(shortMonthName(3, 'en')).toBe('Mar')
    expect(shortMonthName(3, 'pt-BR').toLowerCase()).toContain('mar')
  })
})

describe('longMonthName', () => {
  it('writes the month and year out in the locale', () => {
    expect(longMonthName(2026, 10, 'en')).toBe('October 2026')
    expect(longMonthName(2026, 10, 'pt-BR')).toBe('outubro de 2026')
  })
})

describe('formatPercentChange', () => {
  it('shows the sign of a change and no decimals', () => {
    expect(formatPercentChange(0.256, 'en')).toBe('+26%')
    expect(formatPercentChange(-0.5, 'en')).toBe('-50%')
    expect(formatPercentChange(0, 'en')).toBe('0%')
  })
})
