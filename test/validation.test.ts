import { describe, it, expect } from 'vitest';
import { Big, ZERO } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { Contact } from '../src/model/contact.js';
import { BankDetails } from '../src/model/bank-details.js';
import { Profiles } from '../src/constants/profiles.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { Severity } from '../src/validation/severity.js';
import { ValidationResult } from '../src/validation/validation-result.js';
import { InvoiceValidator } from '../src/validation/invoice-validator.js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ───

function createValidInvoice(): Invoice {
  return new Invoice()
    .setNumber('INV-001')
    .setIssueDate(new Date(2024, 0, 1))
    .setDueDate(new Date(2024, 0, 15))
    .setDeliveryDate(new Date(2024, 0, 1))
    .setCurrency('EUR')
    .setSender(
      new TradeParty('Seller GmbH', 'Sellerstr. 1', '12345', 'Berlin', 'DE')
        .addTaxID('DE111')
        .addVATID('DE222')
        .setEmail('seller@example.com')
        .setContact(new Contact('Max Seller', '+4930123456', 'max@seller.de'))
        .addBankDetails(
          new BankDetails('DE89370400440532013000', 'COBADEFFXXX'),
        ),
    )
    .setRecipient(
      new TradeParty('Buyer AG', 'Buyerstr. 2', '54321', 'Munich', 'DE'),
    )
    .setReferenceNumber('REF-001')
    .addItem(
      new Item(
        new Product('Test Product', '', 'C62', new Big(19)),
        new Big(100),
        new Big(1),
      ),
    );
}

function createValidCalculatedInvoice(): CalculatedInvoice {
  const inv = createValidInvoice();
  // Export and re-import to get a CalculatedInvoice with stated totals
  const zf2p = new ZUGFeRD2PullProvider();
  zf2p.setProfile(Profiles.getByName('EN16931'));
  zf2p.generateXML(inv);
  const xml = zf2p.getXML();
  const zii = new ZUGFeRDInvoiceImporter(xml);
  const ci = new CalculatedInvoice();
  zii.extractInto(ci);
  return ci;
}

const en16931 = Profiles.getByName('EN16931');

// ─── Tests ───

describe('InvoiceValidator', () => {
  // ── Phase 1: ValidationResult API ──

  describe('ValidationResult API', () => {
    it('isValid returns true for empty items', () => {
      const result = new ValidationResult([]);
      expect(result.isValid()).toBe(true);
      expect(result.getErrors()).toEqual([]);
      expect(result.getWarnings()).toEqual([]);
      expect(result.getNotices()).toEqual([]);
    });

    it('isValid returns false when errors present', () => {
      const result = new ValidationResult([
        {
          severity: Severity.ERROR,
          ruleId: 'BR-02',
          message: 'Missing number',
        },
      ]);
      expect(result.isValid()).toBe(false);
      expect(result.getErrors()).toHaveLength(1);
    });

    it('isValid returns true when only warnings present', () => {
      const result = new ValidationResult([
        {
          severity: Severity.WARNING,
          ruleId: 'W-01',
          message: 'A warning',
        },
      ]);
      expect(result.isValid()).toBe(true);
      expect(result.getWarnings()).toHaveLength(1);
    });

    it('hasRule finds matching rule ID', () => {
      const result = new ValidationResult([
        {
          severity: Severity.ERROR,
          ruleId: 'BR-02',
          message: 'Missing number',
        },
        {
          severity: Severity.WARNING,
          ruleId: 'W-01',
          message: 'A warning',
        },
      ]);
      expect(result.hasRule('BR-02')).toBe(true);
      expect(result.hasRule('W-01')).toBe(true);
      expect(result.hasRule('BR-99')).toBe(false);
    });

    it('getAll returns all items', () => {
      const result = new ValidationResult([
        {
          severity: Severity.ERROR,
          ruleId: 'BR-02',
          message: 'err',
        },
        {
          severity: Severity.NOTICE,
          ruleId: 'N-01',
          message: 'notice',
        },
      ]);
      expect(result.getAll()).toHaveLength(2);
      expect(result.getNotices()).toHaveLength(1);
    });
  });

  // ── Phase 2: Required field rules ──

  describe('Required field rules', () => {
    it('BR-02: missing invoice number', () => {
      const inv = createValidInvoice();
      (inv as any).number = null;
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-02')).toBe(true);
    });

    it('BR-03: missing issue date', () => {
      const inv = createValidInvoice();
      (inv as any).issueDate = null;
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-03')).toBe(true);
    });

    it('BR-04: missing currency', () => {
      const inv = createValidInvoice();
      (inv as any).currency = '';
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-04')).toBe(true);
    });

    it('BR-05: missing seller name', () => {
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty(undefined, 'Str', '12345', 'City', 'DE').addVATID(
          'DE123',
        ),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-05')).toBe(true);
    });

    it('BR-06: missing buyer name', () => {
      const inv = createValidInvoice();
      inv.setRecipient(
        new TradeParty(undefined, 'Str', '12345', 'City', 'DE'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-06')).toBe(true);
    });

    it('BR-07: missing seller address (no address fields at all)', () => {
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty('Seller', undefined, undefined, undefined, undefined)
          .addVATID('DE123'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-07')).toBe(true);
    });

    it('BR-07: country-only address satisfies postal address group', () => {
      // EN16931 BG-5 exists if any address field is present; country alone is sufficient.
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty('Seller', undefined, undefined, undefined, 'DE')
          .addVATID('DE123'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-07')).toBe(false);
    });

    it('BR-08: missing seller country', () => {
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty('Seller', 'Str', '12345', 'City', undefined)
          .addVATID('DE123'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-08')).toBe(true);
    });

    it('BR-09: missing buyer address (no address fields at all)', () => {
      const inv = createValidInvoice();
      inv.setRecipient(
        new TradeParty('Buyer', undefined, undefined, undefined, undefined),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-09')).toBe(true);
    });

    it('BR-09: country-only address satisfies postal address group', () => {
      // EN16931 BG-8 exists if any address field is present; country alone is sufficient.
      // This matches the real-world case where buyer has empty street/zip/city but valid country.
      const inv = createValidInvoice();
      inv.setRecipient(
        new TradeParty('Buyer', undefined, undefined, undefined, 'GR'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-09')).toBe(false);
    });

    it('BR-10: missing buyer country', () => {
      const inv = createValidInvoice();
      inv.setRecipient(
        new TradeParty('Buyer', 'Str', '12345', 'City', undefined),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-10')).toBe(true);
    });

    it('BR-11: seller missing both VAT ID and Tax ID', () => {
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty('Seller', 'Str', '12345', 'City', 'DE'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-11')).toBe(true);
    });

    it('BR-11: seller with only Tax ID passes', () => {
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty('Seller', 'Str', '12345', 'City', 'DE')
          .addTaxID('DE111'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-11')).toBe(false);
    });

    it('BR-11: seller with only VAT ID passes', () => {
      const inv = createValidInvoice();
      inv.setSender(
        new TradeParty('Seller', 'Str', '12345', 'City', 'DE')
          .addVATID('DE222'),
      );
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-11')).toBe(false);
    });

    it('no sender at all triggers BR-05, BR-07, BR-08, BR-11', () => {
      const inv = createValidInvoice();
      (inv as any).sender = null;
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-05')).toBe(true);
      expect(result.hasRule('BR-07')).toBe(true);
      expect(result.hasRule('BR-08')).toBe(true);
      expect(result.hasRule('BR-11')).toBe(true);
    });

    it('no recipient at all triggers BR-06, BR-09, BR-10', () => {
      const inv = createValidInvoice();
      (inv as any).recipient = null;
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-06')).toBe(true);
      expect(result.hasRule('BR-09')).toBe(true);
      expect(result.hasRule('BR-10')).toBe(true);
    });

    it('valid invoice has no required field errors', () => {
      const inv = createValidInvoice();
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-02')).toBe(false);
      expect(result.hasRule('BR-03')).toBe(false);
      expect(result.hasRule('BR-04')).toBe(false);
      expect(result.hasRule('BR-05')).toBe(false);
      expect(result.hasRule('BR-06')).toBe(false);
      expect(result.hasRule('BR-07')).toBe(false);
      expect(result.hasRule('BR-08')).toBe(false);
      expect(result.hasRule('BR-09')).toBe(false);
      expect(result.hasRule('BR-10')).toBe(false);
      expect(result.hasRule('BR-11')).toBe(false);
    });
  });

  // ── Phase 3: Line item rules ──

  describe('Line item rules', () => {
    it('BR-13: no line items on EN16931 profile', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-13')).toBe(true);
    });

    it('BR-13: no line items on BASIC profile', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('BASIC'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(true);
    });

    it('BR-13: skipped for MINIMUM profile', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('MINIMUM'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(false);
    });

    it('BR-13: skipped for BASICWL profile', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('BASICWL'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(false);
    });

    it('BR-25: missing item name', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(new Product(undefined, '', 'C62', new Big(19)), new Big(100), new Big(1)),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-25')).toBe(true);
    });

    it('BR-25: skipped for MINIMUM profile', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(new Product(undefined, '', 'C62', new Big(19)), new Big(100), new Big(1)),
      ];
      const result = new InvoiceValidator(
        Profiles.getByName('MINIMUM'),
      ).validate(inv);
      expect(result.hasRule('BR-25')).toBe(false);
    });

    it('valid line items pass', () => {
      const inv = createValidInvoice();
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-13')).toBe(false);
      expect(result.hasRule('BR-25')).toBe(false);
    });
  });

  // ── Phase 4: Arithmetic rules ──

  describe('Arithmetic rules', () => {
    it('correct CalculatedInvoice passes arithmetic checks', () => {
      const ci = createValidCalculatedInvoice();
      const result = new InvoiceValidator(en16931).validate(ci);
      expect(result.hasRule('BR-CO-10')).toBe(false);
      expect(result.hasRule('BR-CO-13')).toBe(false);
      expect(result.hasRule('BR-CO-15')).toBe(false);
      expect(result.hasRule('BR-CO-16')).toBe(false);
    });

    it('BR-CO-10: wrong line total', () => {
      const ci = createValidCalculatedInvoice();
      ci.setLineTotalAmount(new Big(999));
      const result = new InvoiceValidator(en16931).validate(ci);
      expect(result.hasRule('BR-CO-10')).toBe(true);
    });

    it('BR-CO-13: wrong tax basis', () => {
      const ci = createValidCalculatedInvoice();
      ci.setTaxBasis(new Big(999));
      const result = new InvoiceValidator(en16931).validate(ci);
      expect(result.hasRule('BR-CO-13')).toBe(true);
    });

    it('BR-CO-15: wrong grand total', () => {
      const ci = createValidCalculatedInvoice();
      ci.setGrandTotal(new Big(999));
      const result = new InvoiceValidator(en16931).validate(ci);
      expect(result.hasRule('BR-CO-15')).toBe(true);
    });

    it('BR-CO-16: wrong due payable', () => {
      const ci = createValidCalculatedInvoice();
      ci.setDuePayable(new Big(999));
      const result = new InvoiceValidator(en16931).validate(ci);
      expect(result.hasRule('BR-CO-16')).toBe(true);
    });

    it('plain Invoice skips arithmetic checks', () => {
      const inv = createValidInvoice();
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-CO-10')).toBe(false);
      expect(result.hasRule('BR-CO-13')).toBe(false);
      expect(result.hasRule('BR-CO-15')).toBe(false);
      expect(result.hasRule('BR-CO-16')).toBe(false);
    });
  });

  // ── Phase 5: Tax category rules ──

  describe('Tax category rules', () => {
    it('BR-S: standard rate with zero VAT', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', new Big(0)).setTaxCategoryCode('S'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-S')).toBe(true);
    });

    it('BR-S: standard rate with positive VAT passes', () => {
      const inv = createValidInvoice();
      // Default createValidInvoice has 19% S-rate item
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-S')).toBe(false);
    });

    it('BR-E: exempt with non-zero VAT', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', new Big(19))
            .setTaxCategoryCode('E')
            .setTaxExemptionReason('Exempt'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-E')).toBe(true);
    });

    it('BR-E: exempt without exemption reason', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO).setTaxCategoryCode('E'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-E')).toBe(true);
    });

    it('BR-E: exempt with zero VAT and reason passes', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO)
            .setTaxCategoryCode('E')
            .setTaxExemptionReason('Tax exempt'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-E')).toBe(false);
    });

    it('BR-AE: reverse charge with non-zero VAT', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', new Big(19))
            .setTaxCategoryCode('AE')
            .setTaxExemptionReason('Reverse charge'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-AE')).toBe(true);
    });

    it('BR-AE: reverse charge without exemption reason', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO).setTaxCategoryCode('AE'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-AE')).toBe(true);
    });

    it('BR-AE: reverse charge with zero VAT and reason passes', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO)
            .setTaxCategoryCode('AE')
            .setTaxExemptionReason('Reverse charge'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-AE')).toBe(false);
    });

    it('BR-Z: zero rate with non-zero VAT', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', new Big(7)).setTaxCategoryCode('Z'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-Z')).toBe(true);
    });

    it('BR-Z: zero rate with zero VAT passes', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO).setTaxCategoryCode('Z'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-Z')).toBe(false);
    });

    it('BR-O: outside scope with non-zero VAT', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', new Big(5)).setTaxCategoryCode('O'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-O')).toBe(true);
    });

    it('BR-O: outside scope with zero VAT passes', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO).setTaxCategoryCode('O'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-O')).toBe(false);
    });

    it('BR-IC: intra-community with non-zero VAT', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', new Big(10)).setTaxCategoryCode(
            'K',
          ),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-IC')).toBe(true);
    });

    it('BR-IC: intra-community with zero VAT passes', () => {
      const inv = createValidInvoice();
      (inv as any).items = [
        new Item(
          new Product('Product', '', 'C62', ZERO).setTaxCategoryCode('K'),
          new Big(100),
          new Big(1),
        ),
      ];
      const result = new InvoiceValidator(en16931).validate(inv);
      expect(result.hasRule('BR-IC')).toBe(false);
    });
  });

  // ── Phase 6: Profile-aware validation ──

  describe('Profile-aware validation', () => {
    it('MINIMUM profile: line item rules skipped', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('MINIMUM'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(false);
      expect(result.hasRule('BR-25')).toBe(false);
      // Required field rules still apply
      expect(result.isValid()).toBe(true);
    });

    it('BASICWL profile: line item rules skipped', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('BASICWL'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(false);
    });

    it('EXTENDED profile: line items required', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('EXTENDED'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(true);
    });

    it('XRECHNUNG profile: line items required', () => {
      const inv = createValidInvoice();
      (inv as any).items = [];
      const result = new InvoiceValidator(
        Profiles.getByName('XRECHNUNG'),
      ).validate(inv);
      expect(result.hasRule('BR-13')).toBe(true);
    });
  });

  // ── Integration: validate a real imported fixture ──

  describe('Integration with fixtures', () => {
    it('imported factur-x.xml validates as valid', () => {
      const fixturePath = path.join(
        __dirname,
        'fixtures',
        'factur-x.xml',
      );
      const xml = fs.readFileSync(fixturePath, 'utf-8');
      const zii = new ZUGFeRDInvoiceImporter(xml);
      const ci = new CalculatedInvoice();
      zii.extractInto(ci);

      const result = new InvoiceValidator(en16931).validate(ci);
      const errors = result.getErrors();
      expect(errors).toEqual([]);
      expect(result.isValid()).toBe(true);
    });

    it('valid invoice round-trips and validates', () => {
      const inv = createValidInvoice();
      const zf2p = new ZUGFeRD2PullProvider();
      zf2p.setProfile(en16931);
      zf2p.generateXML(inv);
      const xml = zf2p.getXML();

      const zii = new ZUGFeRDInvoiceImporter(xml);
      const ci = new CalculatedInvoice();
      zii.extractInto(ci);

      const result = new InvoiceValidator(en16931).validate(ci);
      expect(result.isValid()).toBe(true);
    });
  });
});
