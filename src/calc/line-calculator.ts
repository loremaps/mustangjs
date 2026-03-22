import { Big, ZERO, ONE, type Decimal } from '../decimal.js';
import type { ExportableItem } from '../interfaces/exportable-item.js';

/**
 * Calculates line-level totals within an item line (quantity * price).
 * Ported from Java LineCalculator.java
 */
export class LineCalculator {
  protected price: Decimal;
  protected priceGross: Decimal;
  protected itemTotalNetAmount: Decimal;
  protected itemTotalVATAmount: Decimal;
  protected lineAllowance: Decimal = ZERO;
  protected lineCharge: Decimal = ZERO;
  protected itemAllowance: Decimal = ZERO;
  protected itemCharge: Decimal = ZERO;
  protected allowanceItemTotal: Decimal = ZERO;

  constructor(currentItem: ExportableItem) {
    if (currentItem.getItemAllowances() != null) {
      for (const allowance of currentItem.getItemAllowances()!) {
        const singleAllowance = allowance.getTotalAmount(currentItem);
        this.addItemAllowance(singleAllowance);
        this.addAllowanceItemTotal(singleAllowance);
      }
    }

    if (currentItem.getItemCharges() != null) {
      for (const charge of currentItem.getItemCharges()!) {
        const singleCharge = charge.getTotalAmount(currentItem);
        this.addItemCharge(singleCharge);
        this.subtractAllowanceItemTotal(singleCharge);
      }
    }

    if (currentItem.getItemTotalAllowances() != null) {
      for (const itemTotalAllowance of currentItem.getItemTotalAllowances()!) {
        this.addAllowanceItemTotal(
          itemTotalAllowance.getTotalAmount(currentItem),
        );
      }
    }

    let vatPercent: Decimal | null = null;
    if (currentItem.getProduct() != null) {
      vatPercent = currentItem.getProduct()!.getVATPercent();
    }
    if (vatPercent == null) {
      vatPercent = ZERO;
    }
    const multiplicator = vatPercent.div(new Big(100));

    let quantity: Decimal = ZERO;
    if (currentItem != null && currentItem.getQuantity() != null) {
      quantity = currentItem.getQuantity();
    }

    this.price = currentItem.getPrice();
    this.priceGross = this.price;

    // Apply product-level allowances and charges to price
    let delta: Decimal = ZERO;
    if (currentItem.getProduct() != null) {
      if (currentItem.getProduct()!.getAllowances() != null) {
        for (const ccaf of currentItem.getProduct()!.getAllowances()!) {
          delta = delta.minus(ccaf.getTotalAmount(currentItem));
        }
      }
      if (currentItem.getProduct()!.getCharges() != null) {
        for (const ccaf of currentItem.getProduct()!.getCharges()!) {
          delta = delta.plus(ccaf.getTotalAmount(currentItem));
        }
      }
    }

    this.price = this.price.plus(delta);

    // Handle basis quantity (avoid division by zero)
    let basisQuantity: Decimal;
    if (currentItem.getBasisQuantity().eq(ZERO)) {
      basisQuantity = ONE.round(4);
    } else {
      basisQuantity = currentItem.getBasisQuantity();
    }

    // Calculate itemTotalNetAmount:
    // quantity * price / basisQuantity + lineCharge - lineAllowance - allowanceItemTotal(rounded to 2dp)
    // then round to 2dp
    this.itemTotalNetAmount = quantity
      .times(this.price)
      .div(basisQuantity)
      .round(18, Big.roundHalfUp)
      .plus(this.lineCharge)
      .minus(this.lineAllowance)
      .minus(this.allowanceItemTotal.round(2, Big.roundHalfUp))
      .round(2, Big.roundHalfUp);

    this.itemTotalVATAmount = this.itemTotalNetAmount.times(multiplicator);
  }

  getPrice(): Decimal {
    return this.price;
  }

  getItemTotalNetAmount(): Decimal {
    return this.itemTotalNetAmount;
  }

  getItemTotalVATAmount(): Decimal {
    return this.itemTotalVATAmount;
  }

  getItemTotalGrossAmount(): Decimal {
    return this.itemTotalNetAmount;
  }

  getPriceGross(): Decimal {
    return this.priceGross;
  }

  addLineAllowance(b: Decimal): void {
    this.lineAllowance = this.lineAllowance.plus(b);
  }

  addLineCharge(b: Decimal): void {
    this.lineCharge = this.lineCharge.plus(b);
  }

  addItemAllowance(b: Decimal): void {
    this.itemAllowance = this.itemAllowance.plus(b);
  }

  addItemCharge(b: Decimal): void {
    this.itemCharge = this.itemCharge.plus(b);
  }

  addAllowanceItemTotal(b: Decimal): void {
    this.allowanceItemTotal = this.allowanceItemTotal.plus(b);
  }

  subtractAllowanceItemTotal(b: Decimal): void {
    this.allowanceItemTotal = this.allowanceItemTotal.minus(b);
  }
}
