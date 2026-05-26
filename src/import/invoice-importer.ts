import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { Big, ZERO, type Decimal } from '../decimal.js';
import { Invoice } from '../model/invoice.js';
import { CalculatedInvoice } from '../model/calculated-invoice.js';
import { Item } from '../model/item.js';
import { Product } from '../model/product.js';
import { TradeParty } from '../model/trade-party.js';
import { Contact } from '../model/contact.js';
import { BankDetails } from '../model/bank-details.js';
import { Charge } from '../model/charge.js';
import { Allowance } from '../model/allowance.js';
import { ReferencedDocument } from '../model/referenced-document.js';
import { Profiles, type Profile } from '../constants/profiles.js';

type EStandard = 'cii' | 'ubl' | 'ubl_creditnote';

/**
 * Imports CII and UBL XML into Invoice objects.
 * Ported from Java ZUGFeRDInvoiceImporter.java (XML-only, no PDF).
 */
export class ZUGFeRDInvoiceImporter {
  private doc: Document | null = null;
  private standard: EStandard | null = null;

  constructor(xml?: string) {
    if (xml) {
      this.fromXML(xml);
    }
  }

  fromXML(xml: string): this {
    this.doc = new DOMParser().parseFromString(xml, 'text/xml');
    this.standard = null;
    return this;
  }

  /**
   * Returns true when the loaded XML looks like a parseable CII/UBL invoice.
   * Mirrors Java ZUGFeRDInvoiceImporter.canParse(): valid XML root, and either
   * SpecifiedExchangedDocumentContext (ZF1) or ExchangedDocumentContext (ZF2/UBL).
   */
  canParse(): boolean {
    if (!this.doc || !this.doc.documentElement) return false;
    try {
      const rootName = this.str('local-name(/*)');
      if (!rootName) return false;
      const hasZF2Context = this.node(
        "//*[local-name()='ExchangedDocumentContext']",
      ) != null;
      const hasZF1Context = this.node(
        "//*[local-name()='SpecifiedExchangedDocumentContext']",
      ) != null;
      return hasZF2Context || hasZF1Context;
    } catch {
      return false;
    }
  }

  getStandard(): EStandard {
    if (this.standard != null) return this.standard;
    if (!this.doc) throw new Error('No XML data loaded');
    const rootNode = this.str("local-name(/*)");
    if (rootNode === 'Invoice') {
      this.standard = 'ubl';
    } else if (rootNode === 'CreditNote') {
      this.standard = 'ubl_creditnote';
    } else {
      this.standard = 'cii';
    }
    return this.standard;
  }

  /**
   * Auto-detect the profile from the XML guideline/customization ID.
   */
  getProfile(): Profile | null {
    if (!this.doc) throw new Error('No XML data loaded');
    if (this.isUBL()) {
      const customizationID = this.str(
        "/*[local-name()='Invoice' or local-name()='CreditNote']/*[local-name()='CustomizationID']",
      );
      return Profiles.getByID(customizationID);
    }
    // CII
    const guidelineID = this.str(
      "//*[local-name()='GuidelineSpecifiedDocumentContextParameter']/*[local-name()='ID']",
    );
    return Profiles.getByID(guidelineID);
  }

  private isUBL(): boolean {
    const s = this.getStandard();
    return s === 'ubl' || s === 'ubl_creditnote';
  }

  extractInto(invoice: Invoice): Invoice {
    if (!this.doc) {
      throw new Error('No XML data loaded');
    }
    if (this.isUBL()) {
      this.extractUBL(invoice);
    } else {
      this.extractCII(invoice);
    }
    return invoice;
  }

  // ── CII extraction ──────────────────────────────────────────────

  private extractCII(invoice: Invoice): void {
    this.extractDocumentFields(invoice);
    this.extractParties(invoice);
    this.extractLineItems(invoice);
    this.extractDocumentAllowancesCharges(invoice);
    this.extractSettlement(invoice);
    this.extractCalculatedAmounts(invoice);
  }

  private str(xp: string, context?: Node): string {
    const result = xpath.select(`string(${xp})`, context ?? this.doc!);
    return typeof result === 'string' ? result.trim() : '';
  }

  private nodes(xp: string, context?: Node): Node[] {
    const result = xpath.select(xp, context ?? this.doc!);
    return Array.isArray(result) ? (result as Node[]) : [];
  }

  private node(xp: string, context?: Node): Node | null {
    const nodes = this.nodes(xp, context);
    return nodes.length > 0 ? nodes[0] : null;
  }

  private extractDocumentFields(invoice: Invoice): void {
    const number = this.str(
      "//*[local-name()='ExchangedDocument']/*[local-name()='ID']",
    );
    if (number) invoice.setNumber(number);

    const name = this.str(
      "//*[local-name()='ExchangedDocument']/*[local-name()='Name']",
    );
    if (name) invoice.setDocumentName(name);

    const typeCode = this.str(
      "//*[local-name()='ExchangedDocument']/*[local-name()='TypeCode']",
    );
    if (typeCode) invoice.setDocumentCode(typeCode);

    const issueDateStr = this.str(
      "//*[local-name()='ExchangedDocument']/*[local-name()='IssueDateTime']/*[local-name()='DateTimeString']",
    );
    if (issueDateStr) invoice.setIssueDate(this.parseDate(issueDateStr));

    const currency = this.str(
      "//*[local-name()='ApplicableHeaderTradeSettlement']/*[local-name()='InvoiceCurrencyCode']",
    );
    if (currency) invoice.setCurrency(currency);
  }

  private extractParties(invoice: Invoice): void {
    const sellerNode = this.node(
      "//*[local-name()='SellerTradeParty']",
    );
    if (sellerNode) {
      invoice.setSender(this.extractTradeParty(sellerNode));
    }

    const buyerNode = this.node(
      "//*[local-name()='BuyerTradeParty']",
    );
    if (buyerNode) {
      invoice.setRecipient(this.extractTradeParty(buyerNode));
    }
  }

  private extractTradeParty(partyNode: Node): TradeParty {
    const name = this.str(
      "./*[local-name()='Name']",
      partyNode,
    );
    const street = this.str(
      "./*[local-name()='PostalTradeAddress']/*[local-name()='LineOne']",
      partyNode,
    );
    const zip = this.str(
      "./*[local-name()='PostalTradeAddress']/*[local-name()='PostcodeCode']",
      partyNode,
    );
    const city = this.str(
      "./*[local-name()='PostalTradeAddress']/*[local-name()='CityName']",
      partyNode,
    );
    const country = this.str(
      "./*[local-name()='PostalTradeAddress']/*[local-name()='CountryID']",
      partyNode,
    );

    const party = new TradeParty(name, street, zip, city, country);

    const id = this.str("./*[local-name()='ID']", partyNode);
    if (id) party.setID(id);

    // Tax registration
    const taxRegNodes = this.nodes(
      "./*[local-name()='SpecifiedTaxRegistration']",
      partyNode,
    );
    for (const taxReg of taxRegNodes) {
      const taxId = this.str("./*[local-name()='ID']", taxReg);
      const schemeId = this.str(
        "./*[local-name()='ID']/@schemeID",
        taxReg,
      );
      if (schemeId === 'VA') {
        party.addVATID(taxId);
      } else if (schemeId === 'FC') {
        party.addTaxID(taxId);
      }
    }

    return party;
  }

  private extractLineItems(invoice: Invoice): void {
    const lineItems = this.nodes(
      "//*[local-name()='IncludedSupplyChainTradeLineItem']",
    );
    for (const lineItem of lineItems) {
      invoice.addItem(this.extractItem(lineItem));
    }
  }

  private extractItem(lineNode: Node): Item {
    const productNode = this.node(
      "./*[local-name()='SpecifiedTradeProduct']",
      lineNode,
    );
    const product = new Product();

    if (productNode) {
      const name = this.str(
        "./*[local-name()='Name']",
        productNode,
      );
      if (name) product.setName(name);

      const desc = this.str(
        "./*[local-name()='Description']",
        productNode,
      );
      if (desc) product.setDescription(desc);

      const sellerAssignedID = this.str(
        "./*[local-name()='SellerAssignedID']",
        productNode,
      );
      if (sellerAssignedID) product.setSellerAssignedID(sellerAssignedID);

      const buyerAssignedID = this.str(
        "./*[local-name()='BuyerAssignedID']",
        productNode,
      );
      if (buyerAssignedID) product.setBuyerAssignedID(buyerAssignedID);

      const countryOfOrigin = this.str(
        "./*[local-name()='OriginTradeCountry']/*[local-name()='ID']",
        productNode,
      );
      if (countryOfOrigin) product.setCountryOfOrigin(countryOfOrigin);

      // Product characteristics/attributes
      const charNodes = this.nodes(
        "./*[local-name()='ApplicableProductCharacteristic']",
        productNode,
      );
      for (const charNode of charNodes) {
        const charDesc = this.str(
          "./*[local-name()='Description']",
          charNode,
        );
        const charVal = this.str(
          "./*[local-name()='Value']",
          charNode,
        );
        if (charDesc && charVal) {
          product.addAttribute(charDesc, charVal);
        }
      }
    }

    // VAT percent from line settlement
    const vatPercent = this.str(
      ".//*[local-name()='ApplicableTradeTax']/*[local-name()='RateApplicablePercent']",
      lineNode,
    );
    if (vatPercent) {
      product.setVATPercent(new Big(vatPercent));
    }

    // Tax category code
    const categoryCode = this.str(
      ".//*[local-name()='ApplicableTradeTax']/*[local-name()='CategoryCode']",
      lineNode,
    );
    if (categoryCode) {
      product.setTaxCategoryCode(categoryCode);
    }

    // Tax exemption reason
    const exemptionReason = this.str(
      ".//*[local-name()='ApplicableTradeTax']/*[local-name()='ExemptionReason']",
      lineNode,
    );
    if (exemptionReason) {
      product.setTaxExemptionReason(exemptionReason);
    }
    const exemptionReasonCode = this.str(
      ".//*[local-name()='ApplicableTradeTax']/*[local-name()='ExemptionReasonCode']",
      lineNode,
    );
    if (exemptionReasonCode) {
      product.setTaxExemptionReasonCode(exemptionReasonCode);
    }

    // Unit from BilledQuantity
    const unitCode = this.str(
      ".//*[local-name()='BilledQuantity']/@unitCode",
      lineNode,
    );
    if (unitCode) product.setUnit(unitCode);

    // Price (net)
    const priceStr = this.str(
      ".//*[local-name()='NetPriceProductTradePrice']/*[local-name()='ChargeAmount']",
      lineNode,
    );
    const price = priceStr ? new Big(priceStr) : ZERO;

    // Quantity
    const quantityStr = this.str(
      ".//*[local-name()='BilledQuantity']",
      lineNode,
    );
    const quantity = quantityStr ? new Big(quantityStr) : ZERO;

    // Basis Quantity
    const basisQuantityStr = this.str(
      ".//*[local-name()='NetPriceProductTradePrice']/*[local-name()='BasisQuantity']",
      lineNode,
    );

    const item = new Item(product, price, quantity);

    if (basisQuantityStr && basisQuantityStr !== '0') {
      item.setBasisQuantity(new Big(basisQuantityStr));
    }

    // Line ID
    const lineId = this.str(
      "./*[local-name()='AssociatedDocumentLineDocument']/*[local-name()='LineID']",
      lineNode,
    );
    if (lineId) item.setId(lineId);

    const parentLineId = this.str(
      "./*[local-name()='AssociatedDocumentLineDocument']/*[local-name()='ParentLineID']",
      lineNode,
    );
    if (parentLineId) item.setParentLineID(parentLineId);

    const lineStatusReasonCode = this.str(
      "./*[local-name()='AssociatedDocumentLineDocument']/*[local-name()='LineStatusReasonCode']",
      lineNode,
    );
    if (lineStatusReasonCode) item.setLineStatusReasonCode(lineStatusReasonCode);

    // Item-level allowances and charges
    const acNodes = this.nodes(
      "./*[local-name()='SpecifiedLineTradeSettlement']/*[local-name()='SpecifiedTradeAllowanceCharge']",
      lineNode,
    );
    for (const acNode of acNodes) {
      this.extractAllowanceCharge(acNode, item);
    }

    return item;
  }

  private extractAllowanceCharge(
    acNode: Node,
    target: { addCharge(c: Charge): any; addAllowance(a: Allowance): any },
    isDocLevel: boolean = false,
    isUBLFormat: boolean = false,
  ): void {
    let isCharge: boolean;
    if (isUBLFormat) {
      // UBL: ChargeIndicator is a direct boolean text node
      const indicator = this.str(
        "./*[local-name()='ChargeIndicator']",
        acNode,
      );
      isCharge = indicator === 'true';
    } else {
      // CII: nested Indicator element
      const indicator = this.str(
        ".//*[local-name()='ChargeIndicator']/*[local-name()='Indicator']",
        acNode,
      );
      isCharge = indicator === 'true';
    }

    const amount = this.str(
      "./*[local-name()='ActualAmount'] | ./*[local-name()='Amount']",
      acNode,
    );
    const percent = this.str(
      "./*[local-name()='CalculationPercent']",
      acNode,
    );
    const reason = this.str(
      "./*[local-name()='Reason'] | ./*[local-name()='AllowanceChargeReason']",
      acNode,
    );
    const reasonCode = this.str(
      "./*[local-name()='ReasonCode'] | ./*[local-name()='AllowanceChargeReasonCode']",
      acNode,
    );

    // Tax info from CategoryTradeTax (CII) or TaxCategory (UBL)
    let taxPercent = '';
    let catCode = '';
    if (isDocLevel) {
      taxPercent = this.str(
        ".//*[local-name()='CategoryTradeTax' or local-name()='TaxCategory']/*[local-name()='RateApplicablePercent' or local-name()='Percent']",
        acNode,
      );
      catCode = this.str(
        ".//*[local-name()='CategoryTradeTax' or local-name()='TaxCategory']/*[local-name()='CategoryCode' or local-name()='ID']",
        acNode,
      );
    }

    if (isCharge) {
      const charge = amount ? new Charge(new Big(amount)) : new Charge();
      if (percent) charge.setPercent(new Big(percent));
      if (reason) charge.setReason(reason);
      if (reasonCode) charge.setReasonCode(reasonCode);
      if (taxPercent) charge.setTaxPercent(new Big(taxPercent));
      if (catCode) charge.setCategoryCode(catCode);
      target.addCharge(charge);
    } else {
      const allowance = amount
        ? new Allowance(new Big(amount))
        : new Allowance();
      if (percent) allowance.setPercent(new Big(percent));
      if (reason) allowance.setReason(reason);
      if (reasonCode) allowance.setReasonCode(reasonCode);
      if (taxPercent) allowance.setTaxPercent(new Big(taxPercent));
      if (catCode) allowance.setCategoryCode(catCode);
      target.addAllowance(allowance);
    }
  }

  private extractDocumentAllowancesCharges(invoice: Invoice): void {
    const acNodes = this.nodes(
      "//*[local-name()='ApplicableHeaderTradeSettlement']/*[local-name()='SpecifiedTradeAllowanceCharge']",
    );
    for (const acNode of acNodes) {
      this.extractAllowanceCharge(acNode, invoice, true);
    }
  }

  private extractSettlement(invoice: Invoice): void {
    // Delivery date
    const deliveryDate = this.str(
      "//*[local-name()='ActualDeliverySupplyChainEvent']/*[local-name()='OccurrenceDateTime']/*[local-name()='DateTimeString']",
    );
    if (deliveryDate) invoice.setDeliveryDate(this.parseDate(deliveryDate));

    // Due date (first payment terms)
    const dueDate = this.str(
      "//*[local-name()='SpecifiedTradePaymentTerms']/*[local-name()='DueDateDateTime']/*[local-name()='DateTimeString']",
    );
    if (dueDate) invoice.setDueDate(this.parseDate(dueDate));

    // Payment term description
    const paymentDesc = this.str(
      "//*[local-name()='SpecifiedTradePaymentTerms']/*[local-name()='Description']",
    );
    if (paymentDesc) invoice.setPaymentTermDescription(paymentDesc);

    // Billing period
    const periodStart = this.str(
      "//*[local-name()='BillingSpecifiedPeriod']/*[local-name()='StartDateTime']/*[local-name()='DateTimeString']",
    );
    const periodEnd = this.str(
      "//*[local-name()='BillingSpecifiedPeriod']/*[local-name()='EndDateTime']/*[local-name()='DateTimeString']",
    );
    if (periodStart && periodEnd) {
      invoice.setDetailedDeliveryPeriod(
        this.parseDate(periodStart),
        this.parseDate(periodEnd),
      );
    }

    // Prepaid amount
    const prepaid = this.str(
      "//*[local-name()='SpecifiedTradeSettlementHeaderMonetarySummation']/*[local-name()='TotalPrepaidAmount']",
    );
    if (prepaid) invoice.setTotalPrepaidAmount(new Big(prepaid));

    // Order references
    const buyerOrder = this.str(
      "//*[local-name()='ApplicableHeaderTradeAgreement']/*[local-name()='BuyerOrderReferencedDocument']/*[local-name()='IssuerAssignedID']",
    );
    if (buyerOrder) invoice.setBuyerOrderReferencedDocumentID(buyerOrder);

    const sellerOrder = this.str(
      "//*[local-name()='ApplicableHeaderTradeAgreement']/*[local-name()='SellerOrderReferencedDocument']/*[local-name()='IssuerAssignedID']",
    );
    if (sellerOrder) invoice.setSellerOrderReferencedDocumentID(sellerOrder);

    // BT-18 Invoiced object identifier (TypeCode 130)
    const additionalRefNodes = this.nodes(
      "//*[local-name()='ApplicableHeaderTradeAgreement']/*[local-name()='AdditionalReferencedDocument']",
    );
    for (const refNode of additionalRefNodes) {
      const typeCode = this.str("./*[local-name()='TypeCode']", refNode);
      if (typeCode !== '130') continue;
      const id = this.str("./*[local-name()='IssuerAssignedID']", refNode);
      if (!id) continue;
      const doc = new ReferencedDocument(id);
      doc.setTypeCode('130');
      const refTypeCode = this.str("./*[local-name()='ReferenceTypeCode']", refNode);
      if (refTypeCode) doc.setReferenceTypeCode(refTypeCode);
      const issueDateStr = this.str(
        "./*[local-name()='FormattedIssueDateTime']/*[local-name()='DateTimeString']",
        refNode,
      );
      if (issueDateStr) doc.setFormattedIssueDateTime(this.parseDate(issueDateStr));
      invoice.setObjectIdentifierReferencedDocument(doc);
      break;
    }
  }

  private extractCalculatedAmounts(invoice: Invoice): void {
    if (!(invoice instanceof CalculatedInvoice)) return;
    const ci = invoice;

    const grandTotal = this.str(
      "//*[local-name()='SpecifiedTradeSettlementHeaderMonetarySummation']/*[local-name()='GrandTotalAmount']",
    );
    if (grandTotal) ci.setGrandTotal(new Big(grandTotal));

    const taxBasis = this.str(
      "//*[local-name()='SpecifiedTradeSettlementHeaderMonetarySummation']/*[local-name()='TaxBasisTotalAmount']",
    );
    if (taxBasis) ci.setTaxBasis(new Big(taxBasis));

    const lineTotal = this.str(
      "//*[local-name()='SpecifiedTradeSettlementHeaderMonetarySummation']/*[local-name()='LineTotalAmount']",
    );
    if (lineTotal) ci.setLineTotalAmount(new Big(lineTotal));

    const duePayable = this.str(
      "//*[local-name()='SpecifiedTradeSettlementHeaderMonetarySummation']/*[local-name()='DuePayableAmount']",
    );
    if (duePayable) ci.setDuePayable(new Big(duePayable));

    const taxTotal = this.str(
      "//*[local-name()='SpecifiedTradeSettlementHeaderMonetarySummation']/*[local-name()='TaxTotalAmount']",
    );
    if (taxTotal) ci.setVATtotal(new Big(taxTotal));
  }

  // ── UBL extraction ──────────────────────────────────────────────

  private extractUBL(invoice: Invoice): void {
    const isCreditNote = this.getStandard() === 'ubl_creditnote';
    const rootLocal = isCreditNote ? 'CreditNote' : 'Invoice';

    // Document fields
    const number = this.str(`/*[local-name()='${rootLocal}']/*[local-name()='ID']`);
    if (number) invoice.setNumber(number);

    const typeCode = isCreditNote
      ? this.str(`/*[local-name()='CreditNote']/*[local-name()='CreditNoteTypeCode']`)
      : this.str(`/*[local-name()='Invoice']/*[local-name()='InvoiceTypeCode']`);
    if (typeCode) invoice.setDocumentCode(typeCode);

    const issueDate = this.str(`/*[local-name()='${rootLocal}']/*[local-name()='IssueDate']`);
    if (issueDate) invoice.setIssueDate(this.parseDate(issueDate));

    const currency = this.str(`/*[local-name()='${rootLocal}']/*[local-name()='DocumentCurrencyCode']`);
    if (currency) invoice.setCurrency(currency);

    // Buyer reference
    const buyerRef = this.str(`/*[local-name()='${rootLocal}']/*[local-name()='BuyerReference']`);
    if (buyerRef) invoice.setReferenceNumber(buyerRef);

    // Order reference
    const orderRef = this.str(`//*[local-name()='OrderReference']/*[local-name()='ID']`);
    if (orderRef) invoice.setBuyerOrderReferencedDocumentID(orderRef);

    // Contract reference
    const contractRef = this.str(`//*[local-name()='ContractDocumentReference']/*[local-name()='ID']`);
    if (contractRef) invoice.setContractReferencedDocument(contractRef);

    // Due date
    const dueDate = this.str(
      `/*[local-name()='${rootLocal}']/*[local-name()='DueDate']` +
      ` | //*[local-name()='PaymentMeans']/*[local-name()='PaymentDueDate']`
    );
    if (dueDate) invoice.setDueDate(this.parseDate(dueDate));

    // Payment terms
    const paymentTerms = this.str(
      `/*[local-name()='${rootLocal}']/*[local-name()='PaymentTerms']/*[local-name()='Note']`
    );
    if (paymentTerms) invoice.setPaymentTermDescription(paymentTerms);

    // Invoice period
    const periodStart = this.str(`/*[local-name()='${rootLocal}']/*[local-name()='InvoicePeriod']/*[local-name()='StartDate']`);
    const periodEnd = this.str(`/*[local-name()='${rootLocal}']/*[local-name()='InvoicePeriod']/*[local-name()='EndDate']`);
    if (periodStart && periodEnd) {
      invoice.setDetailedDeliveryPeriod(
        this.parseDate(periodStart),
        this.parseDate(periodEnd),
      );
    }

    // Delivery date
    const deliveryDate = this.str("//*[local-name()='Delivery']/*[local-name()='ActualDeliveryDate']");
    if (deliveryDate) invoice.setDeliveryDate(this.parseDate(deliveryDate));

    // Parties
    const sellerNode = this.node("//*[local-name()='AccountingSupplierParty']/*[local-name()='Party']");
    if (sellerNode) {
      invoice.setSender(this.extractUBLParty(sellerNode));
    }

    const buyerNode = this.node("//*[local-name()='AccountingCustomerParty']/*[local-name()='Party']");
    if (buyerNode) {
      invoice.setRecipient(this.extractUBLParty(buyerNode));
    }

    // Bank details (PayeeFinancialAccount is under PaymentMeans, not under a party)
    const sender = invoice.getSender();
    if (sender) {
      const finAccountNodes = this.nodes("//*[local-name()='PaymentMeans']/*[local-name()='PayeeFinancialAccount']");
      for (const faNode of finAccountNodes) {
        const iban = this.str("./*[local-name()='ID']", faNode);
        const bic = this.str("./*[local-name()='FinancialInstitutionBranch']/*[local-name()='ID']", faNode);
        if (iban) {
          sender.addBankDetails(new BankDetails(iban, bic || undefined));
        }
      }
    }

    // Line items
    const lineTag = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine';
    const lineItems = this.nodes(`//*[local-name()='${lineTag}']`);
    for (const lineItem of lineItems) {
      invoice.addItem(this.extractUBLItem(lineItem, isCreditNote));
    }

    // Document-level allowances/charges
    // Select only top-level AllowanceCharge (not inside line items)
    const acNodes = this.nodes(`/*[local-name()='${rootLocal}']/*[local-name()='AllowanceCharge']`);
    for (const acNode of acNodes) {
      this.extractAllowanceCharge(acNode, invoice, true, true);
    }

    // Monetary totals
    const prepaid = this.str("//*[local-name()='LegalMonetaryTotal']/*[local-name()='PrepaidAmount']");
    if (prepaid) invoice.setTotalPrepaidAmount(new Big(prepaid));

    // Calculated amounts
    if (invoice instanceof CalculatedInvoice) {
      const grandTotal = this.str("//*[local-name()='LegalMonetaryTotal']/*[local-name()='TaxInclusiveAmount']");
      if (grandTotal) invoice.setGrandTotal(new Big(grandTotal));

      const taxBasis = this.str("//*[local-name()='LegalMonetaryTotal']/*[local-name()='TaxExclusiveAmount']");
      if (taxBasis) invoice.setTaxBasis(new Big(taxBasis));

      const lineTotal = this.str("//*[local-name()='LegalMonetaryTotal']/*[local-name()='LineExtensionAmount']");
      if (lineTotal) invoice.setLineTotalAmount(new Big(lineTotal));

      const duePayable = this.str("//*[local-name()='LegalMonetaryTotal']/*[local-name()='PayableAmount']");
      if (duePayable) invoice.setDuePayable(new Big(duePayable));

      const taxTotal = this.str("//*[local-name()='TaxTotal']/*[local-name()='TaxAmount']");
      if (taxTotal) invoice.setVATtotal(new Big(taxTotal));
    }
  }

  private extractUBLParty(partyNode: Node): TradeParty {
    // Name: try PartyName/Name first, then PartyLegalEntity/RegistrationName
    const name = this.str("./*[local-name()='PartyName']/*[local-name()='Name']", partyNode)
      || this.str("./*[local-name()='PartyLegalEntity']/*[local-name()='RegistrationName']", partyNode);

    const street = this.str(
      "./*[local-name()='PostalAddress']/*[local-name()='StreetName']",
      partyNode,
    );
    const zip = this.str(
      "./*[local-name()='PostalAddress']/*[local-name()='PostalZone']",
      partyNode,
    );
    const city = this.str(
      "./*[local-name()='PostalAddress']/*[local-name()='CityName']",
      partyNode,
    );
    const country = this.str(
      "./*[local-name()='PostalAddress']/*[local-name()='Country']/*[local-name()='IdentificationCode']",
      partyNode,
    );

    const party = new TradeParty(
      name || undefined,
      street || undefined,
      zip || undefined,
      city || undefined,
      country || undefined,
    );

    // Party ID
    const id = this.str("./*[local-name()='PartyIdentification']/*[local-name()='ID']", partyNode);
    if (id) party.setID(id);

    // Tax registration
    const taxSchemeNodes = this.nodes("./*[local-name()='PartyTaxScheme']", partyNode);
    for (const tsNode of taxSchemeNodes) {
      const companyId = this.str("./*[local-name()='CompanyID']", tsNode);
      const schemeId = this.str("./*[local-name()='TaxScheme']/*[local-name()='ID']", tsNode);
      if (schemeId === 'VAT') {
        party.addVATID(companyId);
      } else if (schemeId === 'FC') {
        party.addTaxID(companyId);
      }
    }

    // Contact
    const contactNode = this.node("./*[local-name()='Contact']", partyNode);
    if (contactNode) {
      const contactName = this.str("./*[local-name()='Name']", contactNode);
      const phone = this.str("./*[local-name()='Telephone']", contactNode);
      const email = this.str("./*[local-name()='ElectronicMail']", contactNode);
      const fax = this.str("./*[local-name()='Telefax']", contactNode);
      const contact = new Contact(
        contactName || undefined,
        phone || undefined,
        email || undefined,
      );
      if (fax) contact.setFax(fax);
      party.setContact(contact);
    }

    return party;
  }

  private extractUBLItem(lineNode: Node, isCreditNote: boolean): Item {
    const product = new Product();

    const itemNode = this.node("./*[local-name()='Item']", lineNode);
    if (itemNode) {
      const name = this.str("./*[local-name()='Name']", itemNode);
      if (name) product.setName(name);

      const desc = this.str("./*[local-name()='Description']", itemNode);
      if (desc) product.setDescription(desc);

      const sellerID = this.str(
        "./*[local-name()='SellersItemIdentification']/*[local-name()='ID']",
        itemNode,
      );
      if (sellerID) product.setSellerAssignedID(sellerID);

      const buyerID = this.str(
        "./*[local-name()='BuyersItemIdentification']/*[local-name()='ID']",
        itemNode,
      );
      if (buyerID) product.setBuyerAssignedID(buyerID);

      // Tax category (ClassifiedTaxCategory)
      const taxCatNode = this.node(
        ".//*[local-name()='ClassifiedTaxCategory']",
        itemNode,
      );
      if (taxCatNode) {
        const catId = this.str("./*[local-name()='ID']", taxCatNode);
        if (catId) product.setTaxCategoryCode(catId);

        const percent = this.str("./*[local-name()='Percent']", taxCatNode);
        if (percent) product.setVATPercent(new Big(percent));

        const exemptionReason = this.str(
          "./*[local-name()='TaxExemptionReason']",
          taxCatNode,
        );
        if (exemptionReason) product.setTaxExemptionReason(exemptionReason);

        const exemptionReasonCode = this.str(
          "./*[local-name()='TaxExemptionReasonCode']",
          taxCatNode,
        );
        if (exemptionReasonCode) product.setTaxExemptionReasonCode(exemptionReasonCode);
      }

      // Additional item properties (attributes)
      const propNodes = this.nodes(
        "./*[local-name()='AdditionalItemProperty']",
        itemNode,
      );
      for (const propNode of propNodes) {
        const propName = this.str("./*[local-name()='Name']", propNode);
        const propValue = this.str("./*[local-name()='Value']", propNode);
        if (propName && propValue) {
          product.addAttribute(propName, propValue);
        }
      }
    }

    // Quantity
    const qtyTag = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity';
    const quantityStr = this.str(`./*[local-name()='${qtyTag}']`, lineNode);
    const quantity = quantityStr ? new Big(quantityStr) : ZERO;

    // Unit from quantity
    const unitCode = this.str(`./*[local-name()='${qtyTag}']/@unitCode`, lineNode);
    if (unitCode) product.setUnit(unitCode);

    // Price
    const priceStr = this.str(
      "./*[local-name()='Price']/*[local-name()='PriceAmount']",
      lineNode,
    );
    const price = priceStr ? new Big(priceStr) : ZERO;

    // Base quantity
    const baseQty = this.str(
      "./*[local-name()='Price']/*[local-name()='BaseQuantity']",
      lineNode,
    );

    const item = new Item(product, price, quantity);

    if (baseQty && baseQty !== '0') {
      item.setBasisQuantity(new Big(baseQty));
    }

    // Line ID
    const lineId = this.str("./*[local-name()='ID']", lineNode);
    if (lineId) item.setId(lineId);

    return item;
  }

  // ── Date parsing ────────────────────────────────────────────────

  private parseDate(dateStr: string): Date {
    // CII format 102: YYYYMMDD
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    }
    // ISO date format: YYYY-MM-DD (UBL)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    // CII format 610: YYYYMM (month precision)
    if (dateStr.length === 6 && /^\d{6}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      return new Date(year, month, 1);
    }
    throw new Error(`Unsupported date format: "${dateStr}". Expected YYYYMMDD, YYYY-MM-DD, or YYYYMM.`);
  }
}
