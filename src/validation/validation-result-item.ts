import type { SeverityType } from './severity.js';

export interface ValidationResultItem {
  readonly severity: SeverityType;
  readonly ruleId: string;
  readonly message: string;
  readonly location?: string;
}
