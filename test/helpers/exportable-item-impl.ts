import { ONE, type Decimal } from '../../src/decimal.js';
import type { ExportableItem } from '../../src/interfaces/exportable-item.js';
import type { ExportableProduct } from '../../src/interfaces/exportable-product.js';
import type { AllowanceCharge } from '../../src/interfaces/allowance-charge.js';
import { LineCalculator } from '../../src/calc/line-calculator.js';

export class ExportableItemImpl implements ExportableItem {
  private product: ExportableProduct | null = null;
  private itemAllowances: AllowanceCharge[] | null = null;
  private itemCharges: AllowanceCharge[] | null = null;
  private price!: Decimal;
  private quantity!: Decimal;

  setProduct(product: ExportableProduct): this {
    this.product = product;
    return this;
  }

  setItemAllowances(itemAllowances: AllowanceCharge[]): this {
    this.itemAllowances = itemAllowances;
    return this;
  }

  setItemCharges(itemCharges: AllowanceCharge[]): this {
    this.itemCharges = itemCharges;
    return this;
  }

  setPrice(price: Decimal): this {
    this.price = price;
    return this;
  }

  setQuantity(quantity: Decimal): this {
    this.quantity = quantity;
    return this;
  }

  getProduct(): ExportableProduct | null {
    return this.product;
  }

  getItemAllowances(): AllowanceCharge[] | null {
    return this.itemAllowances;
  }

  getItemCharges(): AllowanceCharge[] | null {
    return this.itemCharges;
  }

  getItemTotalAllowances(): AllowanceCharge[] | null {
    return null;
  }

  getPrice(): Decimal {
    return this.price;
  }

  getValue(): Decimal {
    return this.price;
  }

  getQuantity(): Decimal {
    return this.quantity;
  }

  getBasisQuantity(): Decimal {
    return ONE.round(4);
  }

  getId(): string | null {
    return null;
  }

  getParentLineID(): string | null {
    return null;
  }

  getLineStatusReasonCode(): string | null {
    return null;
  }

  isCalculationRelevant(): boolean {
    return true;
  }

  getCalculation(): LineCalculator {
    return new LineCalculator(this);
  }
}
