import type { Decimal } from '../../src/decimal.js';
import type { ExportableProduct } from '../../src/interfaces/exportable-product.js';
import { getDefaultTaxCategoryCode } from '../../src/interfaces/exportable-product.js';
import type { AllowanceCharge } from '../../src/interfaces/allowance-charge.js';

export class ExportableProductImpl implements ExportableProduct {
  private unit: string | null = null;
  private name: string | null = null;
  private description: string = '';
  private vatPercent: Decimal | null = null;

  setUnit(unit: string): this {
    this.unit = unit;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  setVatPercent(vatPercent: Decimal): this {
    this.vatPercent = vatPercent;
    return this;
  }

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
    return null;
  }

  getBuyerAssignedID(): string | null {
    return null;
  }

  getTaxCategoryCode(): string {
    return getDefaultTaxCategoryCode(this);
  }

  getTaxExemptionReason(): string | null {
    return null;
  }

  getTaxExemptionReasonCode(): string | null {
    return null;
  }

  isReverseCharge(): boolean {
    return false;
  }

  isIntraCommunitySupply(): boolean {
    return false;
  }

  getGlobalID(): string | null {
    return null;
  }

  getGlobalIDScheme(): string | null {
    return null;
  }

  getCountryOfOrigin(): string | null {
    return null;
  }

  getAttributes(): Map<string, string> | null {
    return null;
  }

  getAllowances(): AllowanceCharge[] | null {
    return null;
  }

  getCharges(): AllowanceCharge[] | null {
    return null;
  }
}
