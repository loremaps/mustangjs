import { Severity } from './severity.js';
import type { ValidationResultItem } from './validation-result-item.js';

export class ValidationResult {
  private readonly items: ValidationResultItem[];

  constructor(items: ValidationResultItem[]) {
    this.items = items;
  }

  isValid(): boolean {
    return !this.items.some((i) => i.severity === Severity.ERROR);
  }

  getErrors(): ValidationResultItem[] {
    return this.items.filter((i) => i.severity === Severity.ERROR);
  }

  getWarnings(): ValidationResultItem[] {
    return this.items.filter((i) => i.severity === Severity.WARNING);
  }

  getNotices(): ValidationResultItem[] {
    return this.items.filter((i) => i.severity === Severity.NOTICE);
  }

  hasRule(ruleId: string): boolean {
    return this.items.some((i) => i.ruleId === ruleId);
  }

  getAll(): ValidationResultItem[] {
    return this.items;
  }
}
