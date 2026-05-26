import { Big, ZERO, type Decimal } from '../decimal.js';
import type { ExportableTransaction } from '../interfaces/exportable-transaction.js';
import type { ExportableItem } from '../interfaces/exportable-item.js';
import type { AllowanceCharge } from '../interfaces/allowance-charge.js';
import { TradeParty } from './trade-party.js';
import { Item } from './item.js';
import { Charge } from './charge.js';
import { Allowance } from './allowance.js';
import { ReferencedDocument } from './referenced-document.js';
import { DocumentCodeType } from '../constants/document-code-type.js';

export class Invoice implements ExportableTransaction {
  protected documentName: string | null = null;
  protected documentCode: string | null = null;
  protected number: string | null = null;
  protected currency: string = 'EUR';
  protected issueDate: Date | null = null;
  protected dueDate: Date | null = null;
  protected deliveryDate: Date | null = null;
  protected sender: TradeParty | null = null;
  protected recipient: TradeParty | null = null;
  protected items: ExportableItem[] = [];
  protected allowances: AllowanceCharge[] = [];
  protected charges: AllowanceCharge[] = [];
  protected totalPrepaidAmount: Decimal | null = null;
  protected roundingAmount: Decimal | null = null;
  protected detailedDeliveryDateStart: Date | null = null;
  protected detailedDeliveryPeriodEnd: Date | null = null;
  protected referenceNumber: string | null = null;
  protected paymentTermDescription: string | null = null;
  protected contractReferencedDocument: string | null = null;
  protected buyerOrderReferencedDocumentID: string | null = null;
  protected sellerOrderReferencedDocumentID: string | null = null;
  protected invoiceReferencedDocumentID: string | null = null;
  protected vatDueDateTypeCode: string | null = null;
  protected deliveryAddress: TradeParty | null = null;
  protected payee: TradeParty | null = null;
  protected testIndicator: boolean = false;
  protected businessProcessId: string | null = null;
  protected objectIdentifierReferencedDocument: ReferencedDocument | null = null;

  constructor() {}

  setDocumentName(documentName: string): this {
    this.documentName = documentName;
    return this;
  }

  setDocumentCode(documentCode: string): this {
    this.documentCode = documentCode;
    return this;
  }

  setNumber(number: string): this {
    this.number = number;
    return this;
  }

  setCurrency(currency: string): this {
    this.currency = currency;
    return this;
  }

  setIssueDate(date: Date): this {
    this.issueDate = date;
    return this;
  }

  setDueDate(date: Date): this {
    this.dueDate = date;
    return this;
  }

  setDeliveryDate(date: Date): this {
    this.deliveryDate = date;
    return this;
  }

  setSender(sender: TradeParty): this {
    this.sender = sender;
    return this;
  }

  setRecipient(recipient: TradeParty): this {
    this.recipient = recipient;
    return this;
  }

  addItem(item: ExportableItem): this {
    this.items.push(item);
    return this;
  }

  addCharge(charge: AllowanceCharge): this {
    this.charges.push(charge);
    return this;
  }

  addAllowance(allowance: AllowanceCharge): this {
    this.allowances.push(allowance);
    return this;
  }

  setTotalPrepaidAmount(prepaid: Decimal | null): this {
    this.totalPrepaidAmount = prepaid;
    return this;
  }

  setRoundingAmount(amount: Decimal): this {
    this.roundingAmount = amount;
    return this;
  }

  setDetailedDeliveryPeriod(start: Date, end: Date): this {
    this.detailedDeliveryDateStart = start;
    this.detailedDeliveryPeriodEnd = end;
    return this;
  }

  setReferenceNumber(ref: string): this {
    this.referenceNumber = ref;
    return this;
  }

  setPaymentTermDescription(desc: string): this {
    this.paymentTermDescription = desc;
    return this;
  }

  setContractReferencedDocument(s: string): this {
    this.contractReferencedDocument = s;
    return this;
  }

  setBuyerOrderReferencedDocumentID(id: string): this {
    this.buyerOrderReferencedDocumentID = id;
    return this;
  }

  setSellerOrderReferencedDocumentID(id: string): this {
    this.sellerOrderReferencedDocumentID = id;
    return this;
  }

  setInvoiceReferencedDocumentID(id: string): this {
    this.invoiceReferencedDocumentID = id;
    return this;
  }

  setCorrection(number: string): this {
    this.setInvoiceReferencedDocumentID(number);
    this.documentCode = DocumentCodeType.CORRECTEDINVOICE;
    return this;
  }

  setCreditNote(): this {
    this.documentCode = DocumentCodeType.CREDITNOTE;
    return this;
  }

  setVATDueDateTypeCode(code: string): this {
    this.vatDueDateTypeCode = code;
    return this;
  }

  setDeliveryAddress(addr: TradeParty): this {
    this.deliveryAddress = addr;
    return this;
  }

  setPayee(payee: TradeParty): this {
    this.payee = payee;
    return this;
  }

  setTestIndicator(value: boolean = true): this {
    this.testIndicator = value;
    return this;
  }

  setBusinessProcessId(id: string): this {
    this.businessProcessId = id;
    return this;
  }

  setObjectIdentifierReferencedDocument(
    docOrId: ReferencedDocument | string,
    referenceTypeCode?: string,
    issueDate?: Date,
  ): this {
    if (docOrId instanceof ReferencedDocument) {
      this.objectIdentifierReferencedDocument = docOrId;
    } else {
      const dr = new ReferencedDocument(docOrId);
      if (referenceTypeCode !== undefined) {
        dr.setReferenceTypeCode(referenceTypeCode);
      }
      if (issueDate !== undefined) {
        dr.setFormattedIssueDateTime(issueDate);
      }
      this.objectIdentifierReferencedDocument = dr;
    }
    return this;
  }

  // Interface implementation

  getDocumentName(): string | null {
    return this.documentName;
  }

  getDocumentCode(): string | null {
    return this.documentCode;
  }

  getNumber(): string | null {
    return this.number;
  }

  getCurrency(): string {
    return this.currency;
  }

  getIssueDate(): Date | null {
    return this.issueDate;
  }

  getDueDate(): Date | null {
    return this.dueDate;
  }

  getDeliveryDate(): Date | null {
    return this.deliveryDate;
  }

  getSender(): TradeParty | null {
    return this.sender;
  }

  getRecipient(): TradeParty | null {
    return this.recipient;
  }

  getZFItems(): ExportableItem[] {
    return this.items;
  }

  getZFAllowances(): AllowanceCharge[] | null {
    if (this.allowances.length === 0) {
      return null;
    }
    return this.allowances;
  }

  getZFCharges(): AllowanceCharge[] | null {
    if (this.charges.length === 0) {
      return null;
    }
    return this.charges;
  }

  getZFLogisticsServiceCharges(): AllowanceCharge[] | null {
    return null;
  }

  getTotalPrepaidAmount(): Decimal | null {
    return this.totalPrepaidAmount;
  }

  getRoundingAmount(): Decimal | null {
    return this.roundingAmount;
  }

  getDetailedDeliveryPeriodFrom(): Date | null {
    return this.detailedDeliveryDateStart;
  }

  getDetailedDeliveryPeriodTo(): Date | null {
    return this.detailedDeliveryPeriodEnd;
  }

  getReferenceNumber(): string | null {
    return this.referenceNumber;
  }

  getPaymentTermDescription(): string | null {
    return this.paymentTermDescription;
  }

  getContractReferencedDocument(): string | null {
    return this.contractReferencedDocument;
  }

  getBuyerOrderReferencedDocumentID(): string | null {
    return this.buyerOrderReferencedDocumentID;
  }

  getSellerOrderReferencedDocumentID(): string | null {
    return this.sellerOrderReferencedDocumentID;
  }

  getInvoiceReferencedDocumentID(): string | null {
    return this.invoiceReferencedDocumentID;
  }

  getVATDueDateTypeCode(): string | null {
    return this.vatDueDateTypeCode;
  }

  getDeliveryAddress(): TradeParty | null {
    return this.deliveryAddress;
  }

  getPayee(): TradeParty | null {
    return this.payee;
  }

  getTestIndicator(): boolean {
    return this.testIndicator;
  }

  getBusinessProcessId(): string | null {
    return this.businessProcessId;
  }

  getObjectIdentifierReferencedDocument(): ReferencedDocument | null {
    return this.objectIdentifierReferencedDocument;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected static _populateFromJSON(invoice: Invoice, data: any): void {
    if (data.number) invoice.setNumber(data.number);
    if (data.currency) invoice.setCurrency(data.currency);
    if (data.documentCode) invoice.setDocumentCode(data.documentCode);
    if (data.documentName) invoice.setDocumentName(data.documentName);
    if (data.issueDate != null) invoice.setIssueDate(Invoice._parseJSONDate(data.issueDate));
    if (data.dueDate != null) invoice.setDueDate(Invoice._parseJSONDate(data.dueDate));
    if (data.deliveryDate != null) invoice.setDeliveryDate(Invoice._parseJSONDate(data.deliveryDate));
    if (data.sender) invoice.setSender(TradeParty.fromJSON(data.sender));
    if (data.recipient) invoice.setRecipient(TradeParty.fromJSON(data.recipient));
    if (data.totalPrepaidAmount != null) invoice.setTotalPrepaidAmount(new Big(data.totalPrepaidAmount));
    if (data.roundingAmount != null) invoice.setRoundingAmount(new Big(data.roundingAmount));
    if (data.paymentTermDescription) invoice.setPaymentTermDescription(data.paymentTermDescription);
    if (data.referenceNumber) invoice.setReferenceNumber(data.referenceNumber);
    if (data.contractReferencedDocument) invoice.setContractReferencedDocument(data.contractReferencedDocument);
    if (data.buyerOrderReferencedDocumentID) invoice.setBuyerOrderReferencedDocumentID(data.buyerOrderReferencedDocumentID);
    if (data.sellerOrderReferencedDocumentID) invoice.setSellerOrderReferencedDocumentID(data.sellerOrderReferencedDocumentID);
    if (data.invoiceReferencedDocumentID) invoice.setInvoiceReferencedDocumentID(data.invoiceReferencedDocumentID);
    if (data.zfitems) {
      for (const item of data.zfitems) {
        invoice.addItem(Item.fromJSON(item));
      }
    }
    if (data.zfcharges) {
      for (const c of data.zfcharges) {
        invoice.addCharge(Charge.fromJSON(c));
      }
    }
    if (data.zfallowances) {
      for (const a of data.zfallowances) {
        invoice.addAllowance(Allowance.fromJSON(a));
      }
    }
    if (data.testIndicator) invoice.setTestIndicator(true);
    if (data.businessProcessId) invoice.setBusinessProcessId(data.businessProcessId);
    if (data.objectIdentifierReferencedDocument) {
      const o = data.objectIdentifierReferencedDocument;
      const dr = new ReferencedDocument(o.issuerAssignedID ?? undefined);
      if (o.typeCode) dr.setTypeCode(o.typeCode);
      if (o.referenceTypeCode) dr.setReferenceTypeCode(o.referenceTypeCode);
      if (o.formattedIssueDateTime != null) {
        dr.setFormattedIssueDateTime(Invoice._parseJSONDate(o.formattedIssueDateTime));
      }
      invoice.setObjectIdentifierReferencedDocument(dr);
    }
  }

  private static _parseJSONDate(value: unknown): Date {
    if (typeof value === 'number') {
      return new Date(value);
    }
    return new Date(value as string);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): Invoice {
    const invoice = new Invoice();
    Invoice._populateFromJSON(invoice, data);
    return invoice;
  }
}
