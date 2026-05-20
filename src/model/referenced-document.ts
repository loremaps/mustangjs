/**
 * Ported from Java ReferencedDocument.java.
 * Represents an additional/referenced document, used for BT-18 (Invoiced object identifier)
 * and similar references in CII/UBL.
 */
export class ReferencedDocument {
  protected issuerAssignedID: string | null = null;
  protected typeCode: string | null = null;
  protected referenceTypeCode: string | null = null;
  protected formattedIssueDateTime: Date | null = null;

  constructor(
    issuerAssignedID?: string,
    typeCodeOrDate?: string | Date,
    referenceTypeCode?: string,
    formattedIssueDateTime?: Date,
  ) {
    if (issuerAssignedID !== undefined) {
      this.issuerAssignedID = issuerAssignedID;
    }
    if (typeCodeOrDate instanceof Date) {
      this.formattedIssueDateTime = typeCodeOrDate;
    } else if (typeof typeCodeOrDate === 'string') {
      this.typeCode = typeCodeOrDate;
    }
    if (referenceTypeCode !== undefined) {
      this.referenceTypeCode = referenceTypeCode;
    }
    if (formattedIssueDateTime !== undefined) {
      this.formattedIssueDateTime = formattedIssueDateTime;
    }
  }

  setIssuerAssignedID(id: string): this {
    this.issuerAssignedID = id;
    return this;
  }

  setTypeCode(code: string): this {
    this.typeCode = code;
    return this;
  }

  setReferenceTypeCode(code: string): this {
    this.referenceTypeCode = code;
    return this;
  }

  setFormattedIssueDateTime(date: Date): this {
    this.formattedIssueDateTime = date;
    return this;
  }

  getIssuerAssignedID(): string | null {
    return this.issuerAssignedID;
  }

  getTypeCode(): string | null {
    return this.typeCode;
  }

  getReferenceTypeCode(): string | null {
    return this.referenceTypeCode;
  }

  getFormattedIssueDateTime(): Date | null {
    return this.formattedIssueDateTime;
  }
}
