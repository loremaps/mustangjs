import { DOMParser } from '@xmldom/xmldom';
import { Profiles, type Profile } from '../constants/profiles.js';
import { ZUGFeRDInvoiceImporter } from '../import/invoice-importer.js';
import { CalculatedInvoice } from '../model/calculated-invoice.js';
import { InvoiceValidator } from './invoice-validator.js';
import { SchematronValidator } from './schematron-validator.js';
import type { ValidationResultItem } from './validation-result-item.js';
import { ValidationResult } from './validation-result.js';

type Format = 'cii' | 'ubl';

export interface XMLValidationOptions {
  /** Override auto-detected profile */
  profile?: Profile;
  /** Skip Schematron validation (only run programmatic rules) */
  skipSchematron?: boolean;
  /** Skip programmatic business rules (only run Schematron) */
  skipProgrammatic?: boolean;
}

/**
 * High-level XML invoice validator.
 * Orchestrates Schematron validation (EN16931/XRechnung XSLT rules)
 * and programmatic business rules.
 */
export class XMLValidator {
  private schematronValidator = new SchematronValidator();

  /**
   * Validate an invoice XML string.
   * Auto-detects format (CII/UBL) and profile from the XML content.
   */
  async validate(
    xml: string,
    options: XMLValidationOptions = {},
  ): Promise<ValidationResult> {
    const allItems: ValidationResultItem[] = [];

    // Detect format from root element
    const format = this.detectFormat(xml);

    // Detect profile
    const importer = new ZUGFeRDInvoiceImporter(xml);
    const profile = options.profile ?? importer.getProfile() ?? Profiles.getByName('EN16931');

    // Run Schematron validation
    if (!options.skipSchematron) {
      const schematronResult = await this.schematronValidator.validate(xml, format, profile);
      allItems.push(...schematronResult.getAll());
    }

    // Run programmatic business rules
    if (!options.skipProgrammatic) {
      const invoice = new CalculatedInvoice();
      importer.extractInto(invoice);
      const programmaticResult = new InvoiceValidator(profile).validate(invoice);
      allItems.push(...programmaticResult.getAll());
    }

    return new ValidationResult(allItems);
  }

  private detectFormat(xml: string): Format {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const rootName = doc.documentElement?.localName ?? '';
    if (rootName === 'Invoice' || rootName === 'CreditNote') {
      return 'ubl';
    }
    return 'cii';
  }
}
