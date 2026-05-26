import { describe, it, expect } from 'vitest';
import { Big } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { ZUGFeRDInvoiceImporter } from '../src/import/invoice-importer.js';
import { Profiles } from '../src/constants/profiles.js';

function buildCIIXml(): string {
  const inv = new Invoice()
    .setNumber('CP-1')
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
  const provider = new ZUGFeRD2PullProvider();
  provider.setProfile(Profiles.getByName('EN16931'));
  provider.generateXML(inv);
  return provider.getXML();
}

describe('ZUGFeRDInvoiceImporter.canParse', () => {
  it('returns true for valid CII XML', () => {
    const importer = new ZUGFeRDInvoiceImporter(buildCIIXml());
    expect(importer.canParse()).toBe(true);
  });

  it('returns false when no XML is loaded', () => {
    const importer = new ZUGFeRDInvoiceImporter();
    expect(importer.canParse()).toBe(false);
  });

  it('returns false for an unrelated XML document', () => {
    const importer = new ZUGFeRDInvoiceImporter('<foo><bar/></foo>');
    expect(importer.canParse()).toBe(false);
  });

  it('returns false for garbage input without throwing', () => {
    const importer = new ZUGFeRDInvoiceImporter('not xml at all');
    expect(() => importer.canParse()).not.toThrow();
    expect(importer.canParse()).toBe(false);
  });
});
