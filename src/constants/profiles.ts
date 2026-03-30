export class Profile {
  readonly name: string;
  readonly id: string;

  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
  }

  getID(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getXMPName(): string {
    if (this.name === 'BASICWL') return 'BASIC WL';
    if (this.name === 'EN16931') return 'EN 16931';
    return this.name;
  }
}

export class Profiles {
  private static readonly zf2Map = new Map<string, Profile>([
    ['MINIMUM', new Profile('MINIMUM', 'urn:factur-x.eu:1p0:minimum')],
    ['BASICWL', new Profile('BASICWL', 'urn:factur-x.eu:1p0:basicwl')],
    [
      'BASIC',
      new Profile(
        'BASIC',
        'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
      ),
    ],
    ['EN16931', new Profile('EN16931', 'urn:cen.eu:en16931:2017')],
    [
      'EXTENDED',
      new Profile(
        'EXTENDED',
        'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended',
      ),
    ],
    [
      'XRECHNUNG',
      new Profile(
        'XRECHNUNG',
        'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
      ),
    ],
  ]);

  static getByName(name: string): Profile {
    const profile = Profiles.zf2Map.get(name.toUpperCase());
    if (!profile) throw new Error(`Profile not found: ${name}`);
    return profile;
  }

  /**
   * Detect profile from a guideline/customization ID string (e.g. from XML).
   * Returns null if no profile can be determined.
   */
  static getByID(id: string): Profile | null {
    if (!id) return null;
    const lower = id.toLowerCase();

    // Order matters: check more specific patterns before general ones
    if (lower.includes('xrechnung') || lower.includes('xeinkauf')) {
      return Profiles.zf2Map.get('XRECHNUNG')!;
    }
    if (lower.includes('extended')) {
      return Profiles.zf2Map.get('EXTENDED')!;
    }
    if (lower.includes('minimum')) {
      return Profiles.zf2Map.get('MINIMUM')!;
    }
    if (lower.includes('basicwl') || lower.includes('basic-wl')) {
      return Profiles.zf2Map.get('BASICWL')!;
    }
    if (lower.includes('basic')) {
      return Profiles.zf2Map.get('BASIC')!;
    }
    if (lower.includes('en16931')) {
      return Profiles.zf2Map.get('EN16931')!;
    }

    return null;
  }
}
