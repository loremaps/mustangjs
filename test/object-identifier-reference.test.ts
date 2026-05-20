import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { Big } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { Profiles } from '../src/constants/profiles.js';

function makeMinimalInvoice(): Invoice {
  return new Invoice()
    .setNumber('OBJID-1')
    .setIssueDate(new Date(2026, 0, 1))
    .setDueDate(new Date(2026, 0, 15))
    .setDeliveryDate(new Date(2026, 0, 1))
    .setSender(
      new TradeParty('Seller', 'S 1', '12345', 'Berlin', 'DE').addVATID('DE111'),
    )
    .setRecipient(new TradeParty('Buyer', 'B 1', '54321', 'Munich', 'DE'))
    .addItem(
      new Item(new Product('Item', '', 'C62', new Big(19)), new Big(100), new Big(1)),
    );
}

function xpathString(xml: string, expr: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const result = xpath.select(`string(${expr})`, doc);
  return typeof result === 'string' ? result : '';
}

const REF_BLOCK =
  "//*[local-name()='AdditionalReferencedDocument'][./*[local-name()='TypeCode']/text()='130']";

describe('ObjectIdentifierReferencedDocument (BT-18)', () => {
  it('emits AdditionalReferencedDocument with TypeCode 130 and ReferenceTypeCode', () => {
    const inv = makeMinimalInvoice().setObjectIdentifierReferencedDocument(
      'OBJ-42',
      'AHP',
      new Date(2026, 2, 15),
    );
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(inv);
    const xml = provider.getXML();

    expect(
      xpathString(xml, `${REF_BLOCK}/*[local-name()='IssuerAssignedID']`),
    ).toBe('OBJ-42');
    expect(
      xpathString(xml, `${REF_BLOCK}/*[local-name()='ReferenceTypeCode']`),
    ).toBe('AHP');
    expect(
      xpathString(
        xml,
        `${REF_BLOCK}/*[local-name()='FormattedIssueDateTime']/*[local-name()='DateTimeString']`,
      ),
    ).toBe('20260315');
  });

  it('emits the reference without ReferenceTypeCode when not set', () => {
    const inv = makeMinimalInvoice().setObjectIdentifierReferencedDocument('OBJ-7');
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(inv);
    const xml = provider.getXML();
    expect(
      xpathString(xml, `${REF_BLOCK}/*[local-name()='IssuerAssignedID']`),
    ).toBe('OBJ-7');
    expect(
      xpathString(xml, `${REF_BLOCK}/*[local-name()='ReferenceTypeCode']`),
    ).toBe('');
  });

  it('round-trips through the importer', () => {
    const inv = makeMinimalInvoice().setObjectIdentifierReferencedDocument(
      'OBJ-99',
      'AHP',
      new Date(2026, 5, 1),
    );
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(inv);

    const importer = new ZUGFeRDInvoiceImporter(provider.getXML());
    const imported = new Invoice();
    importer.extractInto(imported);

    const ref = imported.getObjectIdentifierReferencedDocument();
    expect(ref).not.toBeNull();
    expect(ref!.getIssuerAssignedID()).toBe('OBJ-99');
    expect(ref!.getReferenceTypeCode()).toBe('AHP');
    expect(ref!.getTypeCode()).toBe('130');
    const date = ref!.getFormattedIssueDateTime();
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(5);
    expect(date!.getDate()).toBe(1);
  });
});
