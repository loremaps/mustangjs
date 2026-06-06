# mustangjs

TypeScript port of [mustangproject](https://www.mustangproject.org/) — a library for creating, parsing, and validating EN16931 e-invoices (ZUGFeRD, Factur-X, XRechnung).

## Install

```bash
npm install @aifind/mustangjs
```

## Usage

```typescript
import { Invoice, Item, Product, TradeParty, Big } from '@aifind/mustangjs';
import { ZUGFeRD2PullProvider, Profiles } from '@aifind/mustangjs';

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
import { ZUGFeRDInvoiceImporter, CalculatedInvoice } from '@aifind/mustangjs';

const importer = new ZUGFeRDInvoiceImporter(xmlString);
const ci = new CalculatedInvoice();
importer.extractInto(ci);
console.log(ci.getGrandTotal().toString());
```

### Validate

Validate invoice XML against official EN16931 and XRechnung Schematron rules using `XMLValidator`. This runs the same XSLT-based business rules used by the Java [mustangproject](https://github.com/ZUGFeRD/mustangproject) validator — hundreds of rules maintained by the standards bodies (CEN, KoSIT).

```typescript
import { XMLValidator } from '@aifind/mustangjs';

const validator = new XMLValidator();
const result = await validator.validate(xmlString);

result.isValid();          // true if no errors
result.getErrors();        // ValidationResultItem[]
result.getWarnings();      // warnings (non-blocking)
result.hasRule('BR-02');   // check specific rule
```

Format (CII/UBL) and profile are auto-detected from the XML. You can override:

```typescript
import { XMLValidator, Profiles } from '@aifind/mustangjs';

const result = await validator.validate(xmlString, {
  profile: Profiles.getByName('XRECHNUNG'),  // override auto-detected profile
  skipProgrammatic: true,                     // Schematron only (recommended)
});
```

There is also a lower-level `InvoiceValidator` for programmatic rule checks on `Invoice` objects (without XML/Schematron):

```typescript
import { InvoiceValidator, Profiles } from '@aifind/mustangjs';

const validator = new InvoiceValidator(Profiles.getByName('EN16931'));
const result = validator.validate(invoice);
```

### Schematron rules

Validation is powered by pre-compiled Schematron XSLT stylesheets (via [saxon-js](https://www.saxonica.com/saxon-js/)):

| Ruleset | Format | Covers |
|---------|--------|--------|
| EN16931-CII | CII | Core EN16931 business rules for ZUGFeRD/Factur-X |
| EN16931-UBL | UBL | Core EN16931 business rules (incl. PEPPOL BIS) |
| XRechnung-CII | CII | German XRechnung-specific rules (v3.0) |
| XRechnung-UBL | UBL | German XRechnung-specific rules (v3.0) |

The SEF files live in `src/validation/schematron/`. See [SCHEMATRON.md](SCHEMATRON.md) for how to update them when new rule versions are released.

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

This project is licensed under the [Apache License 2.0](LICENSE). Third-party runtime dependencies and bundled validation artifacts are under their own licenses. See [NOTICE](NOTICE).
