import { Big, ZERO, type Decimal } from '../decimal.js';
import type { AllowanceCharge } from '../interfaces/allowance-charge.js';
import type { ValueProvider } from '../interfaces/value-provider.js';
import { TaxCategoryCode } from '../constants/tax-category-code.js';

export class Charge implements AllowanceCharge {
  protected percent: Decimal | null = null;
  protected totalAmount: Decimal | null = null;
  protected basisAmount: Decimal | null = null;
  protected taxPercent: Decimal | null = null;
  protected reason: string | null = null;
  protected reasonCode: string | null = null;
  protected categoryCode: string | null = null;

  constructor(totalAmount?: Decimal) {
    if (totalAmount !== undefined) {
      this.totalAmount = totalAmount;
    } else {
      this.taxPercent = ZERO;
    }
  }

  setTotalAmount(totalAmount: Decimal): this {
    this.totalAmount = totalAmount;
    return this;
  }

  setPercent(percent: Decimal): this {
    this.percent = percent;
    return this;
  }

  setTaxPercent(taxPercent: Decimal): this {
    this.taxPercent = taxPercent;
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

  setCategoryCode(categoryCode: string): this {
    this.categoryCode = categoryCode;
    return this;
  }

  setBasisAmount(basis: Decimal): this {
    this.basisAmount = basis;
    return this;
  }

  getTotalAmount(currentItem?: ValueProvider): Decimal {
    if (currentItem === undefined) {
      if (this.totalAmount != null) {
        return this.totalAmount;
      }
      if (this.percent != null) {
        throw new Error('Cannot compute percent-based amount without a ValueProvider. Pass the item as argument.');
      }
      throw new Error('Either totalAmount or percent must be set');
    }

    if (this.totalAmount != null) {
      return this.totalAmount;
    } else if (this.percent != null) {
      // Charge uses divide with 18 decimal precision, HALF_UP
      const percentFraction = this.percent.div(new Big(100)).round(18, Big.roundHalfUp);
      const singlePrice = currentItem.getValue().times(new Big(1).minus(percentFraction));
      const singlePriceDiff = currentItem.getValue().minus(singlePrice);
      return singlePriceDiff.times(currentItem.getQuantity());
    } else {
      throw new Error('percent must be set');
    }
  }

  getPercent(): Decimal | null {
    return this.percent;
  }

  getBasisAmount(): Decimal | null {
    return this.basisAmount;
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
    if (this.categoryCode != null) {
      return this.categoryCode;
    }
    return TaxCategoryCode.STANDARDRATE;
  }

  isCharge(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): Charge {
    const charge = new Charge(); // no-arg sets taxPercent = ZERO (matches Java Jackson)
    if (data.totalAmount != null) charge.setTotalAmount(new Big(data.totalAmount));
    if (data.percent != null) charge.setPercent(new Big(data.percent));
    if (data.taxPercent != null) charge.setTaxPercent(new Big(data.taxPercent));
    if (data.reason) charge.setReason(data.reason);
    if (data.reasonCode) charge.setReasonCode(data.reasonCode);
    if (data.categoryCode) charge.setCategoryCode(data.categoryCode);
    if (data.basisAmount != null) charge.setBasisAmount(new Big(data.basisAmount));
    return charge;
  }
}
