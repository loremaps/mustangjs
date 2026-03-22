import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { Big, ZERO } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { Contact } from '../src/model/contact.js';
import { BankDetails } from '../src/model/bank-details.js';
import { LegalOrganisation } from '../src/model/legal-organisation.js';
import { Charge } from '../src/model/charge.js';
import { Allowance } from '../src/model/allowance.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { TransactionCalculator } from '../src/calc/transaction-calculator.js';
import { Profiles } from '../src/constants/profiles.js';

function xpathCount(xmlStr: string, expr: string): number {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const result = xpath.select(`count(//*[local-name()='${expr}'])`, doc);
  return typeof result === 'number' ? result : 0;
}

function xpathValue(xmlStr: string, expr: string): string {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const result = xpath.select(`string(//*[local-name()='${expr}'])`, doc);
  return typeof result === 'string' ? result : '';
}

function createBasicInvoice(): Invoice {
  return new Invoice()
    .setDueDate(new Date(2024, 0, 15))
    .setIssueDate(new Date(2024, 0, 1))
    .setDeliveryDate(new Date(2024, 0, 1))
    .setSender(
      new TradeParty('Seller GmbH', 'Sellerstr. 1', '12345', 'Berlin', 'DE')
        .addTaxID('DE111')
        .addVATID('DE222')
        .setEmail('seller@example.com')
        .setContact(new Contact('Max Seller', '+4930123456', 'max@seller.de'))
        .addBankDetails(new BankDetails('DE89370400440532013000', 'COBADEFFXXX')),
    )
    .setRecipient(
      new TradeParty('Buyer AG', 'Buyerstr. 2', '54321', 'Munich', 'DE'),
    )
    .setReferenceNumber('REF-001')
    .setNumber('INV-2024-001');
}

describe('MINIMUM Profile', () => {
  it('testMinimumExport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Test Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('MINIMUM'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<rsm:CrossIndustryInvoice');
    // MINIMUM profile should NOT have line items
    expect(xpathCount(theXML, 'IncludedSupplyChainTradeLineItem')).toBe(0);
    // Should still have totals
    expect(theXML).toContain('<ram:TaxBasisTotalAmount>');
    expect(theXML).toContain('<ram:GrandTotalAmount>');
    expect(theXML).toContain('<ram:DuePayableAmount>');
    // Should NOT have ApplicableTradeTax at header level (MINIMUM skips it)
    expect(xpathCount(theXML, 'ApplicableTradeTax')).toBe(0);
    // Should NOT have payment reference
    expect(theXML).not.toContain('<ram:PaymentReference>');
    // Grand total should be 119 (100 + 19% VAT)
    expect(parseFloat(xpathValue(theXML, 'GrandTotalAmount'))).toBe(119);
  });

  it('testMinimumRoundtrip', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Produkt', '', 'C62', new Big(19)),
          new Big(123),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('MINIMUM'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    expect(ci.getNumber()).toBe('INV-2024-001');
    expect(ci.getCurrency()).toBe('EUR');
    expect(parseFloat(ci.getGrandTotal()!.toString())).toBeCloseTo(146.37, 2);
  });
});

describe('BASICWL Profile', () => {
  it('testBasicWLExport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Test Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('BASICWL'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<rsm:CrossIndustryInvoice');
    // BASICWL should NOT have line items
    expect(xpathCount(theXML, 'IncludedSupplyChainTradeLineItem')).toBe(0);
    // But should have VAT breakdown at header
    expect(xpathCount(theXML, 'ApplicableTradeTax')).toBeGreaterThan(0);
    // Should have payment reference
    expect(theXML).toContain('<ram:PaymentReference>');
  });
});

describe('Credit Note', () => {
  it('testCreditNoteExport', () => {
    const i = createBasicInvoice()
      .setCreditNote()
      .addItem(
        new Item(
          new Product('Refund Product', '', 'C62', new Big(19)),
          new Big(50),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<rsm:CrossIndustryInvoice');
    // TypeCode should be 381 for credit notes
    expect(theXML).toContain('<ram:TypeCode>381</ram:TypeCode>');
    expect(parseFloat(xpathValue(theXML, 'DuePayableAmount'))).toBe(59.5);
  });
});

describe('Foreign Currency', () => {
  it('testUSDExport', () => {
    const i = createBasicInvoice()
      .setCurrency('USD')
      .addItem(
        new Item(
          new Product('US Product', '', 'C62', new Big(0)),
          new Big(100),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<ram:InvoiceCurrencyCode>USD</ram:InvoiceCurrencyCode>');
    expect(theXML).toContain('currencyID="USD"');
    expect(theXML).not.toContain('EUR');
  });
});

describe('Basis Quantity', () => {
  it('testBasisQuantityExportImport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Priced per 100', '', 'C62', new Big(19)),
          new Big(160),
          new Big(1),
        ).setBasisQuantity(new Big(100)),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Should contain BasisQuantity in the price
    expect(theXML).toContain('<ram:BasisQuantity');
    expect(theXML).toContain('100.0000');

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    // Item price per unit = 160 / 100 = 1.60
    // Total net = 1.60 * 1 = 1.60, tax = 0.304
    const tc = new TransactionCalculator(ci);
    expect(tc.getDuePayable().toNumber()).toBeCloseTo(1.90, 2);
  });
});

describe('Payee', () => {
  it('testPayeeExport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      )
      .setPayee(
        new TradeParty()
          .setName('Factoring GmbH')
          .setID('DE813838785')
          .setLegalOrganisation(new LegalOrganisation('391200LDD', '0199')),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<ram:PayeeTradeParty>');
    expect(theXML).toContain('<ram:Name>Factoring GmbH</ram:Name>');
    expect(theXML).toContain('<ram:ID>DE813838785</ram:ID>');
    expect(theXML).toContain('<ram:ID schemeID="0199">391200LDD</ram:ID>');
  });
});

describe('Invoicing Period', () => {
  it('testInvoicingPeriodExportImport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Monthly service', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      )
      .setDetailedDeliveryPeriod(
        new Date(2024, 0, 1),
        new Date(2024, 0, 31),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<ram:BillingSpecifiedPeriod>');
    expect(theXML).toContain('20240101');
    expect(theXML).toContain('20240131');

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    const periodFrom = ci.getDetailedDeliveryPeriodFrom()!;
    expect(periodFrom.getFullYear()).toBe(2024);
    expect(periodFrom.getMonth()).toBe(0);
    expect(periodFrom.getDate()).toBe(1);

    const periodTo = ci.getDetailedDeliveryPeriodTo()!;
    expect(periodTo.getFullYear()).toBe(2024);
    expect(periodTo.getMonth()).toBe(0);
    expect(periodTo.getDate()).toBe(31);
  });
});

describe('Special Characters', () => {
  it('testXMLEncoding', () => {
    const i = new Invoice()
      .setDueDate(new Date())
      .setIssueDate(new Date())
      .setDeliveryDate(new Date())
      .setSender(
        new TradeParty('Müller & Söhne <GmbH>', 'Straße 1', '12345', 'Frankfurt', 'DE')
          .addVATID('DE123')
          .setEmail('info@example.com')
          .setContact(new Contact('Test', '+49123', 'test@example.com'))
          .addBankDetails(new BankDetails('DE89370400440532013000', 'COBADEFFXXX')),
      )
      .setRecipient(
        new TradeParty('O\'Brien "Associates"', 'Street 2', '54321', 'City', 'DE'),
      )
      .setReferenceNumber('REF-001')
      .setNumber('INV-001')
      .addItem(
        new Item(
          new Product('Produkt "Spezial" & Extra', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Special chars should be XML-encoded
    expect(theXML).toContain('Müller &amp; Söhne &lt;GmbH&gt;');
    expect(theXML).toContain('O&apos;Brien &quot;Associates&quot;');
    expect(theXML).toContain('Produkt &quot;Spezial&quot; &amp; Extra');

    // Should still be valid XML (parseable)
    const doc = new DOMParser().parseFromString(theXML, 'text/xml');
    expect(doc).not.toBeNull();

    // Re-import should decode correctly
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new Invoice();
    zii.extractInto(ci);
    expect(ci.getSender()!.getName()).toBe('Müller & Söhne <GmbH>');
    expect(ci.getRecipient()!.getName()).toBe('O\'Brien "Associates"');
  });
});

describe('Multiple Items with Different VAT', () => {
  it('testMultiVATRates', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Standard Rate Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(2),
        ),
      )
      .addItem(
        new Item(
          new Product('Reduced Rate Product', '', 'C62', new Big(7)),
          new Big(50),
          new Big(3),
        ),
      )
      .addItem(
        new Item(
          new Product('Zero Rate Product', '', 'C62', new Big(0))
            .setTaxCategoryCode('Z'),
          new Big(25),
          new Big(1),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(xpathCount(theXML, 'IncludedSupplyChainTradeLineItem')).toBe(3);

    // Verify totals
    const tc = new TransactionCalculator(
      createBasicInvoice()
        .addItem(new Item(new Product('', '', 'C62', new Big(19)), new Big(100), new Big(2)))
        .addItem(new Item(new Product('', '', 'C62', new Big(7)), new Big(50), new Big(3)))
        .addItem(new Item(new Product('', '', 'C62', new Big(0)).setTaxCategoryCode('Z'), new Big(25), new Big(1))),
    );
    // 200 * 1.19 + 150 * 1.07 + 25 * 1.0 = 238 + 160.50 + 25 = 423.50
    expect(tc.getGrandTotal().toNumber()).toBeCloseTo(423.50, 2);

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);
    expect(ci.getZFItems().length).toBe(3);
  });
});

describe('Document-level Charges and Allowances', () => {
  it('testDocLevelChargeAllowanceRoundtrip', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Product', '', 'C62', new Big(19)),
          new Big(200),
          new Big(1),
        ),
      )
      .addCharge(
        new Charge(new Big(10))
          .setReason('Shipping')
          .setTaxPercent(new Big(19)),
      )
      .addAllowance(
        new Allowance(new Big(20))
          .setReason('Loyalty discount')
          .setTaxPercent(new Big(19)),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Tax basis = 200 + 10 - 20 = 190
    // VAT = 190 * 0.19 = 36.10
    // Grand total = 226.10
    expect(parseFloat(xpathValue(theXML, 'DuePayableAmount'))).toBeCloseTo(226.10, 2);

    // Should contain charge and allowance elements
    expect(theXML).toContain('<ram:Reason>Shipping</ram:Reason>');
    expect(theXML).toContain('<ram:Reason>Loyalty discount</ram:Reason>');

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new Invoice();
    zii.extractInto(ci);

    expect(ci.getZFCharges()!.length).toBe(1);
    expect(ci.getZFAllowances()!.length).toBe(1);
  });
});

describe('Prepaid Amount', () => {
  it('testPrepaidAmountExport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      )
      .setTotalPrepaidAmount(new Big(50));

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Grand total = 119, due payable = 119 - 50 = 69
    expect(parseFloat(xpathValue(theXML, 'GrandTotalAmount'))).toBe(119);
    expect(parseFloat(xpathValue(theXML, 'DuePayableAmount'))).toBe(69);
    expect(theXML).toContain('<ram:TotalPrepaidAmount>50.00</ram:TotalPrepaidAmount>');
  });
});

describe('Delivery Address', () => {
  it('testDeliveryAddressExport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      )
      .setDeliveryAddress(
        new TradeParty('Warehouse', 'Lagerstr. 5', '10115', 'Hamburg', 'DE'),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<ram:ShipToTradeParty>');
    expect(theXML).toContain('<ram:CityName>Hamburg</ram:CityName>');
    // ShipTo should NOT have tax registration
    const doc = new DOMParser().parseFromString(theXML, 'text/xml');
    const shipToTaxReg = xpath.select(
      "//*[local-name()='ShipToTradeParty']//*[local-name()='SpecifiedTaxRegistration']",
      doc,
    );
    expect((shipToTaxReg as Node[]).length).toBe(0);
  });
});

describe('Contract and Order References', () => {
  it('testReferencesExportImport', () => {
    const i = createBasicInvoice()
      .addItem(
        new Item(
          new Product('Product', '', 'C62', new Big(19)),
          new Big(100),
          new Big(1),
        ),
      )
      .setBuyerOrderReferencedDocumentID('PO-2024-001')
      .setSellerOrderReferencedDocumentID('SO-2024-001')
      .setContractReferencedDocument('CONTRACT-2024')
      .setInvoiceReferencedDocumentID('INV-PREV-001');

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('PO-2024-001');
    expect(theXML).toContain('SO-2024-001');
    expect(theXML).toContain('CONTRACT-2024');
    expect(theXML).toContain('INV-PREV-001');

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new Invoice();
    zii.extractInto(ci);

    expect(ci.getBuyerOrderReferencedDocumentID()).toBe('PO-2024-001');
    expect(ci.getSellerOrderReferencedDocumentID()).toBe('SO-2024-001');
  });
});
