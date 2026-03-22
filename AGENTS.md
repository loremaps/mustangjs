# mustangjs — Codex context

## Project

TypeScript port of Java [mustangproject](https://github.com/ZUGFeRD/mustangproject). Parses, creates, exports, and validates EN16931 e-invoices (ZUGFeRD/Factur-X CII, XRechnung UBL).

## Commands

```bash
npm test          # vitest run (all tests)
npm run build     # tsc
npx vitest run test/foo.test.ts  # single file
```

## Architecture

```
src/
  model/           — Invoice, CalculatedInvoice, Item, Product, TradeParty, ...
  calc/            — TransactionCalculator, LineCalculator (totals/VAT)
  export/          — ZUGFeRD2PullProvider (CII XML output)
  import/          — ZUGFeRDInvoiceImporter (CII + UBL parsing)
  validation/      — InvoiceValidator, ValidationResult, Severity
  constants/       — Profiles, TaxCategoryCode, DocumentCodeType
  interfaces/      — ExportableTransaction, ExportableItem, ExportableProduct
test/
  fixtures/        — Real-world CII/UBL XML files for integration tests
```

## Key patterns

- `Invoice` — mutable builder; `CalculatedInvoice extends Invoice` — adds stored totals (populated by import)
- `ExportableTransaction` — interface both implement; validator and calculator accept this
- Arithmetic uses `big.js` (`Decimal` type alias); always round to 2dp with `Big.roundHalfUp`
- Profile names: `MINIMUM`, `BASICWL`, `BASIC`, `EN16931`, `EXTENDED`, `XRECHNUNG`
- Tax category codes: `S` (standard), `Z` (zero), `E` (exempt), `AE` (reverse charge), `K` (intra-community), `O` (outside scope)

## Testing

- Framework: vitest
- Pattern: build a valid baseline invoice with `createValidInvoice()`, then mutate one field per test
- Integration tests import real fixture XML from `test/fixtures/`
- 92 tests total across 7 files; all must pass before committing
