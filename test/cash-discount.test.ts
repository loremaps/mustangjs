import { describe, it, expect } from 'vitest';
import { Big } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { Contact } from '../src/model/contact.js';
import { BankDetails } from '../src/model/bank-details.js';
import { CashDiscount } from '../src/model/cash-discount.js';
import { PaymentTerms } from '../src/model/payment-terms.js';
import { PaymentDiscountTerms } from '../src/model/payment-discount-terms.js';
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { TransactionCalculator } from '../src/calc/transaction-calculator.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { Profiles } from '../src/constants/profiles.js';
import { readFixture } from './helpers/test-utils.js';

function createValidInvoice(currency = 'EUR'): Invoice {
  return new Invoice()
    .setNumber('CD-001')
    .setIssueDate(new Date(2024, 0, 1))
    .setDueDate(new Date(2024, 0, 15))
    .setDeliveryDate(new Date(2024, 0, 1))
    .setCurrency(currency)
    .setSender(
      new TradeParty('Seller GmbH', 'Sellerstr. 1', '12345', 'Berlin', 'DE')
        .addTaxID('DE111')
        .addVATID('DE222')
        .setContact(new Contact('Max Seller', '+4930123456', 'max@seller.de'))
        .addBankDetails(new BankDetails('DE89370400440532013000', 'COBADEFFXXX')),
    )
    .setRecipient(new TradeParty('Buyer AG', 'Buyerstr. 2', '54321', 'Munich', 'DE'))
    .setReferenceNumber('REF-001')
    .addItem(new Item(new Product('Test Product', '', 'C62', new Big(19)), new Big(100), new Big(1)));
}

function exportXML(invoice: Invoice, profile: string): string {
  const provider = new ZUGFeRD2PullProvider();
  provider.setProfile(Profiles.getByName(profile));
  provider.generateXML(invoice);
  return provider.getXML();
}

describe('CashDiscount (Skonto)', () => {
  it('renders structured discount terms in the EXTENDED profile and round-trips', () => {
    const invoice = createValidInvoice().addCashDiscount(
      new CashDiscount(new Big(2), 14),
    );

    const theXML = exportXML(invoice, 'Extended');

    // Default description and structured discount terms (percent → 3 decimals).
    expect(theXML).toContain('<ram:Description>Cash Discount</ram:Description>');
    expect(theXML).toContain('<ram:ApplicableTradePaymentDiscountTerms>');
    expect(theXML).toContain('<ram:BasisPeriodMeasure unitCode="DAY">14</ram:BasisPeriodMeasure>');
    expect(theXML).toContain('<ram:CalculationPercent>2.000</ram:CalculationPercent>');

    // Round-trip: re-import recovers percent and days.
    const ci = new CalculatedInvoice();
    new ZUGFeRDInvoiceImporter(theXML).extractInto(ci);
    const discounts = ci.getCashDiscounts();
    expect(discounts).not.toBeNull();
    expect(discounts!.length).toBe(1);
    expect(discounts![0].getPercent()!.eq(new Big(2))).toBe(true);
    expect(discounts![0].getDays()).toBe(14);
  });

  it('emits the optional basis amount when set', () => {
    const invoice = createValidInvoice().addCashDiscount(
      new CashDiscount(new Big(2), 14).setBasisAmount(new Big('529.87')),
    );

    const theXML = exportXML(invoice, 'Extended');
    expect(theXML).toContain('<ram:BasisAmount>529.87</ram:BasisAmount>');
  });

  it('renders the proprietary #SKONTO# free-text in the XRechnung profile and round-trips', () => {
    const invoice = createValidInvoice()
      .addCashDiscount(new CashDiscount(new Big(2), 7))
      .addCashDiscount(new CashDiscount(new Big(3), 14));

    const theXML = exportXML(invoice, 'XRechnung');

    expect(theXML).toContain('#SKONTO#');
    expect(theXML).toContain('#SKONTO#TAGE=7#PROZENT=2.00#');
    expect(theXML).toContain('#SKONTO#TAGE=14#PROZENT=3.00#');
    // No structured discount terms in the XRechnung profile.
    expect(theXML).not.toContain('<ram:ApplicableTradePaymentDiscountTerms>');

    const ci = new CalculatedInvoice();
    new ZUGFeRDInvoiceImporter(theXML).extractInto(ci);
    expect(ci.getCashDiscounts()!.length).toBe(2);
  });

  it('does not emit cash discounts in non-supporting profiles (EN16931)', () => {
    const invoice = createValidInvoice().addCashDiscount(
      new CashDiscount(new Big(2), 14),
    );
    const theXML = exportXML(invoice, 'EN16931');
    expect(theXML).not.toContain('Cash Discount');
    expect(theXML).not.toContain('#SKONTO#');
  });

  // Mirrors upstream CashDiscountFacturXTest.testCashDiscount: a discount block
  // with BasisAmount + CalculationPercent but no BasisPeriodMeasure; days are
  // derived from DueDateDateTime minus the issue date (20260215 - 20260201 = 14).
  it('imports percent from a Factur-X block and derives days from the due date', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>CD-FX</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260201</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Bis zum 15.02.2026 erhalten Sie 4,000 % Skonto, 21.19 EUR</ram:Description>
        <ram:DueDateDateTime><udt:DateTimeString format="102">20260215</udt:DateTimeString></ram:DueDateDateTime>
        <ram:ApplicableTradePaymentDiscountTerms>
          <ram:BasisAmount>529.8700</ram:BasisAmount>
          <ram:CalculationPercent>4.00</ram:CalculationPercent>
          <ram:ActualDiscountAmount>21.19</ram:ActualDiscountAmount>
        </ram:ApplicableTradePaymentDiscountTerms>
      </ram:SpecifiedTradePaymentTerms>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

    const invoice = new ZUGFeRDInvoiceImporter(xml).extractInto(new Invoice());
    const discounts = invoice.getCashDiscounts();
    expect(discounts).not.toBeNull();
    expect(discounts![0].getPercent()!.eq(new Big('4.00'))).toBe(true);
    expect(discounts![0].getDays()).toBe(14);
  });

  // Mirrors upstream ZF2ZInvoiceImporterTest.testSpecifiedLogisticsChargeCashDiscountImport.
  it('imports two structured cash discounts from a real Extended fixture', () => {
    const xml = readFixture('extended_warenrechnung_based_doublecashdiscount.xml');
    const invoice = new ZUGFeRDInvoiceImporter(xml).extractInto(new CalculatedInvoice());

    const discounts = invoice.getCashDiscounts();
    expect(discounts).not.toBeNull();
    expect(discounts!.length).toBe(2);
    expect(discounts!.map((d) => d.getDays())).toEqual([14, 7]);
    expect(discounts![0].getPercent()!.eq(new Big(2))).toBe(true);
    expect(discounts![1].getPercent()!.eq(new Big(1))).toBe(true);
  });

  it('deserializes cash discounts from JSON', () => {
    const invoice = Invoice.fromJSON({
      number: 'CD-JSON',
      cashDiscounts: [{ percent: 2, days: 14 }],
    });
    const discounts = invoice.getCashDiscounts();
    expect(discounts).not.toBeNull();
    expect(discounts![0].getPercent()!.eq(new Big(2))).toBe(true);
    expect(discounts![0].getDays()).toBe(14);
  });
});

// Mirrors upstream ZF2EdgeTest structured-payment-terms export (minus the
// DirectDebit settlement, which mustangjs does not model).
describe('Structured PaymentTerms / PaymentDiscountTerms', () => {
  it('renders ApplicableTradePaymentDiscountTerms with the invoice currency', () => {
    const invoice = createValidInvoice('USD').setPaymentTerms(
      new PaymentTerms(
        '14 Tage 2% Skonto, 30 Tage rein netto',
        new Date(2022, 1, 28),
        new PaymentDiscountTerms(new Big(2), null, 14, 'DAYS'),
      ),
    );

    const theXML = exportXML(invoice, 'Extended');

    expect(theXML).toContain('<ram:ApplicableTradePaymentDiscountTerms>');
    expect(theXML).toContain('<ram:BasisAmount currencyID="USD">');
    expect(theXML).toContain('<ram:CalculationPercent>2</ram:CalculationPercent>');
    expect(theXML).toContain('<ram:DueDateDateTime>');
    expect(theXML).toContain('14 Tage 2% Skonto, 30 Tage rein netto');
    // baseDate was null, so no relative period is emitted.
    expect(theXML).not.toContain('<ram:BasisPeriodMeasure');
    expect(theXML).not.toContain('EUR');
  });

  it('emits BasisDateTime + BasisPeriodMeasure for relative (base-date) discount terms', () => {
    const invoice = createValidInvoice().setPaymentTerms(
      new PaymentTerms(
        'Skonto',
        null,
        new PaymentDiscountTerms(new Big(3), new Date(2024, 0, 1), 14, 'DAYS'),
      ),
    );

    const theXML = exportXML(invoice, 'Extended');
    expect(theXML).toContain('<ram:BasisDateTime>');
    expect(theXML).toContain('<ram:BasisPeriodMeasure unitCode="DAYS">14</ram:BasisPeriodMeasure>');
  });

  it('throws when both a due date and a discount base date are specified', () => {
    const invoice = createValidInvoice().setPaymentTerms(
      new PaymentTerms(
        'invalid',
        new Date(2024, 0, 15),
        new PaymentDiscountTerms(new Big(2), new Date(2024, 0, 1), 14, 'DAYS'),
      ),
    );
    expect(() => exportXML(invoice, 'Extended')).toThrow();
  });

  it('keeps the discount terms available for the grand-total basis amount', () => {
    const invoice = createValidInvoice('USD').setPaymentTerms(
      new PaymentTerms(
        'Skonto',
        new Date(2024, 0, 15),
        new PaymentDiscountTerms(new Big(2), null, 14, 'DAYS'),
      ),
    );
    const grandTotal = new TransactionCalculator(invoice).getGrandTotal();
    const theXML = exportXML(invoice, 'Extended');
    expect(theXML).toContain(
      `<ram:BasisAmount currencyID="USD">${grandTotal.toFixed(2)}</ram:BasisAmount>`,
    );
  });
});
