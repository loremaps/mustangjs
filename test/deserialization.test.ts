import { describe, it, expect } from 'vitest';
import { Big } from '../src/decimal.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { Invoice } from '../src/model/invoice.js';
import { TransactionCalculator } from '../src/calc/transaction-calculator.js';
import { Product } from '../src/model/product.js';
import { readFixture } from './helpers/test-utils.js';

describe('DeSerializationTest', () => {
  it('testProduct', () => {
    const xml = readFixture('Extended_fremdwaehrung.xml');
    const zii = new ZUGFeRDInvoiceImporter(xml);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    const product = ci.getZFItems()[0].getProduct() as Product;
    expect(product.getCountryOfOrigin()).toBe('DE');
    expect(product.getSellerAssignedID()).toBe('CO-123/V2A');
    expect(product.getBuyerAssignedID()).toBe('Toolbox 0815');
    expect(product.getName()).toBe('Stahlcoil');
    expect(product.getAttributes()).not.toBeNull();
    expect(product.getAttributes()!.get('LeoID')).toBe(
      '704310.0105636504',
    );
  });

  it('testInvoiceImport', () => {
    const xml = readFixture('Extended_fremdwaehrung.xml');
    const zii = new ZUGFeRDInvoiceImporter(xml);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    expect(ci.getNumber()).toBe('47110815');
    expect(ci.getCurrency()).toBe('GBP');
    expect(ci.getDocumentCode()).toBe('380');
    expect(ci.getDocumentName()).toBe('RECHNUNG');

    // Seller
    const sender = ci.getSender()!;
    expect(sender.getName()).toBe('Rohstoff AG Salzgitter');
    expect(sender.getCountry()).toBe('DE');
    expect(sender.getVATID()).toBe('DE123456789');

    // Buyer
    const recipient = ci.getRecipient()!;
    expect(recipient.getName()).toBe('Metallbau Leipzig GmbH & Co. KG');

    // Line items
    expect(ci.getZFItems().length).toBe(1);
    const item = ci.getZFItems()[0];
    expect(item.getPrice().toString()).toBe('100');
    expect(item.getQuantity().toString()).toBe('10');

    // Document-level charges and allowances
    expect(ci.getZFCharges()!.length).toBe(1);
    expect(ci.getZFAllowances()!.length).toBe(1);

    // Calculated amounts
    expect(ci.getLineTotalAmount().toString()).toBe('850');
    expect(ci.getGrandTotal().toString()).toBe('1021.91');
    expect(ci.getDuePayable().toString()).toBe('521.91');

    // TransactionCalculator recalculation
    const tc = new TransactionCalculator(ci);
    expect(tc.getDuePayable().toString()).toBe('521.91');
  });

  it('testItemAllowances', () => {
    const json = {"number":"123","currency":"EUR","issueDate":1738935176399,"dueDate":1738935176399,"sender":{"name":"Test company","zip":"55232","street":"teststr","location":"teststadt","country":"DE","taxID":"4711","vatID":"DE0815"},"recipient":{"name":"Franz Müller","zip":"55232","street":"teststr.12","location":"Entenhausen","country":"DE"},"zfitems":[{"price":3.00,"quantity":1,"basisQuantity":1,"product":{"unit":"C62","name":"Testprodukt","taxCategoryCode":"S","vatpercent":19,"reverseCharge":false,"intraCommunitySupply":false},"itemAllowances":[{"totalAmount":0.1,"categoryCode":"S"}],"value":3.00},{"price":3.00,"quantity":1,"basisQuantity":1,"product":{"unit":"C62","name":"Testprodukt","taxCategoryCode":"S","vatpercent":19,"reverseCharge":false,"intraCommunitySupply":false},"itemAllowances":[{"percent":50,"taxPercent":0,"categoryCode":"S"}],"value":3.00},{"price":3.00,"quantity":2,"basisQuantity":1,"product":{"unit":"C62","name":"Testprodukt","taxCategoryCode":"S","vatpercent":19,"reverseCharge":false,"intraCommunitySupply":false},"itemCharges":[{"totalAmount":1,"reason":"AnotherReason","reasonCode":"ABK","categoryCode":"S"}],"value":3.00},{"price":3.00,"quantity":1,"basisQuantity":1,"product":{"unit":"C62","name":"Testprodukt","taxCategoryCode":"S","vatpercent":19,"reverseCharge":false,"intraCommunitySupply":false},"itemAllowances":[{"totalAmount":1,"categoryCode":"S"}],"itemCharges":[{"totalAmount":1,"categoryCode":"S"}],"value":3.00}],"zfcharges":[{"totalAmount":1,"taxPercent":19,"reason":"AReason","reasonCode":"ABK","categoryCode":"S"}]};
    const invoice = Invoice.fromJSON(json);
    const tc = new TransactionCalculator(invoice);
    expect(tc.getGrandTotal().toString()).toBe('18.33');
  });

  it('testItemAbsoluteChargeFromJSON', () => {
    const json = {"number":"471102","currency":"EUR","issueDate":"2018-03-04T00:00:00.000+01:00","dueDate":"2018-03-04T00:00:00.000+01:00","deliveryDate":"2018-03-04T00:00:00.000+01:00","sender":{"name":"Lieferant GmbH","zip":"80333","street":"Lieferantenstraße 20","location":"München","country":"DE","taxID":"201/113/40209","vatID":"DE123456789","globalID":"4000001123452","globalIDScheme":"0088"},"recipient":{"name":"Kunden AG Mitte","zip":"69876","street":"Kundenstraße 15","location":"Frankfurt","country":"DE"},"zfitems":[{"price":9.9,"quantity":20,"product":{"unit":"H87","name":"Trennblätter A4","description":"","vatpercent":19,"taxCategoryCode":"S"},"itemCharges":[{"totalAmount":1,"taxPercent":19,"reason":"Invoice line charge reason","categoryCode":"S"}]},{"price":5.5,"quantity":50,"product":{"unit":"H87","name":"Joghurt Banane","description":"","vatpercent":7,"taxCategoryCode":"S"}}]};

    const fromJSON = Invoice.fromJSON(json);
    expect(fromJSON.getSender()!.getGlobalID()).toBe('4000001123452');
    expect(fromJSON.getSender()!.getGlobalIDScheme()).toBe('0088');
    const tc = new TransactionCalculator(fromJSON);
    expect(tc.getDuePayable().toString()).toBe('531.06');
  });

  it('testGrossFromJSON', () => {
    const json = {"documentCode":"380","number":"123","currency":"EUR","paymentTermDescription":"Please remit until 28.07.2025","issueDate":1753653600000,"dueDate":1753653600000,"sender":{"name":"Test company","zip":"55232","street":"teststr","location":"teststadt","country":"DE","taxID":"4711","vatID":"DE0815"},"recipient":{"name":"Franz Müller","zip":"55232","street":"teststr.12","location":"Entenhausen","country":"DE"},"totalPrepaidAmount":0.00,"zfitems":[{"price":3.0000,"quantity":10.0000,"basisQuantity":1.0000,"id":"1","product":{"unit":"H87","name":"Testprodukt","taxCategoryCode":"S","allowances":[{"totalAmount":0.1000,"categoryCode":"S"}],"vatpercent":19.00,"intraCommunitySupply":false,"reverseCharge":false},"value":3.0000}]};

    const fromJSON = CalculatedInvoice.fromJSON(json);
    fromJSON.calculate();
    expect(fromJSON.getDuePayable().toString()).toBe('34.51');
  });
});
