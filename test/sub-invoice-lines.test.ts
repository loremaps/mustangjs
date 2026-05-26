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

function buildHierarchicalInvoice(): Invoice {
  const parent = new Item(
    new Product('Bundle', '', 'C62', new Big(19)),
    new Big(100),
    new Big(1),
  ).setId('1');
  const child = new Item(
    new Product('Sub item', '', 'C62', new Big(19)),
    new Big(50),
    new Big(1),
  )
    .setId('1.1')
    .setParentLineID('1')
    .setLineStatusReasonCode('DETAIL');

  return new Invoice()
    .setNumber('SUB-1')
    .setIssueDate(new Date(2026, 0, 1))
    .setDueDate(new Date(2026, 0, 15))
    .setDeliveryDate(new Date(2026, 0, 1))
    .setSender(
      new TradeParty('Seller', 'S 1', '12345', 'Berlin', 'DE').addVATID('DE111'),
    )
    .setRecipient(new TradeParty('Buyer', 'B 1', '54321', 'Munich', 'DE'))
    .addItem(parent)
    .addItem(child);
}

function xpathString(xml: string, expr: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const result = xpath.select(`string(${expr})`, doc);
  return typeof result === 'string' ? result : '';
}

function xpathCount(xml: string, localName: string): number {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const result = xpath.select(`count(//*[local-name()='${localName}'])`, doc);
  return typeof result === 'number' ? result : 0;
}

describe('Hierarchical line items', () => {
  it('emits ParentLineID and LineStatusReasonCode in Extended profile', () => {
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EXTENDED'));
    provider.generateXML(buildHierarchicalInvoice());
    const xml = provider.getXML();

    expect(
      xpathString(
        xml,
        "(//*[local-name()='AssociatedDocumentLineDocument']/*[local-name()='ParentLineID'])[1]",
      ),
    ).toBe('1');
    expect(
      xpathString(
        xml,
        "(//*[local-name()='AssociatedDocumentLineDocument']/*[local-name()='LineStatusReasonCode'])[1]",
      ),
    ).toBe('DETAIL');
  });

  it('does not emit ParentLineID in non-Extended profiles', () => {
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(buildHierarchicalInvoice());
    expect(xpathCount(provider.getXML(), 'ParentLineID')).toBe(0);
    expect(xpathCount(provider.getXML(), 'LineStatusReasonCode')).toBe(0);
  });

  it('round-trips ParentLineID and LineStatusReasonCode through the importer', () => {
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EXTENDED'));
    provider.generateXML(buildHierarchicalInvoice());

    const importer = new ZUGFeRDInvoiceImporter(provider.getXML());
    const imported = new Invoice();
    importer.extractInto(imported);

    const items = imported.getZFItems();
    expect(items).toHaveLength(2);
    const child = items.find((it) => it.getId() === '1.1');
    expect(child).toBeDefined();
    expect((child as Item).getParentLineID()).toBe('1');
    expect((child as Item).getLineStatusReasonCode()).toBe('DETAIL');
  });
});
