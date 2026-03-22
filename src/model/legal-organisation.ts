export class LegalOrganisation {
  protected id: string | null = null;
  protected schemeID: string | null = null;
  protected tradingBusinessName: string | null = null;

  constructor(id?: string, schemeID?: string) {
    if (id !== undefined) this.id = id;
    if (schemeID !== undefined) this.schemeID = schemeID;
  }

  setID(id: string): this {
    this.id = id;
    return this;
  }

  setSchemeID(schemeID: string): this {
    this.schemeID = schemeID;
    return this;
  }

  setTradingBusinessName(name: string): this {
    this.tradingBusinessName = name;
    return this;
  }

  getID(): string | null {
    return this.id;
  }

  getSchemeID(): string | null {
    return this.schemeID;
  }

  getTradingBusinessName(): string | null {
    return this.tradingBusinessName;
  }
}
