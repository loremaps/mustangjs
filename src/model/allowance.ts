import { Big, type Decimal } from '../decimal.js';
import { Charge } from './charge.js';
import type { ValueProvider } from '../interfaces/value-provider.js';

export class Allowance extends Charge {
  constructor(totalAmount?: Decimal) {
    super(totalAmount);
  }

  override getTotalAmount(currentItem?: ValueProvider): Decimal {
    if (currentItem === undefined) {
      return super.getTotalAmount();
    }

    if (this.totalAmount != null) {
      return this.totalAmount;
    } else if (this.percent != null) {
      // Divide with 18 decimal precision, HALF_UP (matches Charge and Java #1043)
      const percentFraction = this.percent.div(new Big(100)).round(18, Big.roundHalfUp);
      const singlePrice = currentItem
        .getValue()
        .times(new Big(1).minus(percentFraction));
      const singlePriceDiff = currentItem.getValue().minus(singlePrice);
      return singlePriceDiff.times(currentItem.getQuantity());
    } else {
      throw new Error('percent must be set');
    }
  }

  override isCharge(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): Allowance {
    const allowance = new Allowance(); // no-arg sets taxPercent = ZERO
    if (data.totalAmount != null) allowance.setTotalAmount(new Big(data.totalAmount));
    if (data.percent != null) allowance.setPercent(new Big(data.percent));
    if (data.taxPercent != null) allowance.setTaxPercent(new Big(data.taxPercent));
    if (data.reason) allowance.setReason(data.reason);
    if (data.reasonCode) allowance.setReasonCode(data.reasonCode);
    if (data.categoryCode) allowance.setCategoryCode(data.categoryCode);
    if (data.basisAmount != null) allowance.setBasisAmount(new Big(data.basisAmount));
    return allowance;
  }
}
