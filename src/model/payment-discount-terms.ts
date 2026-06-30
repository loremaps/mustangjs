import { Big, type Decimal } from '../decimal.js';

/**
 * Structured discount terms attached to {@link PaymentTerms}: a reduction of
 * `percent` percent, valid either until the parent's absolute due date or for
 * `periodMeasure` units of `periodUnitCode` (e.g. DAYS) starting at `baseDate`.
 *
 * Ported from Java mustangproject's PaymentDiscountTerms / IZUGFeRDPaymentDiscountTerms.
 */
export class PaymentDiscountTerms {
  private percent: Decimal;
  private baseDate: Date | null;
  private periodMeasure: number;
  private periodUnitCode: string;

  constructor(
    percent: Decimal,
    baseDate: Date | null,
    periodMeasure: number,
    periodUnitCode: string,
  ) {
    this.percent = percent;
    this.baseDate = baseDate;
    this.periodMeasure = periodMeasure;
    this.periodUnitCode = periodUnitCode;
  }

  getCalculationPercentage(): Decimal {
    return this.percent;
  }

  getBaseDate(): Date | null {
    return this.baseDate;
  }

  getBasePeriodMeasure(): number {
    return this.periodMeasure;
  }

  getBasePeriodUnitCode(): string {
    return this.periodUnitCode;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): PaymentDiscountTerms {
    return new PaymentDiscountTerms(
      new Big(data.percent ?? data.calculationPercentage ?? 0),
      data.baseDate != null ? new Date(data.baseDate) : null,
      Number(data.periodMeasure ?? data.basePeriodMeasure ?? 0),
      data.periodUnitCode ?? data.basePeriodUnitCode ?? 'DAYS',
    );
  }
}
