import type { Decimal } from '../../src/decimal.js';
import type { AllowanceCharge } from '../../src/interfaces/allowance-charge.js';
import type { ValueProvider } from '../../src/interfaces/value-provider.js';
import { TaxCategoryCode } from '../../src/constants/tax-category-code.js';

export class AllowanceChargeImpl implements AllowanceCharge {
  private totalAmount!: Decimal;
  private reason: string | null = null;
  private reasonCode: string | null = null;
  private taxPercent: Decimal | null = null;
  private _isCharge: boolean = true;

  setTotalAmount(totalAmount: Decimal): this {
    this.totalAmount = totalAmount;
    return this;
  }

  setReason(reason: string): this {
    this.reason = reason;
    return this;
  }

  setReasonCode(reasonCode: string): this {
    this.reasonCode = reasonCode;
    return this;
  }

  setTaxPercent(taxPercent: Decimal): this {
    this.taxPercent = taxPercent;
    return this;
  }

  setAllowance(): this {
    this._isCharge = false;
    return this;
  }

  getTotalAmount(_currentItem: ValueProvider): Decimal {
    return this.totalAmount;
  }

  getPercent(): Decimal | null {
    return null;
  }

  getBasisAmount(): Decimal | null {
    return null;
  }

  getReason(): string | null {
    return this.reason;
  }

  getReasonCode(): string | null {
    return this.reasonCode;
  }

  getTaxPercent(): Decimal | null {
    return this.taxPercent;
  }

  getCategoryCode(): string {
    return TaxCategoryCode.STANDARDRATE;
  }

  isCharge(): boolean {
    return this._isCharge;
  }
}
