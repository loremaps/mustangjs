import type { Decimal } from '../decimal.js';
import { ONE } from '../decimal.js';

export interface ValueProvider {
  getValue(): Decimal;
  getQuantity(): Decimal;
}

export const ValueProviderDefaults = {
  getQuantity(): Decimal {
    return ONE;
  },
};
