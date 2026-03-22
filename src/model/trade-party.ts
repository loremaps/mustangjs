import { Contact } from './contact.js';
import { BankDetails } from './bank-details.js';
import { LegalOrganisation } from './legal-organisation.js';

export class TradeParty {
  protected name: string | null = null;
  protected zip: string | null = null;
  protected street: string | null = null;
  protected location: string | null = null;
  protected country: string | null = null;
  protected taxID: string | null = null;
  protected vatID: string | null = null;
  protected id: string | null = null;
  protected globalID: string | null = null;
  protected globalIDScheme: string | null = null;
  protected email: string | null = null;
  protected contact: Contact | null = null;
  protected bankDetails: BankDetails[] = [];
  protected legalOrganisation: LegalOrganisation | null = null;
  protected description: string | null = null;

  constructor(
    name?: string,
    street?: string,
    zip?: string,
    location?: string,
    country?: string,
  ) {
    if (name !== undefined) this.name = name;
    if (street !== undefined) this.street = street;
    if (zip !== undefined) this.zip = zip;
    if (location !== undefined) this.location = location;
    if (country !== undefined) this.country = country;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStreet(street: string): this {
    this.street = street;
    return this;
  }

  setZIP(zip: string): this {
    this.zip = zip;
    return this;
  }

  setLocation(location: string): this {
    this.location = location;
    return this;
  }

  setCountry(country: string): this {
    this.country = country;
    return this;
  }

  setID(id: string): this {
    this.id = id;
    return this;
  }

  addTaxID(taxID: string): this {
    this.taxID = taxID;
    return this;
  }

  addVATID(vatID: string): this {
    this.vatID = vatID;
    return this;
  }

  setTaxID(taxID: string): this {
    this.taxID = taxID;
    return this;
  }

  setVATID(vatID: string): this {
    this.vatID = vatID;
    return this;
  }

  setGlobalID(globalID: string): this {
    this.globalID = globalID;
    return this;
  }

  setGlobalIDScheme(scheme: string): this {
    this.globalIDScheme = scheme;
    return this;
  }

  setEmail(email: string): this {
    this.email = email;
    return this;
  }

  setContact(contact: Contact): this {
    this.contact = contact;
    return this;
  }

  addBankDetails(bd: BankDetails): this {
    this.bankDetails.push(bd);
    return this;
  }

  setLegalOrganisation(lo: LegalOrganisation): this {
    this.legalOrganisation = lo;
    return this;
  }

  setDescription(desc: string): this {
    this.description = desc;
    return this;
  }

  getName(): string | null {
    return this.name;
  }

  getStreet(): string | null {
    return this.street;
  }

  getZIP(): string | null {
    return this.zip;
  }

  getLocation(): string | null {
    return this.location;
  }

  getCountry(): string | null {
    return this.country;
  }

  getTaxID(): string | null {
    return this.taxID;
  }

  getVATID(): string | null {
    return this.vatID;
  }

  getID(): string | null {
    return this.id;
  }

  getGlobalID(): string | null {
    return this.globalID;
  }

  getGlobalIDScheme(): string | null {
    return this.globalIDScheme;
  }

  getEmail(): string | null {
    return this.email;
  }

  getContact(): Contact | null {
    return this.contact;
  }

  getBankDetails(): BankDetails[] {
    return this.bankDetails;
  }

  getLegalOrganisation(): LegalOrganisation | null {
    return this.legalOrganisation;
  }

  getDescription(): string | null {
    return this.description;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(data: any): TradeParty {
    const party = new TradeParty();
    if (data.name) party.setName(data.name);
    if (data.street) party.setStreet(data.street);
    if (data.zip) party.setZIP(data.zip);
    if (data.location) party.setLocation(data.location);
    if (data.country) party.setCountry(data.country);
    if (data.taxID) party.setTaxID(data.taxID);
    if (data.vatID ?? data.vatid) party.setVATID(data.vatID ?? data.vatid);
    if (data.id) party.setID(data.id);
    if (data.globalID) party.setGlobalID(data.globalID);
    if (data.globalIDScheme) party.setGlobalIDScheme(data.globalIDScheme);
    if (data.email) party.setEmail(data.email);
    return party;
  }
}
