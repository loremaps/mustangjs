/**
 * EN16931-ID: BT-21 — the qualification of the free text on the invoice from BT-22.
 * @see https://service.unece.org/trade/untdid/d96a/uncl/uncl4451.htm — UNTDID D.96A Element 4451
 *
 * Recommended codes:
 *   AAI : General information / Allgemeine Informationen
 *   SUR : Supplier remarks / Anmerkungen des Verkäufers
 *   REG : Regulatory information / Regulatorische Informationen
 *   ABL : Government information / Rechtliche Informationen
 *   TXD : Tax declaration / Informationen zur Steuer
 *   CUS : Customs declaration information / Zollinformationen
 * plus:
 *   ACY : Introduction
 *   AAK : Price conditions / discount and bonus agreements
 *   ABZ : Instructions about revolving documentary credit
 *   PMT : Payment information
 *   PMD : Payment detail / remittance information
 *   AAB : Terms of payment
 *   ACB : Additional information
 *   INV : Invoice instruction
 */
export const SubjectCode = {
  AAI: 'AAI',
  SUR: 'SUR',
  REG: 'REG',
  ABL: 'ABL',
  TXD: 'TXD',
  CUS: 'CUS',
  ACY: 'ACY',
  AAK: 'AAK',
  ABZ: 'ABZ',
  PMT: 'PMT',
  PMD: 'PMD',
  AAB: 'AAB',
  ACB: 'ACB',
  INV: 'INV',
} as const;

export type SubjectCodeType = (typeof SubjectCode)[keyof typeof SubjectCode];
