import { currentMonth, currentYear, isValidMonth, monthParts, parseYear, shiftMonth, todayISO } from './month'

describe('month helpers', () => {
  it('reads the current month from a date', () => {
    expect(currentMonth(new Date(2026, 10, 24))).toBe('2026-11')
    expect(currentMonth(new Date(2026, 0, 1))).toBe('2026-01')
  })

  it('reads the current year from a date', () => {
    expect(currentYear(new Date(2026, 11, 31))).toBe(2026)
    expect(currentYear(new Date(2027, 0, 1))).toBe(2027)
  })

  it.each([
    ['2026-11', 1, '2026-12'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', -1, '2026-02'],
    ['2026-11', 0, '2026-11'],
    ['2026-11', 14, '2028-01'],
  ])('shifts %s by %i', (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected)
  })

  it.each([
    ['2026-11', true],
    ['2026-01', true],
    ['2026-13', false],
    ['2026-00', false],
    ['2026-1', false],
    ['11/2026', false],
    ['', false],
    [null, false],
  ])('validates %j', (value, valid) => {
    expect(isValidMonth(value)).toBe(valid)
  })

  it('splits a month into year and month numbers', () => {
    expect(monthParts('2026-11')).toEqual({ year: 2026, month: 11 })
  })

  it('writes today as an ISO date in local time', () => {
    expect(todayISO(new Date(2026, 10, 4))).toBe('2026-11-04')
    expect(todayISO(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('parseYear', () => {
  it.each([
    ['2026', 2026],
    ['1000', 1000],
    ['9999', 9999],
  ])('reads %s', (value, expected) => {
    expect(parseYear(value)).toBe(expected)
  })

  it.each([null, '', '26', '202', '20260', '0999', 'abc', '2026-01', '-2026', '20.5'])('rejects %s', (value) => {
    expect(parseYear(value)).toBeNull()
  })
})
