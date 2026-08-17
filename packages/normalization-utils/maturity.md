# Normalization Utils Maturity

Current maturity: 5 for the direct duplicate case/date/slug helpers covered in this cycle.

The package has a canonical API, characterization tests, browser-shared mirrors,
and adoption in the repos with active direct duplicates:

- OntoEagle IndexedDB record-id slug normalization
- TOM case/date/grid field normalization
- Table Nova header, casing, slug, and label normalization
- OCM filename slug and timestamp normalization
- Ontology Tabulator PascalCase filename normalization

Axiolotl's matching candidate was dead code and was removed. Visual Lynx, SPV,
and IRI Swapper received the mirrored package for repo normalization, but no
active direct duplicate in this family was found during this pass.

Search token normalization, NLP lexical normalization, MIME normalization, RDF
term normalization, and ontology validation remain intentionally outside this
package because their input/output contracts differ.

## 2026-08-15 Headless API Audit

Maturity remains Level 5 after the headless API audit.

- Public exports remain pure JavaScript functions with no DOM, storage, download,
  logging, network, or vendor dependency.
- `NORMALIZATION_CASE_STYLES` is now exported as the stable list of accepted
  case-style identifiers.
- Date and timestamp functions are deterministic when callers pass a `Date`.
  Omitting the date intentionally uses the current clock.
- Invalid date inputs fall back to the current date instead of leaking `NaN`
  date parts.
- Edge-case Jest coverage was added for supported style publication, fallback
  styles, invalid dates, extensionless filenames, and custom filename separators.
