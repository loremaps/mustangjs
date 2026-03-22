import type { Decimal } from '../decimal.js';
import type { AllowanceCharge } from './allowance-charge.js';
import { TaxCategoryCode } from '../constants/tax-category-code.js';
import { ZERO } from '../decimal.js';

export interface ExportableProduct {
  getUnit(): string | null;
  getName(): string | null;
  getDescription(): string;
  getVATPercent(): Decimal | null;
  getSellerAssignedID(): string | null;
  getBuyerAssignedID(): string | null;
  getTaxCategoryCode(): string;
  getTaxExemptionReason(): string | null;
  getTaxExemptionReasonCode(): string | null;
  isReverseCharge(): boolean;
  isIntraCommunitySupply(): boolean;
  getGlobalID(): string | null;
  getGlobalIDScheme(): string | null;
  getCountryOfOrigin(): string | null;
  getAttributes(): Map<string, string> | null;
  getAllowances(): AllowanceCharge[] | null;
  getCharges(): AllowanceCharge[] | null;
}

export function getDefaultTaxCategoryCode(product: ExportableProduct): string {
  if (product.isIntraCommunitySupply()) {
    return TaxCategoryCode.INTRACOMMUNITY;
  } else if (product.isReverseCharge()) {
    return TaxCategoryCode.REVERSECHARGE;
  } else if (
    product.getVATPercent() == null ||
    product.getVATPercent()!.eq(ZERO)
  ) {
    return TaxCategoryCode.ZEROTAXPRODUCTS;
  } else {
    return TaxCategoryCode.STANDARDRATE;
  }
}
