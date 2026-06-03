import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { Big } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
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
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { TransactionCalculator } from '../src/calc/transaction-calculator.js';
import { Profiles } from '../src/constants/profiles.js';
import { TaxCategoryCode } from '../src/constants/tax-category-code.js';

function xpathCount(xmlStr: string, expr: string): number {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const result = xpath.select(`count(//*[local-name()='${expr}'])`, doc);
  return typeof result === 'number' ? result : 0;
}

function xpathValue(xmlStr: string, expr: string): string {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const result = xpath.select(
    `string(//*[local-name()='${expr}'])`,
    doc,
  );
  return typeof result === 'string' ? result : '';
}

function createFXInvoice(recipient: TradeParty): Invoice {
  const amount = new Big('1.00');
  return new Invoice()
    .setDueDate(new Date())
    .setIssueDate(new Date())
    .setDeliveryDate(new Date())
    .setSender(
      new TradeParty('Test company', 'teststr', '55232', 'teststadt', 'DE')
        .addTaxID('DE4711')
        .addVATID('DE0815')
        .setContact(
          new Contact('Hans Test', '+49123456789', 'test@example.org'),
        )
        .addBankDetails(
          new BankDetails('DE12500105170648489890', 'COBADEFXXX'),
        ),
    )
    .setRecipient(recipient)
    .setReferenceNumber('991-01484-64')
    .setNumber('123')
    .addItem(
      new Item(
        new Product('Testprodukt', '', 'C62', new Big(0)),
        amount,
        new Big(1.0),
      ),
    );
}

function createXRInvoice(recipient: TradeParty): Invoice {
  const amount = new Big('1.00');
  return new Invoice()
    .setDueDate(new Date())
    .setIssueDate(new Date())
    .setDeliveryDate(new Date())
    .setSender(
      new TradeParty('Test company', 'teststr', '55232', 'teststadt', 'DE')
        .addTaxID('DE4711')
        .addVATID('DE0815')
        .setEmail('info@example.org')
        .setContact(
          new Contact('Hans Test', '+49123456789', 'test@example.org'),
        )
        .addBankDetails(
          new BankDetails('DE12500105170648489890', 'COBADEFXXX'),
        ),
    )
    .setRecipient(recipient)
    .setReferenceNumber('991-01484-64')
    .setNumber('123')
    .addItem(
      new Item(
        new Product('Testprodukt', '', 'C62', new Big(0)),
        amount,
        new Big(1.0),
      ),
    );
}

describe('FXTest', () => {
  it('testFXExport', () => {
    const recipient = new TradeParty(
      'Franz Müller',
      'teststr.12',
      '55232',
      'Entenhausen',
      'DE',
    );
    recipient.setLegalOrganisation(new LegalOrganisation('0815', '0002'));
    const i = createFXInvoice(recipient);

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<rsm:CrossIndustryInvoice');
    expect(xpathCount(theXML, 'IncludedSupplyChainTradeLineItem')).toBe(1);
    expect(parseFloat(xpathValue(theXML, 'DuePayableAmount'))).toBe(1);
  });
});

describe('XRTest', () => {
  it('testXRExport', () => {
    const recipient = new TradeParty(
      'Franz Müller',
      'teststr.12',
      '55232',
      'Entenhausen',
      'DE',
    );
    const i = createXRInvoice(recipient);
    const sellerID = '549268';
    const legalOrgID = '4711';
    i.getSender()!.setID(sellerID);
    i.getSender()!.setLegalOrganisation(
      new LegalOrganisation(legalOrgID),
    );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('XRechnung'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<rsm:CrossIndustryInvoice');
    expect(theXML).toContain(`<ram:ID>${sellerID}</ram:ID>`);
    expect(theXML).toContain(`<ram:ID>${legalOrgID}</ram:ID>`);
    expect(xpathCount(theXML, 'IncludedSupplyChainTradeLineItem')).toBe(1);
    expect(parseFloat(xpathValue(theXML, 'DuePayableAmount'))).toBe(1);
  });

  it('testXRExportWithoutStreet', () => {
    const recipient = new TradeParty(
      'Franz Müller',
      undefined,
      '55232',
      'Entenhausen',
      'DE',
    );
    const i = createXRInvoice(recipient);

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('XRechnung'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<rsm:CrossIndustryInvoice');
    expect(xpathCount(theXML, 'IncludedSupplyChainTradeLineItem')).toBe(1);
    expect(parseFloat(xpathValue(theXML, 'DuePayableAmount'))).toBe(1);
  });

  it('testTaxExemptionReasonIssue', () => {
    const amount = new Big('1.00');
    const recipient = new TradeParty(
      'Franz Müller',
      'teststr.12',
      '55232',
      'Entenhausen',
      'DE',
    );
    const i = new Invoice()
      .setDueDate(new Date())
      .setIssueDate(new Date())
      .setDeliveryDate(new Date())
      .setSender(
        new TradeParty('Test company', 'teststr', '55232', 'teststadt', 'DE')
          .addTaxID('DE4711')
          .addVATID('DE0815')
          .setEmail('info@example.org')
          .setContact(
            new Contact('Hans Test', '+49123456789', 'test@example.org'),
          )
          .addBankDetails(
            new BankDetails('DE12500105170648489890', 'COBADEFXXX'),
          ),
      )
      .setRecipient(recipient)
      .setReferenceNumber('991-01484-64')
      .setNumber('123')
      .addItem(
        new Item(
          new Product('Testprodukt', '', 'C62', new Big(0))
            .setTaxCategoryCode('E')
            .setTaxExemptionReason('Kleinunternehmer'),
          amount,
          new Big(1.0),
        ),
      )
      .addItem(
        new Item(
          new Product('Testprodukt2', '', 'C62', new Big(0)).setTaxCategoryCode(
            'S',
          ),
          amount,
          new Big(1.0),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('XRechnung'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Exemption reason should appear at line level and at header level
    expect(xpathCount(theXML, 'ExemptionReason')).toBe(2);
  });

  it('testIssue830ApplicableHeaderTradeSettlementTax', () => {
    const i = new Invoice()
      .setDueDate(new Date())
      .setIssueDate(new Date())
      .setDeliveryDate(new Date())
      .setSender(
        new TradeParty('Test', 'teststr', '55232', 'teststadt', 'DE')
          .setEmail('sender@example.com')
          .addTaxID('DE4711')
          .addVATID('DE0815')
          .setContact(
            new Contact('Hans Test', '+49123456789', 'test@example.org'),
          )
          .addBankDetails(
            new BankDetails('DE12500105170648489890', 'COBADEFXXX').setAccountName('kontoInhaber'),
          ),
      )
      .setRecipient(
        new TradeParty(
          'Franz Müller',
          'teststr.12',
          '55232',
          'Entenhausen',
          'DE',
        ).setEmail('recipient@sample.org'),
      )
      .setReferenceNumber('991-01484-64')
      .setNumber('123')
      // Item 1: E (exempt), 0% VAT, price 10, qty 1
      .addItem(
        new Item(
          new Product('Testprodukt1', '', 'C62', new Big(0))
            .setTaxCategoryCode('E')
            .setTaxExemptionReason('Product is exempt'),
          new Big(10),
          new Big(1),
        ),
      )
      // Item 2: AE (reverse charge), 0% VAT, price 1, qty 1
      .addItem(
        new Item(
          new Product('Testprodukt2', '', 'C62', new Big(0))
            .setTaxCategoryCode('AE')
            .setTaxExemptionReason('Reversecharge process'),
          new Big(1),
          new Big(1),
        ),
      )
      // Item 3: S (standard), 19% VAT, price 9, qty 1; with a line-level charge
      .addItem(
        new Item(
          new Product('Testprodukt3', '', 'C62', new Big(19)).setTaxCategoryCode(
            'S',
          ),
          new Big(9),
          new Big(1),
        ).addCharge(
          new Charge(new Big(1))
            .setReasonCode('64')
            .setTaxPercent(new Big(19)),
        ),
      )
      // Item 4: AE (reverse charge), 0% VAT, price 10, qty 1; with a line-level allowance
      .addItem(
        new Item(
          new Product('Testprodukt4', '', 'C62', new Big(0))
            .setTaxCategoryCode('AE')
            .setTaxExemptionReason('Reversecharge process'),
          new Big(10),
          new Big(1),
        ).addAllowance(
          new Allowance()
            .setReasonCode('64')
            .setTotalAmount(new Big(4))
            .setTaxPercent(new Big(0)),
        ),
      )
      // Document-level allowance: 5 at 19% S
      .addAllowance(
        new Allowance()
          .setReasonCode('64')
          .setTotalAmount(new Big(5))
          .setTaxPercent(new Big(19)),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('XRechnung'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Parse with DOM + XPath to check tax buckets
    const doc = new DOMParser().parseFromString(theXML, 'text/xml');

    // Get ApplicableTradeTax nodes under ApplicableHeaderTradeSettlement
    const taxNodes = xpath.select(
      "//*[local-name()='ApplicableHeaderTradeSettlement']/*[local-name()='ApplicableTradeTax']",
      doc,
    ) as Node[];
    expect(taxNodes.length).toBe(3);

    // Check each tax bucket
    const catCodes: string[] = [];
    const basisAmounts: string[] = [];
    for (const node of taxNodes) {
      const cat = xpath.select(
        "string(./*[local-name()='CategoryCode'])",
        node,
      ) as string;
      const basis = xpath.select(
        "string(./*[local-name()='BasisAmount'])",
        node,
      ) as string;
      catCodes.push(cat);
      basisAmounts.push(basis);
    }

    // E: 10, AE: 7 (1 + 10 - 4), S: 5 (9 + 1 charge - 5 allowance)
    expect(catCodes).toContain('E');
    expect(catCodes).toContain('AE');
    expect(catCodes).toContain('S');

    const eIdx = catCodes.indexOf('E');
    const aeIdx = catCodes.indexOf('AE');
    const sIdx = catCodes.indexOf('S');
    expect(parseFloat(basisAmounts[eIdx])).toBe(10);
    expect(parseFloat(basisAmounts[aeIdx])).toBe(7);
    expect(parseFloat(basisAmounts[sIdx])).toBe(5);
  });

  it('testApplicablePercentInUntaxedService', () => {
    const amount = new Big('1.00');
    const recipient = new TradeParty(
      'Franz Müller',
      'teststr.12',
      '55232',
      'Entenhausen',
      'DE',
    );
    const i = new Invoice()
      .setDueDate(new Date())
      .setIssueDate(new Date())
      .setDeliveryDate(new Date())
      .setSender(
        new TradeParty('Test company', 'teststr', '55232', 'teststadt', 'DE')
          .addTaxID('DE4711')
          .addVATID('DE0815')
          .setEmail('info@example.org')
          .setContact(
            new Contact('Hans Test', '+49123456789', 'test@example.org'),
          )
          .addBankDetails(
            new BankDetails('DE12500105170648489890', 'COBADEFXXX'),
          ),
      )
      .setRecipient(recipient)
      .setReferenceNumber('991-01484-64')
      .setNumber('123')
      .addItem(
        new Item(
          new Product('Testprodukt', '', 'C62', new Big(0))
            .setTaxCategoryCode(TaxCategoryCode.UNTAXEDSERVICE)
            .setTaxExemptionReason('Exemption reason'),
          amount,
          new Big(1.0),
        ),
      );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('XRechnung'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();
    const doc = new DOMParser().parseFromString(theXML, 'text/xml');

    // No RateApplicablePercent at line level for untaxed service
    const lineRateCount = xpath.select(
      "count(//*[local-name()='SpecifiedLineTradeSettlement']/*[local-name()='ApplicableTradeTax']/*[local-name()='RateApplicablePercent'])",
      doc,
    );
    expect(lineRateCount).toBe(0);

    // One RateApplicablePercent at header level
    const headerRateCount = xpath.select(
      "count(//*[local-name()='ApplicableHeaderTradeSettlement']/*[local-name()='ApplicableTradeTax']/*[local-name()='RateApplicablePercent'])",
      doc,
    );
    expect(headerRateCount).toBe(1);

    // ExemptionReason appears at line + header
    expect(xpathCount(theXML, 'ExemptionReason')).toBe(2);
  });
});

describe('Export roundtrip', () => {
  it('testExportImportRoundtrip', () => {
    const i = createFXInvoice(
      new TradeParty('Franz Müller', 'teststr.12', '55232', 'Entenhausen', 'DE'),
    );

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    // Re-import
    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    expect(ci.getNumber()).toBe('123');
    expect(ci.getSender()!.getName()).toBe('Test company');
    expect(ci.getRecipient()!.getName()).toBe('Franz Müller');
    expect(ci.getZFItems().length).toBe(1);

    const tc = new TransactionCalculator(ci);
    expect(tc.getDuePayable().toString()).toBe('1');
  });
});

describe('DeliveryTypeCode (CII Extended)', () => {
  function makeInvoice(): Invoice {
    return createFXInvoice(
      new TradeParty('Franz Müller', 'teststr.12', '55232', 'Entenhausen', 'DE'),
    ).setDeliveryTypeCode('EXW');
  }

  it('exports DeliveryTypeCode in EXTENDED profile and round-trips on import', () => {
    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EXTENDED'));
    zf2p.generateXML(makeInvoice());
    const theXML = zf2p.getXML();

    expect(theXML).toContain('<ram:DeliveryTypeCode>EXW</ram:DeliveryTypeCode>');
    expect(xpathValue(theXML, 'DeliveryTypeCode')).toBe('EXW');

    const zii = new ZUGFeRDInvoiceImporter(theXML);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);
    expect(ci.getDeliveryTypeCode()).toBe('EXW');
  });

  it('omits DeliveryTypeCode outside the EXTENDED profile', () => {
    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('EN16931'));
    zf2p.generateXML(makeInvoice());
    const theXML = zf2p.getXML();

    expect(xpathCount(theXML, 'DeliveryTypeCode')).toBe(0);
    expect(xpathCount(theXML, 'ApplicableTradeDeliveryTerms')).toBe(0);
  });
});

describe('Item allowance/charge BasisAmount (BT-137/142)', () => {
  function btSender(): TradeParty {
    return new TradeParty(
      'Sender GmbH',
      'Hauptstr. 1',
      '10115',
      'Berlin',
      'DE',
    ).addVATID('DE123456789');
  }
  function btRecipient(): TradeParty {
    return new TradeParty(
      'Recipient GmbH',
      'Nebenstr. 2',
      '10116',
      'Berlin',
      'DE',
    ).addVATID('DE987654321');
  }
  function xpathString(xmlStr: string, expr: string): string {
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
    const result = xpath.select(`string(${expr})`, doc);
    return typeof result === 'string' ? result : '';
  }

  it('testLineLevelAllowanceBasisAmountIsLineSubtotal', () => {
    // BT-137: price=128.49 per 100, qty=50, basisQty=100, 10% item allowance, Extended.
    // line subtotal = (128.49/100)*50 = 64.245 -> 64.25; ActualAmount = 6.4245 -> 6.42
    const product = new Product('Testartikel', '', 'LTR', new Big(0));
    const item = new Item(product, new Big('128.49'), new Big('50'));
    item.setBasisQuantity(new Big('100'));
    item.addAllowance(new Allowance().setPercent(new Big(10)).setTaxPercent(new Big(0)));

    const i = new Invoice()
      .setNumber('BT137-ALLOWANCE')
      .setIssueDate(new Date())
      .setDueDate(new Date())
      .setSender(btSender())
      .setRecipient(btRecipient())
      .addItem(item);

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('Extended'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    const allowance =
      "//*[local-name()='SpecifiedTradeAllowanceCharge'][*[local-name()='ChargeIndicator']/*[local-name()='Indicator']='false']";
    expect(xpathString(theXML, `${allowance}/*[local-name()='BasisAmount']`)).toBe('64.25');
    expect(xpathString(theXML, `${allowance}/*[local-name()='ActualAmount']`)).toBe('6.42');
  });

  it('testLineLevelChargeBasisAmountIsLineSubtotal', () => {
    // BT-142: price=200 per 4, qty=10, basisQty=4, 5% item charge, Extended.
    // line subtotal = (200/4)*10 = 500.00; ActualAmount = 25.00
    const product = new Product('Testartikel', '', 'H87', new Big(0));
    const item = new Item(product, new Big('200.00'), new Big('10'));
    item.setBasisQuantity(new Big('4'));
    item.addCharge(new Charge().setPercent(new Big(5)).setTaxPercent(new Big(0)));

    const i = new Invoice()
      .setNumber('BT142-CHARGE')
      .setIssueDate(new Date())
      .setDueDate(new Date())
      .setSender(btSender())
      .setRecipient(btRecipient())
      .addItem(item);

    const zf2p = new ZUGFeRD2PullProvider();
    zf2p.setProfile(Profiles.getByName('Extended'));
    zf2p.generateXML(i);
    const theXML = zf2p.getXML();

    const charge =
      "//*[local-name()='SpecifiedTradeAllowanceCharge'][*[local-name()='ChargeIndicator']/*[local-name()='Indicator']='true']";
    expect(xpathString(theXML, `${charge}/*[local-name()='BasisAmount']`)).toBe('500.00');
    expect(xpathString(theXML, `${charge}/*[local-name()='ActualAmount']`)).toBe('25.00');
  });
});
