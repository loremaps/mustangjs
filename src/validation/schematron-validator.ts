import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import SaxonJS from 'saxon-js';
import type { Profile } from '../constants/profiles.js';
import { Severity } from './severity.js';
import type { SeverityType } from './severity.js';
import type { ValidationResultItem } from './validation-result-item.js';
import { ValidationResult } from './validation-result.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveSchematronDir(): string {
  // Try sibling schematron/ directory first (works when running from src/)
  const sibling = join(__dirname, 'schematron');
  if (existsSync(sibling)) return sibling;
  // When running from dist/src/validation/, walk up to project root and find src/validation/schematron/
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'src', 'validation', 'schematron');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  // Fallback to sibling path (will error on first SEF load with a clear message)
  return sibling;
}

const SCHEMATRON_DIR = resolveSchematronDir();

type Format = 'cii' | 'ubl';

interface SchematronResult {
  items: ValidationResultItem[];
  rulesFired: number;
  rulesFailed: number;
}

/**
 * Validates invoice XML against EN16931 and XRechnung Schematron rules
 * using pre-compiled XSLT stylesheets via saxon-js.
 */
export class SchematronValidator {
  private sefCache = new Map<string, object>();

  /**
   * Validate an XML string against Schematron rules.
   * Selects the appropriate XSLT based on format and profile.
   */
  async validate(
    xml: string,
    format: Format,
    profile: Profile,
  ): Promise<ValidationResult> {
    const allItems: ValidationResultItem[] = [];

    // Always run EN16931 base validation
    const en16931Sef = format === 'cii'
      ? 'EN16931-CII-validation.sef.json'
      : 'EN16931-UBL-validation.sef.json';
    const en16931Result = await this.runSchematron(xml, en16931Sef);
    allItems.push(...en16931Result.items);

    // Additionally run XRechnung rules if profile is XRECHNUNG
    if (profile.getName() === 'XRECHNUNG') {
      const xrSef = format === 'cii'
        ? 'XRechnung-CII-validation.sef.json'
        : 'XRechnung-UBL-validation.sef.json';
      const xrResult = await this.runSchematron(xml, xrSef);
      allItems.push(...xrResult.items);
    }

    return new ValidationResult(allItems);
  }

  private async runSchematron(
    xml: string,
    sefFilename: string,
  ): Promise<SchematronResult> {
    const sef = this.loadSef(sefFilename);

    const result = await SaxonJS.transform({
      stylesheetInternal: sef,
      sourceText: xml,
      destination: 'serialized',
    }, 'async');

    const svrlXml = result.principalResult as string;
    return this.parseSVRL(svrlXml);
  }

  private loadSef(filename: string): object {
    const cached = this.sefCache.get(filename);
    if (cached) return cached;

    const sefPath = join(SCHEMATRON_DIR, filename);
    try {
      const sefJson = JSON.parse(readFileSync(sefPath, 'utf-8'));
      this.sefCache.set(filename, sefJson);
      return sefJson;
    } catch (err) {
      throw new Error(
        `Schematron SEF file not found: ${sefPath}. ` +
        `Ensure SEF files are compiled in src/validation/schematron/. ` +
        `See SCHEMATRON.md for instructions.`,
        { cause: err },
      );
    }
  }

  private parseSVRL(svrlXml: string): SchematronResult {
    const doc = new DOMParser().parseFromString(svrlXml, 'text/xml');
    const items: ValidationResultItem[] = [];

    // Count fired rules
    const firedRules = xpath.select(
      "//*[local-name()='fired-rule']",
      doc,
    );
    const rulesFired = Array.isArray(firedRules) ? firedRules.length : 0;

    // Extract failed assertions
    const failedAsserts = xpath.select(
      "//*[local-name()='failed-assert']",
      doc,
    );
    if (!Array.isArray(failedAsserts)) {
      return { items, rulesFired, rulesFailed: 0 };
    }

    for (const node of failedAsserts) {
      const elem = node as Element;
      const id = elem.getAttribute('id') ?? '';
      const location = elem.getAttribute('location') ?? undefined;
      const flag = elem.getAttribute('flag') ?? '';

      // Extract text content from svrl:text child
      const textNodes = xpath.select(
        "./*[local-name()='text']",
        elem,
      );
      const message = Array.isArray(textNodes) && textNodes.length > 0
        ? (textNodes[0] as Element).textContent?.trim() ?? ''
        : '';

      // Map flag to severity
      let severity: SeverityType = Severity.ERROR;
      if (flag === 'warning') {
        severity = Severity.WARNING;
      } else if (flag === 'information') {
        severity = Severity.NOTICE;
      }

      items.push({
        severity,
        ruleId: id,
        message,
        location,
      });
    }

    return {
      items,
      rulesFired,
      rulesFailed: failedAsserts.length,
    };
  }
}
