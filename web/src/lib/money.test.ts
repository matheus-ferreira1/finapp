import { formatMoneyInput, parseMoney } from './money'

describe('parseMoney', () => {
  it.each([
    // pt-BR: comma is the decimal separator
    ['1.234,56', 'pt-BR', 123456],
    ['1234,56', 'pt-BR', 123456],
    ['0,5', 'pt-BR', 50],
    ['0,05', 'pt-BR', 5],
    ['12', 'pt-BR', 1200],
    ['R$ 1.234,56', 'pt-BR', 123456],
    ['  1.234.567,89 ', 'pt-BR', 123456789],
    ['1.234', 'pt-BR', 123400], // a dot followed by 3 digits is a thousands separator
    ['1234.56', 'pt-BR', 123456], // a dot followed by 1-2 digits is read as the decimal point
    ['0', 'pt-BR', 0],
    // en: dot is the decimal separator
    ['1,234.56', 'en', 123456],
    ['1234.56', 'en', 123456],
    ['1,234', 'en', 123400],
    ['1234,5', 'en', 123450],
    ['$1,000', 'en', 100000],
  ])('reads %j in %s as %i cents', (text, locale, cents) => {
    expect(parseMoney(text, locale)).toBe(cents)
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['-5'],
    ['1,2,3'],
    ['10,999'], // more than two decimals
    ['1.23.4'],
    ['12,'],
    [','],
    ['1,234,56'],
  ])('rejects %j instead of guessing', (text) => {
    expect(parseMoney(text, 'pt-BR')).toBeNull()
  })
})

describe('formatMoneyInput', () => {
  it('writes cents the way parseMoney reads them back, without grouping', () => {
    expect(formatMoneyInput(123456, 'pt-BR')).toBe('1234,56')
    expect(formatMoneyInput(123456, 'en')).toBe('1234.56')
    expect(formatMoneyInput(5, 'pt-BR')).toBe('0,05')
    expect(formatMoneyInput(100000, 'pt-BR')).toBe('1000,00')
  })

  it.each([0, 5, 99, 100, 123456, 100001, 99999999])('round trips %i cents', (cents) => {
    for (const locale of ['pt-BR', 'en']) {
      expect(parseMoney(formatMoneyInput(cents, locale), locale)).toBe(cents)
    }
  })
})
