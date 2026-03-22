import type { Decimal } from '../decimal.js';
import type { ValueProvider } from './value-provider.js';
import { TaxCategoryCode } from '../constants/tax-category-code.js';

export interface AllowanceCharge {
  getTotalAmount(provider: ValueProvider): Decimal;
  getPercent(): Decimal | null;
  getBasisAmount(): Decimal | null;
  getReason(): string | null;
  getReasonCode(): string | null;
  getTaxPercent(): Decimal | null;
  getCategoryCode(): string;
  isCharge(): boolean;
}

export const AllowanceChargeDefaults = {
  getPercent(): Decimal | null {
    return null;
  },
  getBasisAmount(): Decimal | null {
    return null;
  },
  getCategoryCode(): string {
    return TaxCategoryCode.STANDARDRATE;
  },
};
