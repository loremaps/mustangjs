import Big from 'big.js';

// Configure big.js defaults to match Java BigDecimal behavior
Big.DP = 20;
Big.RM = Big.roundHalfUp;

export type Decimal = Big;
export { Big };

export const ZERO = new Big(0);
export const ONE = new Big(1);
export const TEN = new Big(10);

export function decimal(value: number | string | Big): Big {
  return new Big(value);
}

/** Equivalent to Java's BigDecimal.setScale(scale, RoundingMode.HALF_UP) */
export function setScale(value: Big, scale: number): Big {
  return value.round(scale, Big.roundHalfUp);
}

/**
 * Equivalent to Java's BigDecimal.divide(divisor, scale, RoundingMode.HALF_UP)
 */
export function divideWithScale(value: Big, divisor: Big | number, scale: number): Big {
  return value.div(divisor).round(scale, Big.roundHalfUp);
}

/**
 * Equivalent to Java's BigDecimal.stripTrailingZeros().
 * Big.toString() already strips trailing zeros.
 */
export function stripTrailingZeros(value: Big): Big {
  return new Big(value.toString());
}

/** Compare two Big values, returns -1, 0, or 1 */
export function compareTo(a: Big, b: Big): number {
  return a.cmp(b);
}

/** Format a Big value to a plain string with exactly `scale` decimal places */
export function toPlainString(value: Big, scale: number): string {
  return value.toFixed(scale);
}
