import { PaymentDiscountTerms } from './payment-discount-terms.js';

/**
 * Structured payment terms: a free-text description, an optional due date, and
 * optional {@link PaymentDiscountTerms}. When set on a transaction this takes
 * precedence over the simple payment-term-description / due-date pair.
 *
 * Ported from Java mustangproject's PaymentTerms / IZUGFeRDPaymentTerms.
 */
export class PaymentTerms {
  private description: string | null;
  private dueDate: Date | null;
  private discountTerms: PaymentDiscountTerms | null;

  constructor(
    description: string | null = null,
    dueDate: Date | null = null,
    discountTerms: PaymentDiscountTerms | null = null,
  ) {
    this.description = description;
    this.dueDate = dueDate;
    this.discountTerms = discountTerms;
  }

  getDescription(): string | null {
    return this.description;
  }

  getDueDate(): Date | null {
    return this.dueDate;
  }

  getDiscountTerms(): PaymentDiscountTerms | null {
    return this.discountTerms;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): PaymentTerms {
    return new PaymentTerms(
      data.description ?? null,
      data.dueDate != null ? new Date(data.dueDate) : null,
      data.discountTerms != null
        ? PaymentDiscountTerms.fromJSON(data.discountTerms)
        : null,
    );
  }
}
