import { Big, ZERO, type Decimal } from '../decimal.js';
import type { ExportableProduct } from '../interfaces/exportable-product.js';
import { getDefaultTaxCategoryCode } from '../interfaces/exportable-product.js';
import type { AllowanceCharge } from '../interfaces/allowance-charge.js';
import { Charge } from './charge.js';
import { Allowance } from './allowance.js';

export class Product implements ExportableProduct {
  protected unit: string | null = null;
  protected name: string | null = null;
  protected sellerAssignedID: string | null = null;
  protected buyerAssignedID: string | null = null;
  protected description: string = '';
  protected taxExemptionReason: string | null = null;
  protected taxExemptionReasonCode: string | null = null;
  protected taxCategoryCode: string | null = null;
  protected vatPercent: Decimal | null = null;
  protected _isReverseCharge: boolean = false;
  protected _isIntraCommunitySupply: boolean = false;
  protected countryOfOrigin: string | null = null;
  protected charges: Charge[] = [];
  protected allowances: Allowance[] = [];
  protected attributes: Map<string, string> = new Map();

  constructor(
    name?: string,
    description?: string,
    unit?: string,
    vatPercent?: Decimal,
  ) {
    if (name !== undefined) this.name = name;
    if (description !== undefined) this.description = description;
    if (unit !== undefined) this.unit = unit;
    if (vatPercent !== undefined) this.vatPercent = vatPercent;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  setUnit(unit: string): this {
    this.unit = unit;
    return this;
  }

  setVATPercent(vatPercent: Decimal | null): this {
    this.vatPercent = vatPercent;
    return this;
  }

  setSellerAssignedID(id: string): this {
    this.sellerAssignedID = id;
    return this;
  }

  setBuyerAssignedID(id: string): this {
    this.buyerAssignedID = id;
    return this;
  }

  setTaxCategoryCode(code: string): this {
    this.taxCategoryCode = code;
    return this;
  }

  setTaxExemptionReason(reason: string): this {
    this.taxExemptionReason = reason;
    return this;
  }

  setTaxExemptionReasonCode(code: string): this {
    this.taxExemptionReasonCode = code;
    return this;
  }

  setCountryOfOrigin(country: string): this {
    this.countryOfOrigin = country;
    return this;
  }

  setReverseCharge(): this {
    this._isReverseCharge = true;
    if (!this.taxExemptionReason) {
      this.setTaxExemptionReason('Reverse charge');
    }
    this.setVATPercent(ZERO);
    return this;
  }

  setIntraCommunitySupply(): this {
    this._isIntraCommunitySupply = true;
    this.setVATPercent(ZERO);
    this.setTaxExemptionReason('Intra-community supply');
    this.setTaxCategoryCode('K');
    return this;
  }

  addCharge(e: Charge): this {
    this.charges.push(e);
    return this;
  }

  addAllowance(a: Allowance): this {
    this.allowances.push(a);
    return this;
  }

  addAttribute(key: string, value: string): this {
    this.attributes.set(key, value);
    return this;
  }

  // Interface implementation
  getUnit(): string | null {
    return this.unit;
  }

  getName(): string | null {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getVATPercent(): Decimal | null {
    return this.vatPercent;
  }

  getSellerAssignedID(): string | null {
    return this.sellerAssignedID;
  }

  getBuyerAssignedID(): string | null {
    return this.buyerAssignedID;
  }

  getTaxCategoryCode(): string {
    if (this.taxCategoryCode == null) {
      return getDefaultTaxCategoryCode(this);
    }
    return this.taxCategoryCode;
  }

  getTaxExemptionReason(): string | null {
    return this.taxExemptionReason;
  }

  getTaxExemptionReasonCode(): string | null {
    return this.taxExemptionReasonCode;
  }

  isReverseCharge(): boolean {
    return this._isReverseCharge;
  }

  isIntraCommunitySupply(): boolean {
    return this._isIntraCommunitySupply;
  }

  getGlobalID(): string | null {
    return null;
  }

  getGlobalIDScheme(): string | null {
    return null;
  }

  getCountryOfOrigin(): string | null {
    return this.countryOfOrigin;
  }

  getAttributes(): Map<string, string> | null {
    if (this.attributes.size === 0) {
      return null;
    }
    return this.attributes;
  }

  getCharges(): Charge[] | null {
    if (this.charges.length === 0) {
      return null;
    }
    return this.charges;
  }

  getAllowances(): Allowance[] | null {
    if (this.allowances.length === 0) {
      return null;
    }
    return this.allowances;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): Product {
    const product = new Product();
    if (data.name) product.setName(data.name);
    if (data.description != null) product.setDescription(data.description);
    if (data.unit) product.setUnit(data.unit);
    if (data.reverseCharge === true) product.setReverseCharge();
    if (data.intraCommunitySupply === true) product.setIntraCommunitySupply();
    if (data.vatpercent != null) product.setVATPercent(new Big(data.vatpercent));
    if (data.taxCategoryCode) product.setTaxCategoryCode(data.taxCategoryCode);
    if (data.sellerAssignedID) product.setSellerAssignedID(data.sellerAssignedID);
    if (data.buyerAssignedID) product.setBuyerAssignedID(data.buyerAssignedID);
    if (data.countryOfOrigin) product.setCountryOfOrigin(data.countryOfOrigin);
    if (data.taxExemptionReason) product.setTaxExemptionReason(data.taxExemptionReason);
    if (data.taxExemptionReasonCode) product.setTaxExemptionReasonCode(data.taxExemptionReasonCode);
    if (data.allowances) {
      for (const a of data.allowances) {
        product.addAllowance(Allowance.fromJSON(a));
      }
    }
    if (data.charges) {
      for (const c of data.charges) {
        product.addCharge(Charge.fromJSON(c));
      }
    }
    return product;
  }
}
