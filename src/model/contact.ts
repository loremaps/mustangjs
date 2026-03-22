export class Contact {
  protected name: string | null = null;
  protected phone: string | null = null;
  protected email: string | null = null;
  protected fax: string | null = null;

  constructor(name?: string, phone?: string, email?: string) {
    if (name !== undefined) this.name = name;
    if (phone !== undefined) this.phone = phone;
    if (email !== undefined) this.email = email;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setPhone(phone: string): this {
    this.phone = phone;
    return this;
  }

  setEmail(email: string): this {
    this.email = email;
    return this;
  }

  setFax(fax: string): this {
    this.fax = fax;
    return this;
  }

  getName(): string | null {
    return this.name;
  }

  getPhone(): string | null {
    return this.phone;
  }

  getEmail(): string | null {
    return this.email;
  }

  getFax(): string | null {
    return this.fax;
  }
}
