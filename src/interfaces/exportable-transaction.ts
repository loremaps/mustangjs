import type { Decimal } from '../decimal.js';
import type { ExportableItem } from './exportable-item.js';
import type { AllowanceCharge } from './allowance-charge.js';
import type { TradeParty } from '../model/trade-party.js';
import { ZERO } from '../decimal.js';

export interface ExportableTransaction {
  getDocumentName(): string | null;
  getDocumentCode(): string | null;
  getNumber(): string | null;
  getIssueDate(): Date | null;
  getDueDate(): Date | null;
  getDeliveryDate(): Date | null;
  getCurrency(): string;
  getSender(): TradeParty | null;
  getRecipient(): TradeParty | null;
  getZFItems(): ExportableItem[];
  getZFAllowances(): AllowanceCharge[] | null;
  getZFCharges(): AllowanceCharge[] | null;
  getZFLogisticsServiceCharges(): AllowanceCharge[] | null;
  getTotalPrepaidAmount(): Decimal | null;
  getRoundingAmount(): Decimal | null;
  getVATDueDateTypeCode(): string | null;
  getReferenceNumber(): string | null;
  getPaymentTermDescription(): string | null;
  getContractReferencedDocument(): string | null;
  getBuyerOrderReferencedDocumentID(): string | null;
  getSellerOrderReferencedDocumentID(): string | null;
  getInvoiceReferencedDocumentID(): string | null;
  getDetailedDeliveryPeriodFrom(): Date | null;
  getDetailedDeliveryPeriodTo(): Date | null;
}

export const ExportableTransactionDefaults = {
  getDocumentName(): string {
    return 'RECHNUNG';
  },
  getDocumentCode(): string {
    return '380';
  },
  getCurrency(): string {
    return 'EUR';
  },
  getTotalPrepaidAmount(): Decimal {
    return ZERO;
  },
  getRoundingAmount(): Decimal | null {
    return null;
  },
  getVATDueDateTypeCode(): string | null {
    return null;
  },
};
