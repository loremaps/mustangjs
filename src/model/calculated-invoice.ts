import { Big, ZERO, type Decimal } from '../decimal.js';
import { Invoice } from './invoice.js';
import { TransactionCalculator } from '../calc/transaction-calculator.js';

export class CalculatedInvoice extends Invoice {
  protected lineTotalAmount: Decimal | null = null;
  protected duePayableAmount: Decimal | null = null;
  protected grandTotalAmount: Decimal | null = null;
  protected taxBasisAmount: Decimal | null = null;
  protected vatTotal: Decimal | null = null;
  protected tc: TransactionCalculator | null = null;

  calculate(): void {
    this.tc = new TransactionCalculator(this);
    this.grandTotalAmount = this.tc.getGrandTotal();
    this.lineTotalAmount = this.tc.getValue();
    this.duePayableAmount = this.tc.getDuePayable();
    this.taxBasisAmount = this.tc.getTaxBasis();
    this.vatTotal = ZERO;
    for (const vam of this.tc!.getTaxDetails()) {
      this.vatTotal = this.vatTotal!.plus(vam.getCalculated());
    }
  }

  getGrandTotal(): Decimal {
    if (this.grandTotalAmount == null) {
      this.calculate();
    }
    return this.grandTotalAmount!;
  }

  setGrandTotal(grand: Decimal): this {
    this.grandTotalAmount = grand;
    return this;
  }

  getTaxBasis(): Decimal {
    if (this.taxBasisAmount == null) {
      this.calculate();
    }
    return this.taxBasisAmount!;
  }

  setTaxBasis(basis: Decimal): this {
    this.taxBasisAmount = basis;
    return this;
  }

  getDuePayable(): Decimal {
    if (this.duePayableAmount == null) {
      this.calculate();
    }
    return this.duePayableAmount!;
  }

  setDuePayable(due: Decimal): this {
    this.duePayableAmount = due;
    return this;
  }

  getLineTotalAmount(): Decimal {
    if (this.lineTotalAmount == null) {
      this.calculate();
    }
    return this.lineTotalAmount!;
  }

  setLineTotalAmount(total: Decimal): this {
    this.lineTotalAmount = total;
    return this;
  }

  getVATtotal(): Decimal {
    if (this.vatTotal == null) {
      this.calculate();
    }
    return this.vatTotal!;
  }

  setVATtotal(vat: Decimal): this {
    this.vatTotal = vat;
    return this;
  }

  getCalculation(): TransactionCalculator | null {
    return this.tc;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): CalculatedInvoice {
    const ci = new CalculatedInvoice();
    Invoice._populateFromJSON(ci, data);
    if (data.lineTotalAmount != null) ci.setLineTotalAmount(new Big(data.lineTotalAmount));
    if (data.grandTotal != null) ci.setGrandTotal(new Big(data.grandTotal));
    if (data.taxBasis != null) ci.setTaxBasis(new Big(data.taxBasis));
    if (data.duePayable != null) ci.setDuePayable(new Big(data.duePayable));
    if (data.vatTotal != null) ci.setVATtotal(new Big(data.vatTotal));
    return ci;
  }
}
