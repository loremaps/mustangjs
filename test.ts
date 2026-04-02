import { readFileSync } from 'node:fs'
import { XMLValidator } from './dist/src/index.js';
import { ZUGFeRDInvoiceImporter, CalculatedInvoice } from './dist/src/index.js';

const xmlString = readFileSync('/Users/pka/Downloads/voucher_invalid.xml', 'UTF-8');
console.log(`XML length: ${xmlString.length}`);

const validator = new XMLValidator();
const result = await validator.validate(xmlString);

console.log(`is valid: ${result.isValid()}`);

const errors = result.getErrors();
if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  [${e.ruleId}] ${e.message}`);
}

const warnings = result.getWarnings();
if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  [${w.ruleId}] ${w.message}`);
}

//
console.log("--------------------")
const importer = new ZUGFeRDInvoiceImporter(xmlString);
const ci = new CalculatedInvoice();
importer.extractInto(ci);
console.log(JSON.stringify(ci, null, 2));