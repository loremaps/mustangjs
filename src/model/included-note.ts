import { encodeXML } from '../xml/xml-tools.js';
import { SubjectCode } from '../constants/subject-code.js';

/**
 * A grouping of business terms to indicate accounting-relevant free texts including a
 * qualification of these (EN16931 BG-1 INVOICE NOTE: BT-22 content + BT-21 subject code).
 *
 * Ported from Java mustangproject's IncludedNote.
 */
export class IncludedNote {
  private content: string;
  private subjectCode: string | null;

  constructor(content: string, subjectCode: string | null = null) {
    this.content = content;
    this.subjectCode = subjectCode;
  }

  static generalNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.AAI);
  }

  static regulatoryNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.REG);
  }

  static legalNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.ABL);
  }

  static customsNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.CUS);
  }

  static sellerNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.SUR);
  }

  static taxNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.TXD);
  }

  static introductionNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.ACY);
  }

  static discountBonusNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.AAK);
  }

  static paymentTermNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.AAB);
  }

  static paymentDetailRemittanceInformationNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.PMD);
  }

  static additionalInformationNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.ACB);
  }

  static invoiceInstructionNote(content: string): IncludedNote {
    return new IncludedNote(content, SubjectCode.INV);
  }

  static unspecifiedNote(content: string): IncludedNote {
    return new IncludedNote(content, null);
  }

  getContent(): string {
    return this.content;
  }

  getSubjectCode(): string | null {
    return this.subjectCode;
  }

  setContent(content: string): this {
    this.content = content;
    return this;
  }

  setSubjectCode(subjectCode: string | null): this {
    this.subjectCode = subjectCode;
    return this;
  }

  /**
   * Renders this note as a CII `<ram:IncludedNote>` element. The `<ram:SubjectCode>`
   * child is only emitted when a subject code is set.
   */
  toCiiXml(): string {
    let result =
      '<ram:IncludedNote>' +
      `<ram:Content>${encodeXML(this.content)}</ram:Content>`;
    if (this.subjectCode != null) {
      result += `<ram:SubjectCode>${this.subjectCode}</ram:SubjectCode>`;
    }
    return result + '</ram:IncludedNote>';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): IncludedNote {
    return new IncludedNote(data.content ?? '', data.subjectCode ?? null);
  }
}
