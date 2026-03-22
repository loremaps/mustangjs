export const Severity = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  NOTICE: 'NOTICE',
} as const;

export type SeverityType = (typeof Severity)[keyof typeof Severity];
