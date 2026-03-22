import { Big, type Decimal } from '../decimal.js';

/** XML-encode special characters */
export function encodeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a decimal value to exactly `scale` decimal places, rounding HALF_UP.
 * Equivalent to Java's XMLTools.nDigitFormat()
 */
export function nDigitFormat(value: Decimal, scale: number): string {
  return value.round(scale, Big.roundHalfUp).toFixed(scale);
}

/**
 * Format a number so that at least minDecimals are displayed but at most maxDecimals,
 * cutting trailing 0s until minDecimals.
 * Equivalent to Java's XMLTools.nDigitFormatDecimalRange()
 */
export function nDigitFormatDecimalRange(
  value: Decimal,
  maxDecimals: number,
  minDecimals: number,
): string {
  if (maxDecimals < minDecimals || maxDecimals < 0 || minDecimals < 0) {
    throw new Error('Invalid scale range provided');
  }
  let curDecimals = maxDecimals;
  while (
    curDecimals > minDecimals &&
    value
      .round(curDecimals, Big.roundHalfUp)
      .eq(value.round(curDecimals - 1, Big.roundHalfUp))
  ) {
    curDecimals--;
  }
  return value.round(curDecimals, Big.roundHalfUp).toFixed(curDecimals);
}
