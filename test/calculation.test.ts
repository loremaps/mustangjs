import { describe, it, expect } from 'vitest';
import { Big, ZERO, ONE, TEN } from '../src/decimal.js';
import { ExportableProductImpl } from './helpers/exportable-product-impl.js';
import { ExportableItemImpl } from './helpers/exportable-item-impl.js';
import { AllowanceChargeImpl } from './helpers/allowance-charge-impl.js';
import { LineCalculator } from '../src/calc/line-calculator.js';
import { TransactionCalculator } from '../src/calc/transaction-calculator.js';
import { Invoice } from '../src/model/invoice.js';
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { TradeParty } from '../src/model/trade-party.js';
import { Product } from '../src/model/product.js';
import { Item } from '../src/model/item.js';
import { Charge } from '../src/model/charge.js';
import { Allowance } from '../src/model/allowance.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { readFixture } from './helpers/test-utils.js';

/** Helper: compare Big values after stripping trailing zeros */
function assertDecimalEquals(expected: number | string, actual: Big) {
  const exp = new Big(expected);
  expect(actual.toString()).toBe(
    exp.toString(),
  );
}

describe('CalculationTest', () => {
  it('testLineCalculator_simpleAmounts_resultInValidVATAmount', () => {
    const product = new ExportableProductImpl().setVatPercent(new Big(16));
    const currentItem = new ExportableItemImpl()
      .setPrice(new Big(100))
      .setQuantity(TEN)
      .setProduct(product);

    const calculator = currentItem.getCalculation();

    assertDecimalEquals(100, calculator.getPrice());
    assertDecimalEquals(1000, calculator.getItemTotalNetAmount());
    assertDecimalEquals(160, calculator.getItemTotalVATAmount());
  });

  it('testLineCalculatorInclusiveAllowance', () => {
    const product = new ExportableProductImpl().setVatPercent(new Big(16));
    const allowance = new AllowanceChargeImpl().setTotalAmount(new Big(14.873));

    const currentItem = new ExportableItemImpl()
      .setPrice(new Big(148.73))
      .setQuantity(new Big(12))
      .setItemAllowances([allowance])
      .setProduct(product);

    const calculator = currentItem.getCalculation();

    assertDecimalEquals(148.73, calculator.getPrice());
    assertDecimalEquals(1769.89, calculator.getItemTotalNetAmount());
    assertDecimalEquals(283.1824, calculator.getItemTotalVATAmount());
  });

  it('testLineCalculatorInclusiveAllowanceAndCharge', () => {
    const product = new ExportableProductImpl().setVatPercent(new Big(16));
    const allowance = new AllowanceChargeImpl().setTotalAmount(
      new Big(14.873),
    );
    const charge = new AllowanceChargeImpl().setTotalAmount(new Big(29.746));

    const currentItem = new ExportableItemImpl()
      .setPrice(new Big(148.73))
      .setQuantity(new Big(12))
      .setItemAllowances([allowance])
      .setItemCharges([charge])
      .setProduct(product);

    const calculator = currentItem.getCalculation();

    assertDecimalEquals(148.73, calculator.getPrice());
    assertDecimalEquals(1799.63, calculator.getItemTotalNetAmount());
    assertDecimalEquals(287.9408, calculator.getItemTotalVATAmount());
  });

  it('testAllowanceAndChargeEx4', () => {
    const invoice = new Invoice();
    invoice.setDocumentName('Rechnung');
    invoice.setNumber('777777');
    invoice.setIssueDate(new Date('2020-12-31'));

    const sender = new TradeParty(
      'Maier GmbH',
      'Musterweg 5',
      '11111',
      'Testung',
      'DE',
    );
    sender.addVATID('DE2222222222');
    invoice.setSender(sender);

    const recipient = new TradeParty(
      'Teston GmbH Zentrale ',
      'Testweg 5',
      '11111',
      'Testung',
      'DE',
    );
    invoice.setRecipient(recipient);

    // Item 1: Pens
    let product = new Product('Pens', '', 'H87', new Big(25));
    product.addAllowance(new Allowance(new Big(1)));
    let item = new Item(product, new Big('9.50'), new Big(25));
    item.addCharge(
      new Charge(new Big(10)).setReasonCode('ZZZ').setReason('Zuschlag'),
    );
    let lc = item.getCalculation();
    assertDecimalEquals('222.50', lc.getItemTotalNetAmount());
    invoice.addItem(item);

    // Item 2: Paper
    product = new Product('Paper', '', 'H87', new Big(25));
    item = new Item(product, new Big('4.50'), new Big(15));
    item.addAllowance(
      new Allowance()
        .setPercent(new Big(5))
        .setReasonCode('ZZZ')
        .setReason('Zuschlag'),
    );
    lc = item.getCalculation();
    assertDecimalEquals('64.12', lc.getItemTotalNetAmount());
    invoice.addItem(item);

    // Document-level allowance and charge
    invoice.addAllowance(
      new Allowance()
        .setPercent(new Big(10))
        .setTaxPercent(new Big(25))
        .setReasonCode('ZZZ')
        .setReason('Mengenrabatt'),
    );
    invoice.addCharge(
      new Charge(new Big(15)).setReasonCode('ZZZ').setReason('Frachtkosten'),
    );

    const calculator = new TransactionCalculator(invoice);
    assertDecimalEquals(286.62, calculator.getTotal());
    assertDecimalEquals(272.96, calculator.getTaxBasis());
    assertDecimalEquals(337.45, calculator.getDuePayable());
  });

  it('testTotalCalculatorGrandTotalRounding', () => {
    const salesTaxPercent1 = new Big(16);
    const totalIncreasePercent = new Big(0.8);
    const totalDiscountPercent = new Big(2.0);

    const invoice = new Invoice();
    invoice.setDocumentName('Rechnung');
    invoice.setNumber('777777');
    invoice.setIssueDate(new Date('2020-12-31'));
    invoice.setDetailedDeliveryPeriod(
      new Date('2020-12-01'),
      new Date('2020-12-31'),
    );
    invoice.setDeliveryDate(new Date('2020-12-31'));
    invoice.setDueDate(new Date('2021-01-15'));

    const sender = new TradeParty(
      'Maier GmbH',
      'Musterweg 5',
      '11111',
      'Testung',
      'DE',
    );
    sender.addVATID('DE2222222222');
    invoice.setSender(sender);

    const recipient = new TradeParty(
      'Teston GmbH Zentrale ',
      'Testweg 5',
      '11111',
      'Testung',
      'DE',
    );
    recipient.setID('111111');
    recipient.addVATID('DE111111111');
    invoice.setRecipient(recipient);

    let product: Product;
    let item: Item;

    // Item AAA with 10% item discount
    product = new Product('AAA', '', 'H87', salesTaxPercent1).setSellerAssignedID('1AAA');
    item = new Item(product, new Big('4.750'), new Big(5.0));
    const itemDiscount = new Big(10.0);
    item.addAllowance(
      new Allowance()
        .setPercent(itemDiscount)
        .setTaxPercent(salesTaxPercent1)
        .setReasonCode('95')
        .setReason('Rabatt'),
    );
    invoice.addItem(item);

    // Item BBB
    product = new Product('BBB', '', 'H87', salesTaxPercent1).setSellerAssignedID('2BBB');
    item = new Item(product, new Big('5.750'), new Big(4.0));
    invoice.addItem(item);

    // Item CCC
    product = new Product('CCC', '', 'H87', salesTaxPercent1).setSellerAssignedID('3CCC');
    item = new Item(product, new Big('6.750'), new Big(3.0));
    invoice.addItem(item);

    // Item DDD
    product = new Product('DDD', '', 'H87', salesTaxPercent1).setSellerAssignedID('4DDD');
    item = new Item(product, new Big('7.750'), new Big(2.0));
    invoice.addItem(item);

    // Item EEE
    product = new Product('EEE', '', 'H87', salesTaxPercent1).setSellerAssignedID('5EEE');
    item = new Item(product, new Big('8.750'), new Big(1.0));
    invoice.addItem(item);

    // Document-level charge and allowance
    invoice.addCharge(
      new Charge()
        .setPercent(totalIncreasePercent)
        .setTaxPercent(salesTaxPercent1)
        .setReasonCode('ZZZ')
        .setReason('Zuschläge'),
    );
    invoice.addAllowance(
      new Allowance()
        .setPercent(totalDiscountPercent)
        .setTaxPercent(salesTaxPercent1)
        .setReasonCode('95')
        .setReason('Rabatte'),
    );

    const calculator = new TransactionCalculator(invoice);
    assertDecimalEquals(101.85, calculator.getGrandTotal());
  });

  it('testNullifyingAllowancesCharges', () => {
    const invoice = new Invoice();
    invoice.setDocumentName('Rechnung');
    invoice.setNumber('777777');
    invoice.setIssueDate(new Date('2020-12-31'));
    invoice.setDetailedDeliveryPeriod(
      new Date('2020-12-01'),
      new Date('2020-12-31'),
    );
    invoice.setDeliveryDate(new Date('2020-12-31'));
    invoice.setDueDate(new Date('2021-01-15'));

    const sender = new TradeParty(
      'Maier GmbH',
      'Musterweg 5',
      '11111',
      'Testung',
      'DE',
    );
    sender.addVATID('DE2222222222');
    invoice.setSender(sender);

    const recipient = new TradeParty(
      'Teston GmbH Zentrale ',
      'Testweg 5',
      '11111',
      'Testung',
      'DE',
    );
    recipient.setID('111111');
    recipient.addVATID('DE111111111');
    invoice.setRecipient(recipient);

    const amount = new Big('10.00');

    const product = new Product('AAA', '', 'H87', ZERO).setSellerAssignedID(
      '1AAA',
    );
    product.addCharge(
      new Charge(amount).setReasonCode('ZZZ').setReason('Zuschlag'),
    );
    product.addAllowance(
      new Allowance(amount).setReasonCode('95').setReason('Rabatt'),
    );
    const item = new Item(product, new Big('4.750'), new Big(1.0));
    item.addCharge(
      new Charge(amount).setReasonCode('ZZZ').setReason('Zuschlag'),
    );
    item.addAllowance(
      new Allowance(amount).setReasonCode('95').setReason('Rabatt'),
    );
    invoice.addItem(item);

    const calculator = new TransactionCalculator(invoice);
    assertDecimalEquals(4.75, calculator.getGrandTotal());
  });

  it('testLineCalculatorForeignCurrencyExample', () => {
    const xml = readFixture('Extended_fremdwaehrung.xml');
    const zii = new ZUGFeRDInvoiceImporter(xml);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);
    const tc = new TransactionCalculator(ci);
    assertDecimalEquals('521.91', tc.getDuePayable());
  });

  it('testNonTerminatingDecimalExpansion', () => {
    const product = new Product();
    const currentItem = new Item()
      .setPrice(new Big(386.52))
      .setQuantity(new Big(31))
      .setBasisQuantity(new Big(366))
      .setProduct(product);

    const calculator = currentItem.getCalculation();
    assertDecimalEquals(32.74, calculator.getItemTotalNetAmount());
  });
});
