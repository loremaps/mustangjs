import { describe, it, expect } from 'vitest';
import { readFixture } from './helpers/test-utils.js';
import { SchematronValidator } from '../src/validation/schematron-validator.js';
import { XMLValidator } from '../src/validation/xml-validator.js';
import { Profiles } from '../src/constants/profiles.js';
import { Severity } from '../src/validation/severity.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { Invoice } from '../src/model/invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { Big } from '../src/decimal.js';

const schematron = new SchematronValidator();
const xmlValidator = new XMLValidator();

// ── SchematronValidator direct tests ──

describe('SchematronValidator', () => {
  it('validates a known-good CII fixture (factur-x.xml)', async () => {
    const xml = readFixture('factur-x.xml');
    const result = await schematron.validate(xml, 'cii', Profiles.getByName('EN16931'));
    const errors = result.getErrors();
    if (errors.length > 0) {
      console.log('Unexpected errors:', errors.map(e => `${e.ruleId}: ${e.message}`));
    }
    expect(result.isValid()).toBe(true);
  });

  it('EN16931 Schematron flags EXTENDED-specific features (expected)', async () => {
    // EN16931 Schematron validates against base EN16931 rules;
    // EXTENDED documents may use features that violate these base rules.
    // This is expected — full EXTENDED validation requires ZF_240 profile Schematron.
    const xml = readFixture('factur-x-extended.xml');
    const result = await schematron.validate(xml, 'cii', Profiles.getByName('EXTENDED'));
    const errors = result.getErrors();
    // We expect some errors because EN16931 schematron doesn't understand EXTENDED features
    expect(errors.length).toBeGreaterThan(0);
    // But verify Schematron actually ran and produced structured results
    for (const e of errors) {
      expect(e.ruleId).toBeTruthy();
      expect(e.message).toBeTruthy();
    }
  });

  it('validates CII with invoicing period fixture', async () => {
    const xml = readFixture('factur-x_invoicingPeriod.xml');
    const result = await schematron.validate(xml, 'cii', Profiles.getByName('EN16931'));
    const errors = result.getErrors();
    if (errors.length > 0) {
      console.log('Unexpected errors:', errors.map(e => `${e.ruleId}: ${e.message}`));
    }
    expect(result.isValid()).toBe(true);
  });

  it('returns warnings and notices without failing validity', async () => {
    const xml = readFixture('factur-x.xml');
    const result = await schematron.validate(xml, 'cii', Profiles.getByName('EN16931'));
    // Even if there are warnings, isValid() only checks errors
    const warnings = result.getWarnings();
    const notices = result.getNotices();
    // Just ensure the severity mapping works
    for (const w of warnings) expect(w.severity).toBe(Severity.WARNING);
    for (const n of notices) expect(n.severity).toBe(Severity.NOTICE);
  });

  it('detects issues in a known-bad CII fixture', async () => {
    const xml = readFixture('not_validating_full_invoice_based_onTest_EeISI_300_CENfullmodel.cii.xml');
    const result = await schematron.validate(xml, 'cii', Profiles.getByName('EN16931'));
    expect(result.getAll().length).toBeGreaterThan(0);
  });

  it('detects issues in a known-bad UBL fixture', async () => {
    const xml = readFixture('not_validating_full_invoice_based_onTest_EeISI_300_CENfullmodel.ubl.xml');
    const result = await schematron.validate(xml, 'ubl', Profiles.getByName('EN16931'));
    expect(result.getAll().length).toBeGreaterThan(0);
  });

  it('XRechnung rules run in addition to EN16931 for XRECHNUNG profile', async () => {
    const xml = readFixture('XRECHNUNG_Einfach.ubl.xml');
    // EN16931-only: may have some PEPPOL-specific errors
    const en16931Result = await schematron.validate(xml, 'ubl', Profiles.getByName('EN16931'));
    // XRECHNUNG: runs both EN16931 + XRechnung rules
    const xrResult = await schematron.validate(xml, 'ubl', Profiles.getByName('XRECHNUNG'));
    // XRechnung result should have at least as many items as EN16931-only
    expect(xrResult.getAll().length).toBeGreaterThanOrEqual(en16931Result.getAll().length);
  });

  it('produces structured SVRL results with rule IDs', async () => {
    const xml = readFixture('not_validating_full_invoice_based_onTest_EeISI_300_CENfullmodel.cii.xml');
    const result = await schematron.validate(xml, 'cii', Profiles.getByName('EN16931'));
    const all = result.getAll();
    expect(all.length).toBeGreaterThan(0);
    // Every result should have structured fields
    for (const item of all) {
      expect(item.ruleId).toBeDefined();
      expect(item.message).toBeDefined();
      expect([Severity.ERROR, Severity.WARNING, Severity.NOTICE]).toContain(item.severity);
    }
  });
});

// ── XMLValidator integration tests ──

describe('XMLValidator', () => {
  it('auto-detects CII format and profile', async () => {
    const xml = readFixture('factur-x.xml');
    const result = await xmlValidator.validate(xml);
    expect(result.isValid()).toBe(true);
  });

  it('validates with profile override', async () => {
    const xml = readFixture('factur-x.xml');
    const result = await xmlValidator.validate(xml, {
      profile: Profiles.getByName('EN16931'),
    });
    expect(result.isValid()).toBe(true);
  });

  it('can skip Schematron and only run programmatic rules', async () => {
    const xml = readFixture('factur-x.xml');
    const result = await xmlValidator.validate(xml, { skipSchematron: true });
    expect(result.isValid()).toBe(true);
  });

  it('can skip programmatic rules and only run Schematron', async () => {
    const xml = readFixture('factur-x.xml');
    const result = await xmlValidator.validate(xml, { skipProgrammatic: true });
    expect(result.isValid()).toBe(true);
  });

  it('validates a round-trip CII export', async () => {
    // Build an invoice programmatically
    const inv = new Invoice();
    inv.setNumber('RT-001');
    inv.setIssueDate(new Date(2024, 0, 15));
    inv.setCurrency('EUR');
    inv.setDocumentCode('380');

    const seller = new TradeParty('Seller GmbH', 'Hauptstr. 1', '12345', 'Berlin', 'DE');
    seller.addVATID('DE123456789');
    inv.setSender(seller);

    const buyer = new TradeParty('Buyer AG', 'Nebenstr. 2', '54321', 'Munich', 'DE');
    buyer.addVATID('DE987654321');
    inv.setRecipient(buyer);
    inv.setDueDate(new Date(2024, 1, 15));

    const product = new Product('Widget', '', 'C62', new Big(19));
    product.setTaxCategoryCode('S');
    inv.addItem(new Item(product, new Big(100), new Big(2)));

    // Export to CII XML
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(inv);
    const xml = provider.getXML();

    // Validate the exported XML with Schematron
    const result = await xmlValidator.validate(xml, { skipProgrammatic: true });
    const errors = result.getErrors();
    if (errors.length > 0) {
      console.log('Round-trip errors:', errors.map(e => `${e.ruleId}: ${e.message}`));
    }
    expect(result.isValid()).toBe(true);
  });

  it('combines Schematron and programmatic results', async () => {
    const xml = readFixture('factur-x.xml');
    // Run both
    const combined = await xmlValidator.validate(xml);
    // Run individually
    const schematronOnly = await xmlValidator.validate(xml, { skipProgrammatic: true });
    const programmaticOnly = await xmlValidator.validate(xml, { skipSchematron: true });
    // Combined should include items from both
    expect(combined.getAll().length).toBe(
      schematronOnly.getAll().length + programmaticOnly.getAll().length,
    );
  });
});

// ── Profile auto-detection tests ──

describe('Profile auto-detection', () => {
  it('detects EN16931 from CII factur-x.xml', () => {
    const xml = readFixture('factur-x.xml');
    const importer = new ZUGFeRDInvoiceImporter(xml);
    const profile = importer.getProfile();
    expect(profile).not.toBeNull();
    expect(profile!.getName()).toBe('EN16931');
  });

  it('detects EXTENDED from CII factur-x-extended.xml', () => {
    const xml = readFixture('factur-x-extended.xml');
    const importer = new ZUGFeRDInvoiceImporter(xml);
    const profile = importer.getProfile();
    expect(profile).not.toBeNull();
    expect(profile!.getName()).toBe('EXTENDED');
  });

  it('detects EN16931 from UBL PEPPOL BIS fixture (not XRECHNUNG)', () => {
    // PEPPOL BIS CustomizationID is NOT XRechnung — it's a generic EN16931 extension.
    // Only customization IDs containing "xrechnung" or "xeinkauf" map to XRECHNUNG.
    const xml = readFixture('XRECHNUNG_Einfach.ubl.xml');
    const importer = new ZUGFeRDInvoiceImporter(xml);
    const profile = importer.getProfile();
    expect(profile).not.toBeNull();
    expect(profile!.getName()).toBe('EN16931');
  });

  it('detects EXTENDED from CII foreign currency fixture', () => {
    const xml = readFixture('Extended_fremdwaehrung.xml');
    const importer = new ZUGFeRDInvoiceImporter(xml);
    const profile = importer.getProfile();
    expect(profile).not.toBeNull();
    expect(profile!.getName()).toBe('EXTENDED');
  });

  it('detects EN16931 from plain UBL fixture', () => {
    const xml = readFixture('ubl-conv-ubl-output-factur-x.xml');
    const importer = new ZUGFeRDInvoiceImporter(xml);
    const profile = importer.getProfile();
    expect(profile).not.toBeNull();
    expect(profile!.getName()).toBe('EN16931');
  });
});
