import { Big, ZERO, type Decimal } from '../decimal.js';
import type { ExportableTransaction } from '../interfaces/exportable-transaction.js';
import type { AllowanceCharge } from '../interfaces/allowance-charge.js';
import type { ValueProvider } from '../interfaces/value-provider.js';
import { LineCalculator } from './line-calculator.js';
import { VATAmount } from '../model/vat-amount.js';
import { TaxCategoryCode } from '../constants/tax-category-code.js';

/**
 * Calculates document-level totals, applies VAT on whole invoices.
 * Ported from Java TransactionCalculator.java
 */
export class TransactionCalculator implements ValueProvider {
  protected trans: ExportableTransaction;

  constructor(trans: ExportableTransaction) {
    this.trans = trans;
  }

  protected getTotalPrepaid(): Decimal {
    if (this.trans.getTotalPrepaidAmount() == null) {
      return ZERO;
    }
    return this.trans.getTotalPrepaidAmount()!.round(2, Big.roundHalfUp);
  }

  /**
   * The invoice total with VAT, allowances and charges, WITHOUT considering prepaid amount.
   */
  getGrandTotal(): Decimal {
    const basis = this.getTaxBasis();
    const vatMap = this.getVATPercentAmountMap();
    let vatTotal = ZERO;
    for (const va of vatMap.values()) {
      vatTotal = vatTotal.plus(va.getCalculated().round(2, Big.roundHalfUp));
    }
    return vatTotal.plus(basis);
  }

  protected getChargesForPercent(percent: Decimal | null): Decimal {
    const charges = this.trans.getZFCharges();
    return this.sumAllowanceCharge(percent, charges);
  }

  private sumAllowanceCharge(
    percent: Decimal | null,
    charges: AllowanceCharge[] | null,
  ): Decimal {
    let res = ZERO;
    if (charges != null) {
      for (const currentCharge of charges) {
        if (
          percent == null ||
          (currentCharge.getTaxPercent() != null &&
            currentCharge.getTaxPercent()!.eq(percent))
        ) {
          res = res.plus(currentCharge.getTotalAmount(this));
        }
      }
    }
    return res;
  }

  protected getAllowancesForPercent(percent: Decimal | null): Decimal {
    const allowances = this.trans.getZFAllowances();
    return this.sumAllowanceCharge(percent, allowances);
  }

  /**
   * Returns the total net value of all items, without document-level charges/allowances.
   * For sub invoice lines, only DETAIL lines are summed, GROUP and INFORMATION lines are ignored.
   */
  getTotal(): Decimal {
    let dec = ZERO;
    for (const item of this.trans.getZFItems()) {
      if (item.isCalculationRelevant()) {
        const lc = new LineCalculator(item);
        dec = dec.plus(lc.getItemTotalNetAmount());
      }
    }
    return dec;
  }

  /**
   * Returns the total net value of the invoice, including charges/allowances on document level.
   */
  getTaxBasis(): Decimal {
    return this.getTotal()
      .plus(
        this.getChargesForPercent(null).round(2, Big.roundHalfUp),
      )
      .minus(
        this.getAllowancesForPercent(null).round(2, Big.roundHalfUp),
      )
      .round(2, Big.roundHalfUp);
  }

  /**
   * VAT percent amount map - which taxes have been used with which amounts.
   */
  protected getVATPercentAmountMap(): Map<string, VATAmount> {
    const hm = new Map<string, VATAmount>();
    const vatDueDateTypeCode = this.trans.getVATDueDateTypeCode();

    for (const currentItem of this.trans.getZFItems()) {
      if (!currentItem.isCalculationRelevant()) {
        continue;
      }

      let percent: Decimal | null = null;
      if (currentItem.getProduct() != null) {
        percent = currentItem.getProduct()!.getVATPercent();
      }

      if (percent != null) {
        const lc = currentItem.getCalculation();
        const itemVATAmount = new VATAmount(
          lc.getItemTotalNetAmount(),
          lc.getItemTotalVATAmount(),
          currentItem.getProduct()!.getTaxCategoryCode(),
          vatDueDateTypeCode ?? undefined,
        );

        const reasonText =
          currentItem.getProduct()!.getTaxExemptionReason();
        if (reasonText != null) {
          itemVATAmount.setVatExemptionReasonText(reasonText);
        }

        const key = percent.toString(); // stripTrailingZeros equivalent
        const current = hm.get(key);
        if (current == null) {
          hm.set(key, itemVATAmount);
        } else {
          hm.set(key, current.add(itemVATAmount));
        }
      }
    }

    // Process document-level charges
    const charges = this.trans.getZFCharges();
    if (charges != null) {
      for (const currentCharge of charges) {
        const taxPercent = currentCharge.getTaxPercent();
        if (taxPercent != null) {
          const key = taxPercent.toString();
          let theAmount = hm.get(key);
          if (theAmount == null) {
            theAmount = new VATAmount(
              ZERO,
              ZERO,
              currentCharge.getCategoryCode() != null
                ? currentCharge.getCategoryCode()
                : 'S',
              vatDueDateTypeCode ?? undefined,
            );
          }
          theAmount.setBasis(
            theAmount.getBasis().plus(currentCharge.getTotalAmount(this)),
          );
          const factor = taxPercent.div(new Big(100));
          theAmount.setCalculated(theAmount.getBasis().times(factor));
          hm.set(key, theAmount);
        }
      }
    }

    // Process document-level allowances
    const allowances = this.trans.getZFAllowances();
    if (allowances != null) {
      for (const currentAllowance of allowances) {
        const taxPercent = currentAllowance.getTaxPercent();
        if (taxPercent != null) {
          const key = taxPercent.toString();
          let theAmount = hm.get(key);
          if (theAmount == null) {
            theAmount = new VATAmount(
              ZERO,
              ZERO,
              currentAllowance.getCategoryCode() != null
                ? currentAllowance.getCategoryCode()
                : 'S',
              vatDueDateTypeCode ?? undefined,
            );
          }
          theAmount.setBasis(
            theAmount
              .getBasis()
              .minus(currentAllowance.getTotalAmount(this)),
          );
          const factor = taxPercent.div(new Big(100));
          theAmount.setCalculated(theAmount.getBasis().times(factor));
          hm.set(key, theAmount);
        }
      }
    }

    return hm;
  }

  /**
   * Returns a list of VATAmount entries grouped by (categoryCode, percent).
   * Used by the pull provider for header-level ApplicableTradeTax entries.
   */
  getVATAmountList(): VATAmount[] {
    const vatAmounts: VATAmount[] = [];
    const vatDueDateTypeCode = this.trans.getVATDueDateTypeCode();

    for (const currentItem of this.trans.getZFItems()) {
      if (!currentItem.isCalculationRelevant()) {
        continue;
      }

      const product = currentItem.getProduct();
      let percent: Decimal | null = product?.getVATPercent() ?? null;
      if (percent == null) {
        percent = ZERO;
      }

      const categoryCode = product?.getTaxCategoryCode() ?? TaxCategoryCode.STANDARDRATE;

      const lc = currentItem.getCalculation();
      const itemVATAmount = new VATAmount(
        lc.getItemTotalNetAmount(),
        lc.getItemTotalVATAmount(),
        categoryCode,
        vatDueDateTypeCode ?? undefined,
        percent,
      );

      const reasonText = product?.getTaxExemptionReason() ?? null;
      if (reasonText != null) {
        itemVATAmount.setVatExemptionReasonText(reasonText);
      }

      const current = this.getCurrentVatAmount(
        vatAmounts,
        categoryCode,
        percent,
      );
      if (current == null) {
        vatAmounts.push(itemVATAmount);
      } else {
        this.mergeAdding(current, itemVATAmount);
      }
    }

    // Document-level charges
    const charges = this.trans.getZFCharges();
    if (charges != null) {
      for (const currentCharge of charges) {
        const taxPercent = currentCharge.getTaxPercent();
        if (taxPercent != null) {
          const vatCategoryCode =
            currentCharge.getCategoryCode() != null
              ? currentCharge.getCategoryCode()
              : 'S';
          const current = this.getCurrentVatAmount(
            vatAmounts,
            vatCategoryCode,
            taxPercent,
          );
          const chargeBasis = currentCharge.getTotalAmount(this);
          const chargeVatAmount = new VATAmount(
            chargeBasis,
            chargeBasis.times(taxPercent.div(new Big(100))),
            vatCategoryCode,
            vatDueDateTypeCode ?? undefined,
            taxPercent,
          );
          if (current == null) {
            vatAmounts.push(chargeVatAmount);
          } else {
            this.mergeAdding(current, chargeVatAmount);
          }
        }
      }
    }

    // Document-level allowances
    const allowances = this.trans.getZFAllowances();
    if (allowances != null) {
      for (const currentAllowance of allowances) {
        const taxPercent = currentAllowance.getTaxPercent();
        if (taxPercent != null) {
          const vatCategoryCode =
            currentAllowance.getCategoryCode() != null
              ? currentAllowance.getCategoryCode()
              : 'S';
          const current = this.getCurrentVatAmount(
            vatAmounts,
            vatCategoryCode,
            taxPercent,
          );
          const allowanceNegativeBasis = currentAllowance
            .getTotalAmount(this)
            .times(new Big(-1));
          const allowanceVATAmount = new VATAmount(
            allowanceNegativeBasis,
            allowanceNegativeBasis.times(taxPercent.div(new Big(100))),
            vatCategoryCode,
            vatDueDateTypeCode ?? undefined,
            taxPercent,
          );
          if (current == null) {
            vatAmounts.push(allowanceVATAmount);
          } else {
            this.mergeAdding(current, allowanceVATAmount);
          }
        }
      }
    }

    return vatAmounts;
  }

  private getCurrentVatAmount(
    vatAmounts: VATAmount[],
    vatCategoryCode: string,
    percentage: Decimal | null,
  ): VATAmount | null {
    for (const va of vatAmounts) {
      if (va.getCategoryCode() === vatCategoryCode) {
        if (percentage == null) {
          if (va.getApplicablePercent() == null) return va;
        } else {
          if (
            va.getApplicablePercent() != null &&
            percentage.eq(va.getApplicablePercent()!)
          ) {
            return va;
          }
        }
      }
    }
    return null;
  }

  private mergeAdding(target: VATAmount, toAdd: VATAmount): void {
    target.setBasis(target.getBasis().plus(toAdd.getBasis()));
    target.setCalculated(target.getCalculated().plus(toAdd.getCalculated()));
    const addText = toAdd.getVatExemptionReasonText();
    if (addText != null && addText.trim().length > 0) {
      const existingText = target.getVatExemptionReasonText();
      if (existingText != null && existingText !== addText) {
        target.setVatExemptionReasonText(`${existingText}, ${addText}`);
      } else {
        target.setVatExemptionReasonText(addText);
      }
    }
  }

  getValue(): Decimal {
    return this.getTotal();
  }

  getQuantity(): Decimal {
    return new Big(1);
  }

  getChargeTotal(): Decimal {
    return this.getChargesForPercent(null).round(2, Big.roundHalfUp);
  }

  getAllowanceTotal(): Decimal {
    return this.getAllowancesForPercent(null).round(2, Big.roundHalfUp);
  }

  getDuePayable(): Decimal {
    let res = this.getGrandTotal().minus(this.getTotalPrepaid());
    if (this.trans.getRoundingAmount() != null) {
      res = res.plus(this.trans.getRoundingAmount()!);
    }
    return res;
  }
}
