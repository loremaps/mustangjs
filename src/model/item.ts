import { Big, ONE, ZERO, type Decimal } from '../decimal.js';
import type { ExportableItem } from '../interfaces/exportable-item.js';
import type { AllowanceCharge } from '../interfaces/allowance-charge.js';
import type { ExportableProduct } from '../interfaces/exportable-product.js';
import { LineCalculator } from '../calc/line-calculator.js';
import { Product } from './product.js';
import { Charge } from './charge.js';
import { Allowance } from './allowance.js';

export class Item implements ExportableItem {
  protected price: Decimal = ZERO;
  protected quantity: Decimal = ZERO;
  protected basisQuantity: Decimal = ONE;
  protected product: Product | null = null;
  protected allowances: AllowanceCharge[] = [];
  protected charges: AllowanceCharge[] = [];
  protected id: string | null = null;
  protected parentLineID: string | null = null;
  protected lineStatusReasonCode: string | null = null;

  constructor(product?: Product, price?: Decimal, quantity?: Decimal) {
    if (product !== undefined) this.product = product;
    if (price !== undefined) this.price = price;
    if (quantity !== undefined) this.quantity = quantity;
  }

  setPrice(price: Decimal): this {
    this.price = price;
    return this;
  }

  setQuantity(quantity: Decimal): this {
    this.quantity = quantity;
    return this;
  }

  setBasisQuantity(basis: Decimal): this {
    this.basisQuantity = basis;
    return this;
  }

  setProduct(product: Product): this {
    this.product = product;
    return this;
  }

  setId(id: string): this {
    this.id = id;
    return this;
  }

  setParentLineID(parentLineID: string): this {
    this.parentLineID = parentLineID;
    return this;
  }

  setLineStatusReasonCode(code: string): this {
    this.lineStatusReasonCode = code;
    return this;
  }

  addCharge(charge: AllowanceCharge): this {
    this.charges.push(charge);
    return this;
  }

  addAllowance(allowance: AllowanceCharge): this {
    this.allowances.push(allowance);
    return this;
  }

  // Interface implementation

  getValue(): Decimal {
    return this.getPrice();
  }

  getProduct(): Product | null {
    return this.product;
  }

  getPrice(): Decimal {
    return this.price;
  }

  getQuantity(): Decimal {
    return this.quantity;
  }

  getBasisQuantity(): Decimal {
    return this.basisQuantity;
  }

  getItemAllowances(): AllowanceCharge[] | null {
    if (this.allowances.length === 0) {
      return null;
    }
    return this.allowances;
  }

  getItemCharges(): AllowanceCharge[] | null {
    if (this.charges.length === 0) {
      return null;
    }
    return this.charges;
  }

  getItemTotalAllowances(): AllowanceCharge[] | null {
    return null;
  }

  getId(): string | null {
    return this.id;
  }

  getParentLineID(): string | null {
    return this.parentLineID;
  }

  getLineStatusReasonCode(): string | null {
    return this.lineStatusReasonCode;
  }

  isCalculationRelevant(): boolean {
    const status = this.getLineStatusReasonCode();
    return status == null || status === 'DETAIL';
  }

  getCalculation(): LineCalculator {
    return new LineCalculator(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): Item {
    const product = data.product
      ? Product.fromJSON(data.product)
      : new Product();
    const price = data.price != null ? new Big(data.price) : ZERO;
    const quantity = data.quantity != null ? new Big(data.quantity) : ZERO;
    const item = new Item(product, price, quantity);
    if (data.basisQuantity != null) item.setBasisQuantity(new Big(data.basisQuantity));
    if (data.id) item.setId(data.id);
    if (data.itemAllowances) {
      for (const a of data.itemAllowances) {
        item.addAllowance(Allowance.fromJSON(a));
      }
    }
    if (data.itemCharges) {
      for (const c of data.itemCharges) {
        item.addCharge(Charge.fromJSON(c));
      }
    }
    return item;
  }
}
