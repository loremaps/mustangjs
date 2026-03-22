import { Big, type Decimal } from '../decimal.js';

export class VATAmount {
  protected basis: Decimal;
  protected calculated: Decimal;
  protected applicablePercent: Decimal | null = null;
  protected categoryCode: string;
  protected vatExemptionReasonText: string | null = null;
  protected dueDateTypeCode: string | null = null;

  constructor(
    basis: Decimal,
    calculated: Decimal,
    categoryCode: string,
    dueDateTypeCode?: string | null,
    applicablePercent?: Decimal,
  ) {
    this.basis = basis;
    this.calculated = calculated;
    this.categoryCode = categoryCode;
    this.dueDateTypeCode = dueDateTypeCode ?? null;
    if (applicablePercent !== undefined) {
      this.applicablePercent = applicablePercent;
    }
  }

  getApplicablePercent(): Decimal | null {
    return this.applicablePercent;
  }

  setApplicablePercent(applicablePercent: Decimal): this {
    this.applicablePercent = applicablePercent;
    return this;
  }

  getBasis(): Decimal {
    return this.basis;
  }

  setBasis(basis: Decimal): this {
    this.basis = basis.round(2, Big.roundHalfUp);
    return this;
  }

  getCalculated(): Decimal {
    return this.calculated;
  }

  setCalculated(calculated: Decimal): this {
    this.calculated = calculated;
    return this;
  }

  getVatExemptionReasonText(): string | null {
    return this.vatExemptionReasonText;
  }

  setVatExemptionReasonText(text: string): this {
    this.vatExemptionReasonText = text;
    return this;
  }

  getCategoryCode(): string {
    return this.categoryCode;
  }

  setCategoryCode(categoryCode: string): this {
    this.categoryCode = categoryCode;
    return this;
  }

  getDueDateTypeCode(): string | null {
    return this.dueDateTypeCode;
  }

  setDueDateTypeCode(dueDateTypeCode: string): this {
    this.dueDateTypeCode = dueDateTypeCode;
    return this;
  }

  add(v: VATAmount): VATAmount {
    const result = new VATAmount(
      this.basis.plus(v.getBasis()),
      this.calculated.plus(v.getCalculated()),
      this.categoryCode,
      this.dueDateTypeCode,
    );
    result.setVatExemptionReasonText(
      (v.getVatExemptionReasonText() != null
        ? v.getVatExemptionReasonText()
        : this.vatExemptionReasonText) ?? '',
    );
    return result;
  }

  subtract(v: VATAmount): VATAmount {
    const result = new VATAmount(
      this.basis.minus(v.getBasis()),
      this.calculated.minus(v.getCalculated()),
      this.categoryCode,
      this.dueDateTypeCode,
    );
    if (v.getVatExemptionReasonText() != null) {
      result.setVatExemptionReasonText(v.getVatExemptionReasonText()!);
    }
    return result;
  }
}
