import { Big, ZERO, type Decimal } from '../decimal.js';
import type { Profile } from '../constants/profiles.js';
import type { ExportableTransaction } from '../interfaces/exportable-transaction.js';
import { TransactionCalculator } from '../calc/transaction-calculator.js';
import { Severity } from './severity.js';
import type { ValidationResultItem } from './validation-result-item.js';
import { ValidationResult } from './validation-result.js';

const HEADER_ONLY_PROFILES = new Set(['MINIMUM', 'BASICWL']);

export class InvoiceValidator {
  private readonly profile: Profile;

  constructor(profile: Profile) {
    this.profile = profile;
  }

  validate(invoice: ExportableTransaction): ValidationResult {
    const items: ValidationResultItem[] = [];

    this.checkRequiredFields(invoice, items);

    if (!HEADER_ONLY_PROFILES.has(this.profile.getName())) {
      this.checkLineItems(invoice, items);
    }

    this.checkArithmetic(invoice, items);
    this.checkTaxCategories(invoice, items);

    return new ValidationResult(items);
  }

  private checkRequiredFields(
    invoice: ExportableTransaction,
    items: ValidationResultItem[],
  ): void {
    if (!invoice.getNumber()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-02',
        message: 'An Invoice shall have an Invoice number.',
      });
    }

    if (invoice.getIssueDate() == null) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-03',
        message: 'An Invoice shall have an Invoice issue date.',
      });
    }

    if (!invoice.getCurrency()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-04',
        message: 'An Invoice shall have an Invoice currency code.',
      });
    }

    const sender = invoice.getSender();
    if (!sender?.getName()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-05',
        message: 'An Invoice shall have the Seller name.',
      });
    }

    const recipient = invoice.getRecipient();
    if (!recipient?.getName()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-06',
        message: 'An Invoice shall have the Buyer name.',
      });
    }

    // Seller address (BR-07) and country (BR-08)
    // BR-07 checks that the postal address group (BG-5) exists.
    // Country alone satisfies this — country-only addresses are valid per EN16931.
    if (
      !sender?.getStreet() &&
      !sender?.getZIP() &&
      !sender?.getLocation() &&
      !sender?.getCountry()
    ) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-07',
        message: 'An Invoice shall have the Seller postal address.',
      });
    }

    if (!sender?.getCountry()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-08',
        message:
          'The Seller postal address shall have a Seller country code.',
      });
    }

    // Buyer address (BR-09) and country (BR-10)
    // BR-09 checks that the postal address group (BG-8) exists.
    // Country alone satisfies this — country-only addresses are valid per EN16931.
    if (
      !recipient?.getStreet() &&
      !recipient?.getZIP() &&
      !recipient?.getLocation() &&
      !recipient?.getCountry()
    ) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-09',
        message: 'An Invoice shall have the Buyer postal address.',
      });
    }

    if (!recipient?.getCountry()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-10',
        message:
          'The Buyer postal address shall have a Buyer country code.',
      });
    }

    // BR-11: Seller must have VAT ID or Tax ID
    if (!sender?.getVATID() && !sender?.getTaxID()) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-11',
        message:
          'The Seller shall have a Seller VAT identifier or a Seller tax registration identifier.',
      });
    }
  }

  private checkLineItems(
    invoice: ExportableTransaction,
    items: ValidationResultItem[],
  ): void {
    const lineItems = invoice.getZFItems();

    if (lineItems.length === 0) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-13',
        message: 'An Invoice shall have at least one Invoice line.',
      });
    }

    for (let i = 0; i < lineItems.length; i++) {
      const lineItem = lineItems[i];
      if (!lineItem.getProduct()?.getName()) {
        items.push({
          severity: Severity.ERROR,
          ruleId: 'BR-25',
          message: 'Each Invoice line shall have an Item name.',
          location: `line[${i}]`,
        });
      }
    }
  }

  private checkArithmetic(
    invoice: ExportableTransaction,
    items: ValidationResultItem[],
  ): void {
    // Only check arithmetic for CalculatedInvoice (has stored totals)
    if (!('getLineTotalAmount' in invoice)) {
      return;
    }

    const ci = invoice as ExportableTransaction & {
      getLineTotalAmount(): Decimal;
      getGrandTotal(): Decimal;
      getTaxBasis(): Decimal;
      getDuePayable(): Decimal;
    };

    const tc = new TransactionCalculator(invoice);

    const stated = ci.getLineTotalAmount();
    const computed = tc.getValue();
    if (!this.amountsMatch(stated, computed)) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-CO-10',
        message: `Sum of Invoice line net amounts does not match line total: stated ${stated}, computed ${computed}.`,
      });
    }

    const statedTaxBasis = ci.getTaxBasis();
    const computedTaxBasis = tc.getTaxBasis();
    if (!this.amountsMatch(statedTaxBasis, computedTaxBasis)) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-CO-13',
        message: `Invoice total without VAT does not match: stated ${statedTaxBasis}, computed ${computedTaxBasis}.`,
      });
    }

    const statedGrand = ci.getGrandTotal();
    const computedGrand = tc.getGrandTotal();
    if (!this.amountsMatch(statedGrand, computedGrand)) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-CO-15',
        message: `Invoice total with VAT does not match: stated ${statedGrand}, computed ${computedGrand}.`,
      });
    }

    const statedDue = ci.getDuePayable();
    const computedDue = tc.getDuePayable();
    if (!this.amountsMatch(statedDue, computedDue)) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-CO-16',
        message: `Amount due for payment does not match: stated ${statedDue}, computed ${computedDue}.`,
      });
    }
  }

  private amountsMatch(a: Decimal, b: Decimal): boolean {
    return a.round(2, Big.roundHalfUp).eq(b.round(2, Big.roundHalfUp));
  }

  private checkTaxCategories(
    invoice: ExportableTransaction,
    items: ValidationResultItem[],
  ): void {
    // Track whether any item in a tax category has an exemption reason
    // (EN16931 BR-E-10/BR-AE-10 require it at VAT breakdown level, not per line)
    const categoryHasExemptionReason = new Map<string, boolean>();

    for (let i = 0; i < invoice.getZFItems().length; i++) {
      const lineItem = invoice.getZFItems()[i];
      const product = lineItem.getProduct();
      if (!product) continue;

      const categoryCode = product.getTaxCategoryCode();
      const vatPercent = product.getVATPercent();
      const location = `line[${i}]`;

      // Track exemption reasons per category
      if (categoryCode && product.getTaxExemptionReason()) {
        categoryHasExemptionReason.set(categoryCode, true);
      }

      switch (categoryCode) {
        case 'S': // Standard rate
          if (vatPercent != null && vatPercent.lte(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-S',
              message:
                'Standard rated items must have a VAT rate greater than zero.',
              location,
            });
          }
          break;

        case 'E': // Tax exempt
          if (vatPercent != null && !vatPercent.eq(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-E',
              message: 'Tax exempt items must have a VAT rate of zero.',
              location,
            });
          }
          break;

        case 'AE': // Reverse charge
          if (vatPercent != null && !vatPercent.eq(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-AE',
              message: 'Reverse charge items must have a VAT rate of zero.',
              location,
            });
          }
          break;

        case 'Z': // Zero rate
          if (vatPercent != null && !vatPercent.eq(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-Z',
              message: 'Zero rated items must have a VAT rate of zero.',
              location,
            });
          }
          break;

        case 'O': // Outside scope
          if (vatPercent != null && !vatPercent.eq(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-O',
              message:
                'Items outside scope of VAT must have a VAT rate of zero.',
              location,
            });
          }
          break;

        case 'K': // Intra-community
          if (vatPercent != null && !vatPercent.eq(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-IC',
              message:
                'Intra-community supply items must have a VAT rate of zero.',
              location,
            });
          }
          break;

        case 'G': // Free export
          if (vatPercent != null && !vatPercent.eq(ZERO)) {
            items.push({
              severity: Severity.ERROR,
              ruleId: 'BR-G',
              message: 'Free export items must have a VAT rate of zero.',
              location,
            });
          }
          break;
      }
    }

    // Document-level exemption reason checks (BR-E-10, BR-AE-10)
    const categoriesUsed = new Set<string>();
    for (const lineItem of invoice.getZFItems()) {
      const code = lineItem.getProduct()?.getTaxCategoryCode();
      if (code) categoriesUsed.add(code);
    }

    if (categoriesUsed.has('E') && !categoryHasExemptionReason.get('E')) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-E',
        message:
          'VAT breakdown for tax exempt (E) must have a tax exemption reason.',
      });
    }

    if (categoriesUsed.has('AE') && !categoryHasExemptionReason.get('AE')) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-AE',
        message:
          'VAT breakdown for reverse charge (AE) must have a tax exemption reason.',
      });
    }

    if (categoriesUsed.has('G') && !categoryHasExemptionReason.get('G')) {
      items.push({
        severity: Severity.ERROR,
        ruleId: 'BR-G',
        message:
          'VAT breakdown for free export (G) must have a tax exemption reason.',
      });
    }
  }
}
