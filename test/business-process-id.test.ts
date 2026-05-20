import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { Big } from '../src/decimal.js';
import { Invoice } from '../src/model/invoice.js';
import { Item } from '../src/model/item.js';
import { Product } from '../src/model/product.js';
import { TradeParty } from '../src/model/trade-party.js';
import { ZUGFeRD2PullProvider } from '../src/export/zugferd2-pull-provider.js';
import { Profiles } from '../src/constants/profiles.js';

function makeMinimalInvoice(): Invoice {
  return new Invoice()
    .setNumber('BP-1')
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

function xpathCount(xml: string, localName: string): number {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const result = xpath.select(`count(//*[local-name()='${localName}'])`, doc);
  return typeof result === 'number' ? result : 0;
}

const BP_XPATH =
  "//*[local-name()='BusinessProcessSpecifiedDocumentContextParameter']/*[local-name()='ID']";

describe('BusinessProcessId (BT-23)', () => {
  it('uses configured business process ID when set', () => {
    const inv = makeMinimalInvoice().setBusinessProcessId('A1');
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(inv);
    expect(xpathString(provider.getXML(), BP_XPATH)).toBe('A1');
  });

  it('configured ID overrides XRechnung default', () => {
    const inv = makeMinimalInvoice().setBusinessProcessId('urn:custom:profile');
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('XRECHNUNG'));
    provider.generateXML(inv);
    expect(xpathString(provider.getXML(), BP_XPATH)).toBe('urn:custom:profile');
  });

  it('falls back to the XRechnung default URN when not set', () => {
    const inv = makeMinimalInvoice();
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('XRECHNUNG'));
    provider.generateXML(inv);
    expect(xpathString(provider.getXML(), BP_XPATH)).toBe(
      'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    );
  });

  it('emits no business process parameter for non-XRechnung when unset', () => {
    const inv = makeMinimalInvoice();
    const provider = new ZUGFeRD2PullProvider();
    provider.setProfile(Profiles.getByName('EN16931'));
    provider.generateXML(inv);
    expect(
      xpathCount(provider.getXML(), 'BusinessProcessSpecifiedDocumentContextParameter'),
    ).toBe(0);
  });
});
