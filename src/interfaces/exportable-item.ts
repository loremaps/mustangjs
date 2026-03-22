import type { Decimal } from '../decimal.js';
import type { ExportableProduct } from './exportable-product.js';
import type { AllowanceCharge } from './allowance-charge.js';
import type { ValueProvider } from './value-provider.js';
import { ONE } from '../decimal.js';

export interface ExportableItem extends ValueProvider {
  getProduct(): ExportableProduct | null;
  getItemAllowances(): AllowanceCharge[] | null;
  getItemCharges(): AllowanceCharge[] | null;
  getItemTotalAllowances(): AllowanceCharge[] | null;
  getPrice(): Decimal;
  getQuantity(): Decimal;
  getBasisQuantity(): Decimal;
  getId(): string | null;
  getParentLineID(): string | null;
  getLineStatusReasonCode(): string | null;
  isCalculationRelevant(): boolean;
  getCalculation(): import('../calc/line-calculator.js').LineCalculator;
}

export const ExportableItemDefaults = {
  getValue(this: ExportableItem): Decimal {
    return this.getPrice();
  },
  getItemAllowances(this: ExportableItem): AllowanceCharge[] | null {
    const product = this.getProduct();
    if (product != null) {
      return product.getAllowances();
    }
    return null;
  },
  getItemCharges(this: ExportableItem): AllowanceCharge[] | null {
    const product = this.getProduct();
    if (product != null) {
      return product.getCharges();
    }
    return null;
  },
  getItemTotalAllowances(): AllowanceCharge[] | null {
    return null;
  },
  getBasisQuantity(): Decimal {
    return ONE.round(4);
  },
  getId(): string | null {
    return null;
  },
  getParentLineID(): string | null {
    return null;
  },
  getLineStatusReasonCode(): string | null {
    return null;
  },
  isCalculationRelevant(this: ExportableItem): boolean {
    const status = this.getLineStatusReasonCode();
    return status == null || status === 'DETAIL';
  },
};
