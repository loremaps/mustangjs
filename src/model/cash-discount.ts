import { Big, type Decimal } from '../decimal.js';
import { nDigitFormat } from '../xml/xml-tools.js';

/**
 * A cash discount ("Skonto") granted for early payment: a reduction of `percent`
 * percent if the invoice is paid within `days` days, optionally relative to a
 * given `basisAmount` (the original payment amount).
 *
 * Ported from Java mustangproject's CashDiscount.
 */
export class CashDiscount {
  private percent: Decimal | null;
  private days: number | null;
  private basisAmount: Decimal | null = null;

  constructor(percent: Decimal | null = null, days: number | null = null) {
    this.percent = percent;
    this.days = days;
  }

  getPercent(): Decimal | null {
    return this.percent;
  }

  setPercent(percent: Decimal | null): this {
    this.percent = percent;
    return this;
  }

  getDays(): number | null {
    return this.days;
  }

  setDays(days: number | null): this {
    this.days = days;
    return this;
  }

  getBasisAmount(): Decimal | null {
    return this.basisAmount;
  }

  setBasisAmount(basisAmount: Decimal | null): this {
    this.basisAmount = basisAmount;
    return this;
  }

  /**
   * Renders this discount as a structured CII `<ram:SpecifiedTradePaymentTerms>`
   * block (used in the EXTENDED profile). The percent is formatted to 3 decimals
   * and the optional basis amount to 2 decimals.
   */
  toCiiXml(): string {
    let result =
      '<ram:SpecifiedTradePaymentTerms>' +
      '<ram:Description>Cash Discount</ram:Description>' +
      '<ram:ApplicableTradePaymentDiscountTerms>' +
      `<ram:BasisPeriodMeasure unitCode="DAY">${this.days}</ram:BasisPeriodMeasure>`;
    if (this.basisAmount != null) {
      result += `<ram:BasisAmount>${nDigitFormat(this.basisAmount, 2)}</ram:BasisAmount>`;
    }
    result +=
      `<ram:CalculationPercent>${nDigitFormat(this.percent ?? new Big(0), 3)}</ram:CalculationPercent>` +
      '</ram:ApplicableTradePaymentDiscountTerms>' +
      '</ram:SpecifiedTradePaymentTerms>';
    return result;
  }

  /**
   * Renders this discount as the proprietary XRechnung free-text line that is
   * embedded in the payment terms description, e.g. `#SKONTO#TAGE=14#PROZENT=2.00#`.
   */
  toXRechnung(): string {
    return `#SKONTO#TAGE=${this.days}#PROZENT=${nDigitFormat(this.percent ?? new Big(0), 2)}#\n`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): CashDiscount {
    const cd = new CashDiscount(
      data.percent != null ? new Big(data.percent) : null,
      data.days != null ? Number(data.days) : null,
    );
    if (data.basisAmount != null) cd.setBasisAmount(new Big(data.basisAmount));
    return cd;
  }
}
