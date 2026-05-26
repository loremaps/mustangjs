export const TaxCategoryCode = {
  STANDARDRATE: 'S',
  REVERSECHARGE: 'AE',
  TAXEXEMPT: 'E',
  ZEROTAXPRODUCTS: 'Z',
  UNTAXEDSERVICE: 'O',
  INTRACOMMUNITY: 'K',
  FREEEXPORT: 'G',
} as const;

export const CATEGORY_CODES_WITH_EXEMPTION_REASON: readonly string[] = [
  TaxCategoryCode.INTRACOMMUNITY,
  TaxCategoryCode.REVERSECHARGE,
  TaxCategoryCode.TAXEXEMPT,
  TaxCategoryCode.FREEEXPORT,
  TaxCategoryCode.UNTAXEDSERVICE,
];
