import { describe, it, expect } from 'vitest';
import { Big } from '../src/decimal.js';
import { nDigitFormat, nDigitFormatDecimalRange } from '../src/xml/xml-tools.js';

describe('BaseTest', () => {
  it('testCorrectDigits', () => {
    expect(nDigitFormat(new Big(0), 2)).toBe('0.00');
    expect(nDigitFormat(new Big('-1.10'), 2)).toBe('-1.10');
    expect(nDigitFormat(new Big('-1.1'), 2)).toBe('-1.10');
    expect(nDigitFormat(new Big('-1.01'), 2)).toBe('-1.01');
    expect(nDigitFormat(new Big('20000123.3489'), 2)).toBe('20000123.35');
    expect(nDigitFormat(new Big('20000123.3419'), 2)).toBe('20000123.34');
    expect(nDigitFormat(new Big('12'), 2)).toBe('12.00');
    expect(nDigitFormat(new Big('12'), 0)).toBe('12');
    expect(nDigitFormat(new Big('20000123.3419'), 3)).toBe('20000123.342');

    expect(nDigitFormatDecimalRange(new Big(0), 2, 2)).toBe('0.00');
    expect(nDigitFormatDecimalRange(new Big('-1.100000'), 4, 2)).toBe('-1.10');
    expect(nDigitFormatDecimalRange(new Big('-1.101000'), 10, 3)).toBe('-1.101');
    expect(nDigitFormatDecimalRange(new Big('-1.103'), 2, 2)).toBe('-1.10');
    expect(nDigitFormatDecimalRange(new Big('4'), 2, 0)).toBe('4');
    expect(nDigitFormatDecimalRange(new Big('3.141526'), 2, 0)).toBe('3.14');
  });
});
