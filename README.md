# mustangjs

TypeScript port of [mustangproject](https://www.mustangproject.org/) — a library for creating, parsing, and validating EN16931 e-invoices (ZUGFeRD, Factur-X, XRechnung).

## Install

```bash
npm install mustangjs
```

## Usage

```typescript
import { Invoice, Item, Product, TradeParty, Big } from 'mustangjs';
import { ZUGFeRD2PullProvider, Profiles } from 'mustangjs';

const invoice = new Invoice()
  .setNumber('INV-001')
  .setIssueDate(new Date())
  .setSender(new TradeParty('Seller GmbH', 'Str. 1', '10115', 'Berlin', 'DE').addVATID('DE123'))
  .setRecipient(new TradeParty('Buyer AG', 'Str. 2', '80331', 'Munich', 'DE'))
  .addItem(new Item(new Product('Service', '', 'C62', new Big(19)), new Big(100), new Big(1)));

const provider = new ZUGFeRD2PullProvider();
provider.setProfile(Profiles.getByName('EN16931'));
provider.generateXML(invoice);
const xml = provider.getXML(); // CII XML string
```

### Parse

```typescript
import { ZUGFeRDInvoiceImporter, CalculatedInvoice } from 'mustangjs';

const importer = new ZUGFeRDInvoiceImporter(xmlString);
const ci = new CalculatedInvoice();
importer.extractInto(ci);
console.log(ci.getGrandTotal().toString());
```

### Validate

```typescript
import { InvoiceValidator, Profiles } from 'mustangjs';

const validator = new InvoiceValidator(Profiles.getByName('EN16931'));
const result = validator.validate(invoice);
result.isValid();          // true if no errors
result.getErrors();        // ValidationResultItem[]
result.hasRule('BR-02');   // check specific rule
```

## Supported formats

- **CII** (Cross-Industry Invoice): ZUGFeRD 2.x, Factur-X
- **UBL** (Universal Business Language): XRechnung

## Profiles

`MINIMUM`, `BASICWL`, `BASIC`, `EN16931`, `EXTENDED`, `XRECHNUNG`

## Build & test

```bash
npm run build
npm test
```

## License

Apache-2.0
