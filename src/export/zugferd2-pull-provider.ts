import { Big, ZERO, type Decimal } from '../decimal.js';
import type { ExportableTransaction } from '../interfaces/exportable-transaction.js';
import type { ExportableItem } from '../interfaces/exportable-item.js';
import type { AllowanceCharge } from '../interfaces/allowance-charge.js';
import { Profile, Profiles } from '../constants/profiles.js';
import {
  TaxCategoryCode,
  CATEGORY_CODES_WITH_EXEMPTION_REASON,
} from '../constants/tax-category-code.js';
import { TransactionCalculator } from '../calc/transaction-calculator.js';
import { LineCalculator } from '../calc/line-calculator.js';
import { TradeParty } from '../model/trade-party.js';
import {
  nDigitFormat,
  nDigitFormatDecimalRange,
  encodeXML,
} from '../xml/xml-tools.js';

function vatFormat(value: Decimal): string {
  return nDigitFormat(value, 2);
}

function currencyFormat(value: Decimal): string {
  return nDigitFormat(value, 2);
}

function priceFormat(value: Decimal): string {
  return nDigitFormatDecimalRange(value, 18, 4);
}

function quantityFormat(value: Decimal): string {
  return nDigitFormatDecimalRange(value, 18, 4);
}

function formatDate102(date: Date): string {
  const y = date.getFullYear().toString().padStart(4, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

function udtDateElement(tagName: string, date: Date): string {
  return `<${tagName}><udt:DateTimeString format="102">${formatDate102(date)}</udt:DateTimeString></${tagName}>`;
}

/**
 * Generates CII (CrossIndustryInvoice) XML from an ExportableTransaction.
 * Ported from Java ZUGFeRD2PullProvider.java.
 */
export class ZUGFeRD2PullProvider {
  protected zugferdData: string = '';
  protected profile: Profile = Profiles.getByName('EN16931');

  setProfile(profile: Profile): void {
    this.profile = profile;
  }

  getProfile(): Profile {
    return this.profile;
  }

  generateXML(trans: ExportableTransaction): void {
    const calc = new TransactionCalculator(trans);
    const profileName = this.profile.getName();
    const isMinimum = profileName === 'MINIMUM';
    const isBasicWL = profileName === 'BASICWL';
    const isExtended = profileName === 'EXTENDED';
    const isXRechnung = profileName === 'XRECHNUNG';
    const isEN16931 = profileName === 'EN16931';

    let typecode = '380';
    if (trans.getDocumentCode() != null) {
      typecode = trans.getDocumentCode()!;
    }

    let xml = '';
    xml += '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<rsm:CrossIndustryInvoice';
    xml += ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"';
    xml += ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"';
    xml += ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"';
    xml += ' xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"';
    xml += ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">';

    // ExchangedDocumentContext
    xml += '<rsm:ExchangedDocumentContext>';
    const testIndicator = trans.getTestIndicator?.() ?? false;
    if (testIndicator && isExtended) {
      xml += '<ram:TestIndicator><udt:Indicator>true</udt:Indicator></ram:TestIndicator>';
    }
    const businessProcessId = trans.getBusinessProcessId?.() ?? null;
    if (businessProcessId != null && businessProcessId.trim().length > 0) {
      xml += '<ram:BusinessProcessSpecifiedDocumentContextParameter>';
      xml += `<ram:ID>${encodeXML(businessProcessId)}</ram:ID>`;
      xml += '</ram:BusinessProcessSpecifiedDocumentContextParameter>';
    } else if (isXRechnung) {
      xml += '<ram:BusinessProcessSpecifiedDocumentContextParameter>';
      xml += '<ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>';
      xml += '</ram:BusinessProcessSpecifiedDocumentContextParameter>';
    }
    xml += '<ram:GuidelineSpecifiedDocumentContextParameter>';
    xml += `<ram:ID>${this.profile.getID()}</ram:ID>`;
    xml += '</ram:GuidelineSpecifiedDocumentContextParameter>';
    xml += '</rsm:ExchangedDocumentContext>';

    // ExchangedDocument
    xml += '<rsm:ExchangedDocument>';
    xml += `<ram:ID>${encodeXML(trans.getNumber() ?? '')}</ram:ID>`;
    if (isExtended && trans.getDocumentName() != null) {
      xml += `<ram:Name>${encodeXML(trans.getDocumentName()!)}</ram:Name>`;
    }
    xml += `<ram:TypeCode>${typecode}</ram:TypeCode>`;
    if (trans.getIssueDate() != null) {
      xml += udtDateElement('ram:IssueDateTime', trans.getIssueDate()!);
    }
    xml += '</rsm:ExchangedDocument>';

    // SupplyChainTradeTransaction
    xml += '<rsm:SupplyChainTradeTransaction>';

    // Line items (skip for MINIMUM and BASICWL)
    if (!isMinimum && !isBasicWL) {
      let lineID = 0;
      for (const currentItem of trans.getZFItems()) {
        lineID++;
        const lc = new LineCalculator(currentItem);
        xml += '<ram:IncludedSupplyChainTradeLineItem>';
        xml += '<ram:AssociatedDocumentLineDocument>';
        xml += `<ram:LineID>${currentItem.getId() ?? lineID}</ram:LineID>`;
        if (isExtended) {
          const parentLineID = (currentItem as { getParentLineID?(): string | null }).getParentLineID?.();
          if (parentLineID != null) {
            xml += `<ram:ParentLineID>${encodeXML(parentLineID)}</ram:ParentLineID>`;
          }
          const lineStatusReasonCode = (currentItem as { getLineStatusReasonCode?(): string | null }).getLineStatusReasonCode?.();
          if (lineStatusReasonCode != null) {
            xml += `<ram:LineStatusReasonCode>${encodeXML(lineStatusReasonCode)}</ram:LineStatusReasonCode>`;
          }
        }
        xml += '</ram:AssociatedDocumentLineDocument>';

        // Product
        xml += '<ram:SpecifiedTradeProduct>';
        const product = currentItem.getProduct();
        if (product != null) {
          if (product.getGlobalID() != null) {
            xml += `<ram:GlobalID schemeID="${product.getGlobalIDScheme() ?? ''}">${encodeXML(product.getGlobalID()!)}</ram:GlobalID>`;
          }
          if (product.getSellerAssignedID() != null) {
            xml += `<ram:SellerAssignedID>${encodeXML(product.getSellerAssignedID()!)}</ram:SellerAssignedID>`;
          }
          if (product.getBuyerAssignedID() != null) {
            xml += `<ram:BuyerAssignedID>${encodeXML(product.getBuyerAssignedID()!)}</ram:BuyerAssignedID>`;
          }
          xml += `<ram:Name>${encodeXML(product.getName() ?? '')}</ram:Name>`;
          if (product.getDescription() && product.getDescription().length > 0) {
            xml += `<ram:Description>${encodeXML(product.getDescription())}</ram:Description>`;
          }
          // Attributes
          const attrs = product.getAttributes();
          if (attrs != null) {
            for (const [key, value] of attrs) {
              xml += '<ram:ApplicableProductCharacteristic>';
              xml += `<ram:Description>${encodeXML(key)}</ram:Description>`;
              xml += `<ram:Value>${encodeXML(value)}</ram:Value>`;
              xml += '</ram:ApplicableProductCharacteristic>';
            }
          }
          if (product.getCountryOfOrigin() != null) {
            xml += '<ram:OriginTradeCountry>';
            xml += `<ram:ID>${product.getCountryOfOrigin()}</ram:ID>`;
            xml += '</ram:OriginTradeCountry>';
          }
        }
        xml += '</ram:SpecifiedTradeProduct>';

        // Line trade agreement
        xml += '<ram:SpecifiedLineTradeAgreement>';

        // Gross price (if product has allowances/charges)
        const hasProductAllowancesCharges =
          (product?.getAllowances() != null) || (product?.getCharges() != null);
        if (hasProductAllowancesCharges) {
          xml += '<ram:GrossPriceProductTradePrice>';
          xml += `<ram:ChargeAmount>${priceFormat(lc.getPriceGross())}</ram:ChargeAmount>`;
          xml += `<ram:BasisQuantity unitCode="${encodeXML(product?.getUnit() ?? 'C62')}">${quantityFormat(currentItem.getBasisQuantity())}</ram:BasisQuantity>`;
          if (product?.getAllowances() != null) {
            for (const a of product!.getAllowances()!) {
              xml += this.getAllowanceChargeStr(a, currentItem);
            }
          }
          if (product?.getCharges() != null) {
            for (const c of product!.getCharges()!) {
              xml += this.getAllowanceChargeStr(c, currentItem);
            }
          }
          xml += '</ram:GrossPriceProductTradePrice>';
        }

        // Net price
        xml += '<ram:NetPriceProductTradePrice>';
        xml += `<ram:ChargeAmount>${priceFormat(lc.getPrice())}</ram:ChargeAmount>`;
        xml += `<ram:BasisQuantity unitCode="${encodeXML(product?.getUnit() ?? 'C62')}">${quantityFormat(currentItem.getBasisQuantity())}</ram:BasisQuantity>`;
        xml += '</ram:NetPriceProductTradePrice>';
        xml += '</ram:SpecifiedLineTradeAgreement>';

        // Line trade delivery
        xml += '<ram:SpecifiedLineTradeDelivery>';
        xml += `<ram:BilledQuantity unitCode="${encodeXML(product?.getUnit() ?? 'C62')}">${quantityFormat(currentItem.getQuantity())}</ram:BilledQuantity>`;
        xml += '</ram:SpecifiedLineTradeDelivery>';

        // Line trade settlement
        xml += '<ram:SpecifiedLineTradeSettlement>';
        xml += '<ram:ApplicableTradeTax>';
        xml += '<ram:TypeCode>VAT</ram:TypeCode>';
        if (product != null) {
          const taxExemptionReason = product.getTaxExemptionReason();
          if (taxExemptionReason != null) {
            xml += `<ram:ExemptionReason>${encodeXML(taxExemptionReason)}</ram:ExemptionReason>`;
          }
          xml += `<ram:CategoryCode>${product.getTaxCategoryCode()}</ram:CategoryCode>`;
          const taxExemptionReasonCode = product.getTaxExemptionReasonCode();
          if (taxExemptionReasonCode != null) {
            xml += `<ram:ExemptionReasonCode>${taxExemptionReasonCode}</ram:ExemptionReasonCode>`;
          }
          const catCode = product.getTaxCategoryCode();
          if (catCode !== TaxCategoryCode.UNTAXEDSERVICE) {
            const vp = product.getVATPercent();
            xml += `<ram:RateApplicablePercent>${vatFormat(vp ?? ZERO)}</ram:RateApplicablePercent>`;
          }
        }
        xml += '</ram:ApplicableTradeTax>';

        // Item-total level allowances/charges
        if (currentItem.getItemAllowances() != null) {
          for (const a of currentItem.getItemAllowances()!) {
            xml += this.getItemTotalAllowanceChargeStr(a, currentItem);
          }
        }
        if (currentItem.getItemCharges() != null) {
          for (const c of currentItem.getItemCharges()!) {
            xml += this.getItemTotalAllowanceChargeStr(c, currentItem);
          }
        }

        // Line monetary summation
        xml += '<ram:SpecifiedTradeSettlementLineMonetarySummation>';
        xml += `<ram:LineTotalAmount>${currencyFormat(lc.getItemTotalNetAmount())}</ram:LineTotalAmount>`;
        xml += '</ram:SpecifiedTradeSettlementLineMonetarySummation>';
        xml += '</ram:SpecifiedLineTradeSettlement>';

        xml += '</ram:IncludedSupplyChainTradeLineItem>';
      }
    }

    // ApplicableHeaderTradeAgreement
    xml += '<ram:ApplicableHeaderTradeAgreement>';
    if (trans.getReferenceNumber() != null) {
      xml += `<ram:BuyerReference>${encodeXML(trans.getReferenceNumber()!)}</ram:BuyerReference>`;
    }
    if (trans.getSender() != null) {
      xml += '<ram:SellerTradeParty>';
      xml += this.getTradePartyAsXML(trans.getSender()! , true, false);
      xml += '</ram:SellerTradeParty>';
    }
    if (trans.getRecipient() != null) {
      xml += '<ram:BuyerTradeParty>';
      xml += this.getTradePartyAsXML(trans.getRecipient()! , false, false);
      xml += '</ram:BuyerTradeParty>';
    }
    if (trans.getSellerOrderReferencedDocumentID() != null) {
      xml += '<ram:SellerOrderReferencedDocument>';
      xml += `<ram:IssuerAssignedID>${encodeXML(trans.getSellerOrderReferencedDocumentID()!)}</ram:IssuerAssignedID>`;
      xml += '</ram:SellerOrderReferencedDocument>';
    }
    if (trans.getBuyerOrderReferencedDocumentID() != null) {
      xml += '<ram:BuyerOrderReferencedDocument>';
      xml += `<ram:IssuerAssignedID>${encodeXML(trans.getBuyerOrderReferencedDocumentID()!)}</ram:IssuerAssignedID>`;
      xml += '</ram:BuyerOrderReferencedDocument>';
    }
    if (trans.getContractReferencedDocument() != null) {
      xml += '<ram:ContractReferencedDocument>';
      xml += `<ram:IssuerAssignedID>${encodeXML(trans.getContractReferencedDocument()!)}</ram:IssuerAssignedID>`;
      xml += '</ram:ContractReferencedDocument>';
    }
    const objIdRef = trans.getObjectIdentifierReferencedDocument?.() ?? null;
    if (objIdRef != null && objIdRef.getIssuerAssignedID() != null) {
      xml += '<ram:AdditionalReferencedDocument>';
      xml += `<ram:IssuerAssignedID>${encodeXML(objIdRef.getIssuerAssignedID()!)}</ram:IssuerAssignedID>`;
      xml += '<ram:TypeCode>130</ram:TypeCode>';
      const rtc = objIdRef.getReferenceTypeCode();
      if (rtc != null && rtc.length > 0) {
        xml += `<ram:ReferenceTypeCode>${encodeXML(rtc)}</ram:ReferenceTypeCode>`;
      }
      const issueDate = objIdRef.getFormattedIssueDateTime();
      if (issueDate != null) {
        xml += `<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${formatDate102(issueDate)}</qdt:DateTimeString></ram:FormattedIssueDateTime>`;
      }
      xml += '</ram:AdditionalReferencedDocument>';
    }
    xml += '</ram:ApplicableHeaderTradeAgreement>';

    // ApplicableHeaderTradeDelivery
    xml += '<ram:ApplicableHeaderTradeDelivery>';
    const deliveryAddr = (trans as any).getDeliveryAddress?.();
    if (deliveryAddr != null) {
      xml += '<ram:ShipToTradeParty>';
      xml += this.getTradePartyAsXML(deliveryAddr, false, true);
      xml += '</ram:ShipToTradeParty>';
    }
    if (trans.getDeliveryDate() != null) {
      xml += '<ram:ActualDeliverySupplyChainEvent>';
      xml += udtDateElement('ram:OccurrenceDateTime', trans.getDeliveryDate()!);
      xml += '</ram:ActualDeliverySupplyChainEvent>';
    }
    xml += '</ram:ApplicableHeaderTradeDelivery>';

    // ApplicableHeaderTradeSettlement
    xml += '<ram:ApplicableHeaderTradeSettlement>';
    if (!isMinimum && trans.getReferenceNumber() != null) {
      xml += `<ram:PaymentReference>${encodeXML(trans.getReferenceNumber()!)}</ram:PaymentReference>`;
    }
    xml += `<ram:InvoiceCurrencyCode>${trans.getCurrency()}</ram:InvoiceCurrencyCode>`;

    // Payee
    const payee = (trans as any).getPayee?.();
    if (payee != null) {
      xml += '<ram:PayeeTradeParty>';
      xml += this.getTradePartyPayeeAsXML(payee);
      xml += '</ram:PayeeTradeParty>';
    }

    // Payment means
    if (!isMinimum && trans.getSender() != null) {
      const sender = trans.getSender()! ;
      const bankDetailsList = sender.getBankDetails();
      if (bankDetailsList.length > 0) {
        for (const bd of bankDetailsList) {
          xml += '<ram:SpecifiedTradeSettlementPaymentMeans>';
          xml += '<ram:TypeCode>58</ram:TypeCode>';
          xml += '<ram:PayeePartyCreditorFinancialAccount>';
          xml += `<ram:IBANID>${encodeXML(bd.getIBAN())}</ram:IBANID>`;
          if (bd.getAccountName() != null) {
            xml += `<ram:AccountName>${encodeXML(bd.getAccountName()!)}</ram:AccountName>`;
          }
          xml += '</ram:PayeePartyCreditorFinancialAccount>';
          if (bd.getBIC() != null) {
            xml += '<ram:PayeeSpecifiedCreditorFinancialInstitution>';
            xml += `<ram:BICID>${encodeXML(bd.getBIC()!)}</ram:BICID>`;
            xml += '</ram:PayeeSpecifiedCreditorFinancialInstitution>';
          }
          xml += '</ram:SpecifiedTradeSettlementPaymentMeans>';
        }
      }
    }

    // VAT amounts (skip for MINIMUM)
    const vatAmounts = calc.getVATAmountList();
    if (!isMinimum) {
      for (const va of vatAmounts) {
        const catCode = va.getCategoryCode();
        const displayExemptionReason = CATEGORY_CODES_WITH_EXEMPTION_REASON.includes(catCode);
        let exemptionReasonXML = '';
        if (displayExemptionReason && va.getVatExemptionReasonText() != null) {
          exemptionReasonXML = `<ram:ExemptionReason>${encodeXML(va.getVatExemptionReasonText()!)}</ram:ExemptionReason>`;
        }
        xml += '<ram:ApplicableTradeTax>';
        xml += `<ram:CalculatedAmount>${currencyFormat(va.getCalculated().round(2, Big.roundHalfUp))}</ram:CalculatedAmount>`;
        xml += '<ram:TypeCode>VAT</ram:TypeCode>';
        xml += exemptionReasonXML;
        xml += `<ram:BasisAmount>${currencyFormat(va.getBasis())}</ram:BasisAmount>`;
        xml += `<ram:CategoryCode>${catCode}</ram:CategoryCode>`;
        if (va.getDueDateTypeCode() != null) {
          xml += `<ram:DueDateTypeCode>${va.getDueDateTypeCode()}</ram:DueDateTypeCode>`;
        }
        xml += `<ram:RateApplicablePercent>${vatFormat(va.getApplicablePercent() ?? ZERO)}</ram:RateApplicablePercent>`;
        xml += '</ram:ApplicableTradeTax>';
      }
    }

    // Billing period
    if (trans.getDetailedDeliveryPeriodFrom() != null && trans.getDetailedDeliveryPeriodTo() != null) {
      xml += '<ram:BillingSpecifiedPeriod>';
      xml += udtDateElement('ram:StartDateTime', trans.getDetailedDeliveryPeriodFrom()!);
      xml += udtDateElement('ram:EndDateTime', trans.getDetailedDeliveryPeriodTo()!);
      xml += '</ram:BillingSpecifiedPeriod>';
    }

    // Header-level charges
    if (isXRechnung || isEN16931 || isExtended) {
      const charges = trans.getZFCharges();
      if (charges != null) {
        for (const charge of charges) {
          xml += '<ram:SpecifiedTradeAllowanceCharge>';
          xml += '<ram:ChargeIndicator><udt:Indicator>true</udt:Indicator></ram:ChargeIndicator>';
          xml += `<ram:ActualAmount>${currencyFormat(charge.getTotalAmount(calc))}</ram:ActualAmount>`;
          if (charge.getReason() != null) {
            xml += `<ram:Reason>${encodeXML(charge.getReason()!)}</ram:Reason>`;
          }
          if (charge.getReasonCode() != null) {
            xml += `<ram:ReasonCode>${charge.getReasonCode()}</ram:ReasonCode>`;
          }
          if (charge.getTaxPercent() != null) {
            xml += '<ram:CategoryTradeTax>';
            xml += '<ram:TypeCode>VAT</ram:TypeCode>';
            xml += `<ram:CategoryCode>${charge.getCategoryCode()}</ram:CategoryCode>`;
            xml += `<ram:RateApplicablePercent>${vatFormat(charge.getTaxPercent()!)}</ram:RateApplicablePercent>`;
            xml += '</ram:CategoryTradeTax>';
          }
          xml += '</ram:SpecifiedTradeAllowanceCharge>';
        }
      }
    }

    // Header-level allowances
    if (isXRechnung || isEN16931 || isExtended) {
      const allowances = trans.getZFAllowances();
      if (allowances != null) {
        for (const allowance of allowances) {
          xml += '<ram:SpecifiedTradeAllowanceCharge>';
          xml += '<ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>';
          xml += `<ram:ActualAmount>${currencyFormat(allowance.getTotalAmount(calc))}</ram:ActualAmount>`;
          if (allowance.getReason() != null) {
            xml += `<ram:Reason>${encodeXML(allowance.getReason()!)}</ram:Reason>`;
          }
          if (allowance.getReasonCode() != null) {
            xml += `<ram:ReasonCode>${allowance.getReasonCode()}</ram:ReasonCode>`;
          }
          if (allowance.getTaxPercent() != null) {
            xml += '<ram:CategoryTradeTax>';
            xml += '<ram:TypeCode>VAT</ram:TypeCode>';
            xml += `<ram:CategoryCode>${allowance.getCategoryCode()}</ram:CategoryCode>`;
            xml += `<ram:RateApplicablePercent>${vatFormat(allowance.getTaxPercent()!)}</ram:RateApplicablePercent>`;
            xml += '</ram:CategoryTradeTax>';
          }
          xml += '</ram:SpecifiedTradeAllowanceCharge>';
        }
      }
    }

    // Payment terms
    if (!isMinimum) {
      const ptDesc = trans.getPaymentTermDescription();
      const hasDueDate = trans.getDueDate() != null;
      if (ptDesc != null || hasDueDate) {
        xml += '<ram:SpecifiedTradePaymentTerms>';
        if (ptDesc != null) {
          xml += `<ram:Description>${encodeXML(ptDesc)}</ram:Description>`;
        }
        if (hasDueDate) {
          xml += udtDateElement('ram:DueDateDateTime', trans.getDueDate()!);
        }
        xml += '</ram:SpecifiedTradePaymentTerms>';
      }
    }

    // Monetary summation
    xml += '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>';
    if (!isMinimum) {
      xml += `<ram:LineTotalAmount>${currencyFormat(calc.getTotal())}</ram:LineTotalAmount>`;
      xml += `<ram:ChargeTotalAmount>${currencyFormat(calc.getChargeTotal())}</ram:ChargeTotalAmount>`;
      xml += `<ram:AllowanceTotalAmount>${currencyFormat(calc.getAllowanceTotal())}</ram:AllowanceTotalAmount>`;
    }
    xml += `<ram:TaxBasisTotalAmount>${currencyFormat(calc.getTaxBasis())}</ram:TaxBasisTotalAmount>`;
    const grandTotal = calc.getGrandTotal();
    const taxBasis = calc.getTaxBasis();
    xml += `<ram:TaxTotalAmount currencyID="${trans.getCurrency()}">${currencyFormat(grandTotal.minus(taxBasis))}</ram:TaxTotalAmount>`;
    if (trans.getRoundingAmount() != null) {
      xml += `<ram:RoundingAmount>${currencyFormat(trans.getRoundingAmount()!)}</ram:RoundingAmount>`;
    }
    xml += `<ram:GrandTotalAmount>${currencyFormat(grandTotal)}</ram:GrandTotalAmount>`;
    if (!isMinimum) {
      const prepaid = trans.getTotalPrepaidAmount() ?? ZERO;
      xml += `<ram:TotalPrepaidAmount>${currencyFormat(prepaid)}</ram:TotalPrepaidAmount>`;
    }
    xml += `<ram:DuePayableAmount>${currencyFormat(calc.getDuePayable())}</ram:DuePayableAmount>`;
    xml += '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>';

    // Invoice referenced document
    if (trans.getInvoiceReferencedDocumentID() != null) {
      xml += '<ram:InvoiceReferencedDocument>';
      xml += `<ram:IssuerAssignedID>${encodeXML(trans.getInvoiceReferencedDocumentID()!)}</ram:IssuerAssignedID>`;
      xml += '</ram:InvoiceReferencedDocument>';
    }

    xml += '</ram:ApplicableHeaderTradeSettlement>';
    xml += '</rsm:SupplyChainTradeTransaction>';
    xml += '</rsm:CrossIndustryInvoice>';

    this.zugferdData = xml;
  }

  getXML(): string {
    return this.zugferdData;
  }

  private getTradePartyAsXML(
    party: TradeParty,
    isSender: boolean,
    isShipTo: boolean,
  ): string {
    const profileName = this.profile.getName();
    const isMinimum = profileName === 'MINIMUM';
    const isExtended = profileName === 'EXTENDED';
    const isXRechnung = profileName === 'XRECHNUNG';
    const isEN16931 = profileName === 'EN16931';

    let xml = '';

    if (party.getID() != null) {
      xml += `<ram:ID>${encodeXML(party.getID()!)}</ram:ID>`;
    }
    if (party.getGlobalID() != null) {
      const scheme = party.getGlobalIDScheme();
      xml += `<ram:GlobalID${scheme ? ` schemeID="${scheme}"` : ''}>${encodeXML(party.getGlobalID()!)}</ram:GlobalID>`;
    }
    if (party.getName() != null) {
      xml += `<ram:Name>${encodeXML(party.getName()!)}</ram:Name>`;
    }
    if (party.getDescription() != null) {
      xml += `<ram:Description>${encodeXML(party.getDescription()!)}</ram:Description>`;
    }

    // Legal organisation
    const lo = party.getLegalOrganisation();
    if (lo != null) {
      xml += '<ram:SpecifiedLegalOrganization>';
      if (lo.getID() != null) {
        if (lo.getSchemeID() != null && !isMinimum) {
          xml += `<ram:ID schemeID="${lo.getSchemeID()}">${encodeXML(lo.getID()!)}</ram:ID>`;
        } else {
          xml += `<ram:ID>${encodeXML(lo.getID()!)}</ram:ID>`;
        }
      }
      if (lo.getTradingBusinessName() != null) {
        xml += `<ram:TradingBusinessName>${encodeXML(lo.getTradingBusinessName()!)}</ram:TradingBusinessName>`;
      }
      xml += '</ram:SpecifiedLegalOrganization>';
    }

    // Contact (for sender, or EN16931/EXTENDED/XRECHNUNG for buyer)
    const contact = party.getContact();
    if (contact != null && (isSender || isEN16931 || isExtended || isXRechnung)) {
      xml += '<ram:DefinedTradeContact>';
      if (contact.getName() != null) {
        xml += `<ram:PersonName>${encodeXML(contact.getName()!)}</ram:PersonName>`;
      }
      if (contact.getPhone() != null) {
        xml += '<ram:TelephoneUniversalCommunication>';
        xml += `<ram:CompleteNumber>${encodeXML(contact.getPhone()!)}</ram:CompleteNumber>`;
        xml += '</ram:TelephoneUniversalCommunication>';
      }
      if (isExtended && contact.getFax() != null) {
        xml += '<ram:FaxUniversalCommunication>';
        xml += `<ram:CompleteNumber>${encodeXML(contact.getFax()!)}</ram:CompleteNumber>`;
        xml += '</ram:FaxUniversalCommunication>';
      }
      if (contact.getEmail() != null) {
        xml += '<ram:EmailURIUniversalCommunication>';
        xml += `<ram:URIID>${encodeXML(contact.getEmail()!)}</ram:URIID>`;
        xml += '</ram:EmailURIUniversalCommunication>';
      }
      xml += '</ram:DefinedTradeContact>';
    }

    // Postal address
    xml += '<ram:PostalTradeAddress>';
    if (party.getZIP() != null) {
      xml += `<ram:PostcodeCode>${encodeXML(party.getZIP()!)}</ram:PostcodeCode>`;
    }
    if (party.getStreet() != null) {
      xml += `<ram:LineOne>${encodeXML(party.getStreet()!)}</ram:LineOne>`;
    }
    if (party.getLocation() != null) {
      xml += `<ram:CityName>${encodeXML(party.getLocation()!)}</ram:CityName>`;
    }
    if (party.getCountry() != null) {
      xml += `<ram:CountryID>${encodeXML(party.getCountry()!)}</ram:CountryID>`;
    }
    xml += '</ram:PostalTradeAddress>';

    // Electronic address (email URI) - skip for ShipTo
    if (!isShipTo && party.getEmail() != null) {
      xml += '<ram:URIUniversalCommunication>';
      xml += `<ram:URIID schemeID="EM">${encodeXML(party.getEmail()!)}</ram:URIID>`;
      xml += '</ram:URIUniversalCommunication>';
    }

    // Tax registration - skip for ShipTo
    if (!isShipTo) {
      if (party.getVATID() != null) {
        xml += '<ram:SpecifiedTaxRegistration>';
        xml += `<ram:ID schemeID="VA">${encodeXML(party.getVATID()!)}</ram:ID>`;
        xml += '</ram:SpecifiedTaxRegistration>';
      }
      if (party.getTaxID() != null) {
        xml += '<ram:SpecifiedTaxRegistration>';
        xml += `<ram:ID schemeID="FC">${encodeXML(party.getTaxID()!)}</ram:ID>`;
        xml += '</ram:SpecifiedTaxRegistration>';
      }
    }

    return xml;
  }

  private getTradePartyPayeeAsXML(party: TradeParty): string {
    let xml = '';
    if (party.getID() != null) {
      xml += `<ram:ID>${encodeXML(party.getID()!)}</ram:ID>`;
    }
    if (party.getGlobalID() != null) {
      const scheme = party.getGlobalIDScheme();
      xml += `<ram:GlobalID${scheme ? ` schemeID="${scheme}"` : ''}>${encodeXML(party.getGlobalID()!)}</ram:GlobalID>`;
    }
    if (party.getName() != null) {
      xml += `<ram:Name>${encodeXML(party.getName()!)}</ram:Name>`;
    }
    const lo = party.getLegalOrganisation();
    if (lo != null) {
      xml += '<ram:SpecifiedLegalOrganization>';
      if (lo.getID() != null) {
        if (lo.getSchemeID() != null) {
          xml += `<ram:ID schemeID="${lo.getSchemeID()}">${encodeXML(lo.getID()!)}</ram:ID>`;
        } else {
          xml += `<ram:ID>${encodeXML(lo.getID()!)}</ram:ID>`;
        }
      }
      if (lo.getTradingBusinessName() != null) {
        xml += `<ram:TradingBusinessName>${encodeXML(lo.getTradingBusinessName()!)}</ram:TradingBusinessName>`;
      }
      xml += '</ram:SpecifiedLegalOrganization>';
    }
    return xml;
  }

  private getAllowanceChargeStr(ac: AllowanceCharge, item: ExportableItem): string {
    let xml = '<ram:AppliedTradeAllowanceCharge>';
    xml += `<ram:ChargeIndicator><udt:Indicator>${ac.isCharge()}</udt:Indicator></ram:ChargeIndicator>`;
    xml += `<ram:ActualAmount>${priceFormat(ac.getTotalAmount(item))}</ram:ActualAmount>`;
    if (ac.getReason() != null) {
      xml += `<ram:Reason>${encodeXML(ac.getReason()!)}</ram:Reason>`;
    }
    if (ac.getReasonCode() != null) {
      xml += `<ram:ReasonCode>${ac.getReasonCode()}</ram:ReasonCode>`;
    }
    xml += '</ram:AppliedTradeAllowanceCharge>';
    return xml;
  }

  private getItemTotalAllowanceChargeStr(ac: AllowanceCharge, item: ExportableItem): string {
    let xml = '<ram:SpecifiedTradeAllowanceCharge>';
    xml += `<ram:ChargeIndicator><udt:Indicator>${ac.isCharge()}</udt:Indicator></ram:ChargeIndicator>`;
    xml += `<ram:ActualAmount>${currencyFormat(ac.getTotalAmount(item))}</ram:ActualAmount>`;
    if (ac.getReason() != null) {
      xml += `<ram:Reason>${encodeXML(ac.getReason()!)}</ram:Reason>`;
    }
    if (ac.getReasonCode() != null) {
      xml += `<ram:ReasonCode>${ac.getReasonCode()}</ram:ReasonCode>`;
    }
    xml += '</ram:SpecifiedTradeAllowanceCharge>';
    return xml;
  }
}
