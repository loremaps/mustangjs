import { describe, it, expect } from 'vitest';
import { readFixture } from './helpers/test-utils.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { Invoice } from '../src/model/invoice.js';
import { CalculatedInvoice } from '../src/model/calculated-invoice.js';
import { TransactionCalculator } from '../src/calc/transaction-calculator.js';
import { SubjectCode } from '../src/constants/subject-code.js';

describe('UBL Import', () => {
  it('testUBLInvoiceImport', () => {
    const xml = readFixture('XRECHNUNG_Einfach.ubl.xml');
    const zii = new ZUGFeRDInvoiceImporter(xml);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    // Document fields
    expect(ci.getNumber()).toBe('471102');
    expect(ci.getDocumentCode()).toBe('380');
    expect(ci.getCurrency()).toBe('EUR');

    // Issue date (2018-03-05)
    const issueDate = ci.getIssueDate()!;
    expect(issueDate.getFullYear()).toBe(2018);
    expect(issueDate.getMonth()).toBe(2); // March
    expect(issueDate.getDate()).toBe(5);

    // Seller
    const seller = ci.getSender()!;
    expect(seller.getName()).toBe('Lieferant GmbH');
    expect(seller.getStreet()).toBe('Lieferantenstraße 20');
    expect(seller.getLocation()).toBe('München');
    expect(seller.getZIP()).toBe('80333');
    expect(seller.getCountry()).toBe('DE');
    expect(seller.getVATID()).toBe('DE123456789');
    expect(seller.getTaxID()).toBe('201/113/40209');

    // Seller contact
    const contact = seller.getContact()!;
    expect(contact.getName()).toBe('Max Mustermann');
    expect(contact.getPhone()).toBe('+49891234567');
    expect(contact.getEmail()).toBe('Max@Mustermann.de');

    // Buyer
    const buyer = ci.getRecipient()!;
    expect(buyer.getName()).toBe('Kunden AG Mitte');
    expect(buyer.getStreet()).toBe('Kundenstraße 15');
    expect(buyer.getLocation()).toBe('Frankfurt');
    expect(buyer.getZIP()).toBe('69876');

    // Buyer reference
    expect(ci.getReferenceNumber()).toBe('04011000-12345-34');

    // Delivery date (2018-03-05)
    const deliveryDate = ci.getDeliveryDate()!;
    expect(deliveryDate.getFullYear()).toBe(2018);
    expect(deliveryDate.getMonth()).toBe(2);
    expect(deliveryDate.getDate()).toBe(5);

    // Items
    expect(ci.getZFItems().length).toBe(2);

    const item1 = ci.getZFItems()[0];
    expect(item1.getProduct()!.getName()).toBe('Trennblätter A4');
    expect(item1.getProduct()!.getSellerAssignedID()).toBe('TB100A4');
    expect(item1.getProduct()!.getTaxCategoryCode()).toBe('S');
    expect(item1.getProduct()!.getVATPercent()!.toNumber()).toBe(19);
    expect(item1.getQuantity().toNumber()).toBe(20);
    expect(item1.getPrice().toNumber()).toBe(9.9);
    expect(item1.getProduct()!.getUnit()).toBe('H87');

    const item2 = ci.getZFItems()[1];
    expect(item2.getProduct()!.getName()).toBe('Joghurt Banane');
    expect(item2.getProduct()!.getSellerAssignedID()).toBe('ARNR2');
    expect(item2.getProduct()!.getVATPercent()!.toNumber()).toBe(7);
    expect(item2.getQuantity().toNumber()).toBe(50);
    expect(item2.getPrice().toNumber()).toBe(5.5);

    // Calculated amounts
    expect(ci.getGrandTotal()!.toNumber()).toBe(529.87);
    expect(ci.getTaxBasis()!.toNumber()).toBe(473);
    expect(ci.getDuePayable()!.toNumber()).toBe(529.87);

    // Payment terms
    expect(ci.getPaymentTermDescription()).toContain('Zahlbar innerhalb 30 Tagen');
  });

  it('testUBLCreditNoteImport', () => {
    const xml = readFixture('ubl-creditnote.xml');
    const zii = new ZUGFeRDInvoiceImporter(xml);
    const ci = new CalculatedInvoice();
    zii.extractInto(ci);

    // Document fields
    expect(ci.getNumber()).toBe('TOSL108');
    expect(ci.getCurrency()).toBe('EUR');

    // Issue date (2009-12-15)
    const issueDate = ci.getIssueDate()!;
    expect(issueDate.getFullYear()).toBe(2009);
    expect(issueDate.getMonth()).toBe(11); // December
    expect(issueDate.getDate()).toBe(15);

    // Seller
    const seller = ci.getSender()!;
    expect(seller.getName()).toBe('Salescompany ltd.');
    expect(seller.getStreet()).toBe('Main street');
    expect(seller.getLocation()).toBe('Big city');
    expect(seller.getZIP()).toBe('54321');
    expect(seller.getCountry()).toBe('DK');
    expect(seller.getVATID()).toBe('DK12345');

    // Seller contact
    const contact = seller.getContact()!;
    expect(contact.getPhone()).toBe('4621230');
    expect(contact.getFax()).toBe('4621231');
    expect(contact.getEmail()).toBe('antonio@salescompany.dk');

    // Buyer
    const buyer = ci.getRecipient()!;
    expect(buyer.getName()).toBe('Buyercompany ltd');
    expect(buyer.getStreet()).toBe('Anystreet');
    expect(buyer.getLocation()).toBe('Anytown');
    expect(buyer.getCountry()).toBe('BE');

    // Order reference
    expect(ci.getBuyerOrderReferencedDocumentID()).toBe('123');

    // Contract reference
    expect(ci.getContractReferencedDocument()).toBe('Contract321');

    // Invoice period
    const periodFrom = ci.getDetailedDeliveryPeriodFrom()!;
    expect(periodFrom.getFullYear()).toBe(2009);
    expect(periodFrom.getMonth()).toBe(10); // November
    expect(periodFrom.getDate()).toBe(1);

    const periodTo = ci.getDetailedDeliveryPeriodTo()!;
    expect(periodTo.getFullYear()).toBe(2009);
    expect(periodTo.getMonth()).toBe(10);
    expect(periodTo.getDate()).toBe(30);

    // Items (CreditNoteLines)
    expect(ci.getZFItems().length).toBe(5);

    const item1 = ci.getZFItems()[0];
    expect(item1.getProduct()!.getName()).toBe('Labtop computer');
    expect(item1.getProduct()!.getSellerAssignedID()).toBe('JB007');
    expect(item1.getQuantity().toNumber()).toBe(1);
    expect(item1.getPrice().toNumber()).toBe(1273);

    const item5 = ci.getZFItems()[4];
    expect(item5.getProduct()!.getName()).toBe('Network cable');
    expect(item5.getQuantity().toNumber()).toBe(250);
    expect(item5.getPrice().toNumber()).toBe(0.75);
    // Item attributes
    const attrs = item5.getProduct()!.getAttributes();
    expect(attrs).not.toBeNull();
    expect(attrs!.get('Type')).toBe('Cat5');

    // Prepaid amount
    expect(ci.getTotalPrepaidAmount()!.toNumber()).toBe(1000);

    // Calculated amounts
    expect(ci.getGrandTotal()!.toNumber()).toBe(1729);
    expect(ci.getDuePayable()!.toNumber()).toBe(729);

    // Document-level allowances/charges
    const charges = ci.getZFCharges();
    expect(charges).not.toBeNull();
    expect(charges!.length).toBe(1);

    const allowances = ci.getZFAllowances();
    expect(allowances).not.toBeNull();
    expect(allowances!.length).toBe(1);
  });

  it('testUBLStandardDetection', () => {
    const ciiXml = readFixture('factur-x.xml');
    const ublXml = readFixture('XRECHNUNG_Einfach.ubl.xml');
    const cnXml = readFixture('ubl-creditnote.xml');

    const ciiImporter = new ZUGFeRDInvoiceImporter(ciiXml);
    expect(ciiImporter.getStandard()).toBe('cii');

    const ublImporter = new ZUGFeRDInvoiceImporter(ublXml);
    expect(ublImporter.getStandard()).toBe('ubl');

    const cnImporter = new ZUGFeRDInvoiceImporter(cnXml);
    expect(cnImporter.getStandard()).toBe('ubl_creditnote');
  });

  it('testUBLReisekostenabrechnung', () => {
    const xml = readFixture('XRECHNUNG_Reisekostenabrechnung.ubl.xml');
    const zii = new ZUGFeRDInvoiceImporter(xml);
    const invoice = new Invoice();
    zii.extractInto(invoice);

    expect(invoice.getNumber()).toBeTruthy();
    expect(invoice.getSender()).not.toBeNull();
    expect(invoice.getRecipient()).not.toBeNull();
    expect(invoice.getZFItems().length).toBeGreaterThan(0);
  });

  // Mirrors upstream ZF2ZInvoiceImporterTest.testInvoiceImportUBL (document-level
  // portion): a UBL <cbc:Note> that is a direct child of the invoice root is imported
  // as a general note (BG-1). Notes nested under cac:PaymentTerms are intentionally
  // not picked up.
  it('testInvoiceImportUBLNote', () => {
    const ublXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>UBL-1</cbc:ID>
  <cbc:Note>This is a UBL note</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:PaymentTerms>
    <cbc:Note>Zahlbar innerhalb 30 Tagen netto</cbc:Note>
  </cac:PaymentTerms>
</Invoice>`;

    const ci = new CalculatedInvoice();
    new ZUGFeRDInvoiceImporter(ublXml).extractInto(ci);

    const notes = ci.getNotesWithSubjectCode();
    expect(notes).not.toBeNull();
    expect(notes!.length).toBe(1);
    expect(notes![0].getContent()).toBe('This is a UBL note');
    expect(notes![0].getSubjectCode()).toBe(SubjectCode.AAI);
  });
});
