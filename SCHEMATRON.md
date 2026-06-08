# Updating Schematron Rules

This project uses pre-compiled Schematron XSLT stylesheets for EN16931 and XRechnung validation. When the standards bodies release new versions, follow this guide to update the bundled rules.

## Background

The validation pipeline works as follows:

```
Schematron (.sch)  →  XSLT (.xslt)  →  SEF (.sef.json)  →  saxon-js runtime
   (source)          (compiled by        (compiled by         (runs in Node.js)
                      Schematron          xslt3 CLI)
                      processor)
```

We bundle the final SEF files. The intermediate XSLT files come from the Java [mustangproject](https://github.com/ZUGFeRD/mustangproject), which compiles the original Schematron sources to XSLT as part of its build process.

## Current versions

| Ruleset | Version | Source |
|---------|---------|--------|
| EN16931-CII | EN16931 Schematron v1.3.14.2 (mustangproject `core-2.23.1`) | `mustangproject/validator/.../xslt/en16931schematron/` |
| EN16931-UBL | EN16931 Schematron v1.3.14.2 (incl. PEPPOL BIS) | `mustangproject/validator/.../xslt/en16931schematron/` |
| XRechnung-CII | XRechnung 3.0 | `mustangproject/validator/.../xslt/XR_30/` |
| XRechnung-UBL | XRechnung 3.0 | `mustangproject/validator/.../xslt/XR_30/` |

## Update procedure

### Step 1: Get updated XSLT files

Pull the latest mustangproject and locate the pre-compiled XSLT files:

```bash
cd /path/to/mustangproject
git pull

# EN16931 (CII + UBL)
ls validator/src/main/resources/xslt/en16931schematron/
#   EN16931-CII-validation.xslt
#   EN16931-UBL-validation.xslt

# XRechnung (check for newer versions like XR_31/, XR_40/, etc.)
ls validator/src/main/resources/xslt/XR_*/
#   XR_30/XRechnung-CII-validation.xslt
#   XR_30/XRechnung-UBL-validation.xslt
```

If a new XRechnung version directory exists (e.g., `XR_31/`), use that instead of `XR_30/`.

### Step 2: Compile XSLT to SEF

Each XSLT file must be compiled to Saxon's SEF (Stylesheet Export File) JSON format:

```bash
cd /path/to/mustangjs

# EN16931 CII
npx xslt3 \
  -xsl:/path/to/mustangproject/validator/src/main/resources/xslt/en16931schematron/EN16931-CII-validation.xslt \
  -export:src/validation/schematron/EN16931-CII-validation.sef.json \
  -nogo -relocate:on

# EN16931 UBL
npx xslt3 \
  -xsl:/path/to/mustangproject/validator/src/main/resources/xslt/en16931schematron/EN16931-UBL-validation.xslt \
  -export:src/validation/schematron/EN16931-UBL-validation.sef.json \
  -nogo -relocate:on

# XRechnung CII (update XR_30 to the new version directory)
npx xslt3 \
  -xsl:/path/to/mustangproject/validator/src/main/resources/xslt/XR_30/XRechnung-CII-validation.xslt \
  -export:src/validation/schematron/XRechnung-CII-validation.sef.json \
  -nogo -relocate:on

# XRechnung UBL
npx xslt3 \
  -xsl:/path/to/mustangproject/validator/src/main/resources/xslt/XR_30/XRechnung-UBL-validation.xslt \
  -export:src/validation/schematron/XRechnung-UBL-validation.sef.json \
  -nogo -relocate:on
```

> **Why `-relocate:on`?** Saxon otherwise bakes the absolute compile path into the
> SEF's `baseUri`/`base` keys. `-relocate:on` removes the bulk of those (a few
> residual `base` URIs pointing at the source location remain). Do **not** hand-edit
> the generated `.sef.json` files — they carry an integrity checksum and saxon-js
> rejects any modified file (`Invalid checksum in SEF`); always regenerate.

### Step 3: Verify

Run the test suite to ensure the new rules don't break existing valid fixtures:

```bash
npm test
```

Pay attention to the Schematron tests in `test/schematron.test.ts`. If known-good fixtures now fail, investigate whether the fixtures need updating or the new rules have regressions.

### Step 4: Update this document

Update the "Current versions" table above with the new version identifiers.

## Adding ZF_240 profile-specific rules (future)

The Factur-X profile-specific Schematron rules (MINIMUM, BASIC, EN16931, EXTENDED) are not yet bundled because they use `document()` calls to reference external code database files (`_codedb.xml`). These require a custom URI resolver in saxon-js.

The files are located at:
```
mustangproject/validator/src/main/resources/xslt/ZF_240/
  FACTUR-X_MINIMUM.xslt          + FACTUR-X_MINIMUM_codedb.xml
  FACTUR-X_BASIC-WL.xslt         + FACTUR-X_BASIC-WL_codedb.xml
  FACTUR-X_BASIC.xslt            + FACTUR-X_BASIC_codedb.xml
  FACTUR-X_EN16931.xslt          + FACTUR-X_EN16931_codedb.xml
  FACTUR-X_EXTENDED.xslt         + FACTUR-X_EXTENDED_codedb.xml
```

To add support for these, the `SchematronValidator` would need to be extended to handle the `document()` function resolution. One approach is to inline the codedb lookups into the XSLT before compiling to SEF.

## Where the rules come from

- **EN16931 Schematron**: Published by CEN TC 434 as part of the EN16931 standard. The canonical source is the [CEN/TC 434 GitHub](https://github.com/ConnectingEurope/eInvoicing-EN16931).
- **XRechnung Schematron**: Published by KoSIT (Koordinierungsstelle fuer IT-Standards). Available at the [KoSIT GitHub](https://github.com/itplr-kosit/validator-configuration-xrechnung).
- **Factur-X (ZF_240) Schematron**: Published by FNFE-MPE. Available via the [Factur-X project](https://fnfe-mpe.org/factur-x/).

The Java mustangproject bundles all of these and compiles the `.sch` sources to `.xslt` during its Maven build. We reuse those pre-compiled XSLT files.
