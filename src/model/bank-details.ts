export class BankDetails {
  protected iban: string;
  protected bic: string | null = null;
  protected accountName: string | null = null;

  constructor(iban: string, bic?: string) {
    this.iban = iban;
    if (bic !== undefined) this.bic = bic;
  }

  setBIC(bic: string): this {
    this.bic = bic;
    return this;
  }

  setAccountName(name: string): this {
    this.accountName = name;
    return this;
  }

  getIBAN(): string {
    return this.iban;
  }

  getBIC(): string | null {
    return this.bic;
  }

  getAccountName(): string | null {
    return this.accountName;
  }
}
