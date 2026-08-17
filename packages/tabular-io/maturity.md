# Tabular Parsing and Serialization Maturity Ratings

## Maturity Scale

|Level|Name|Meaning|
|:---:|:---|:---|
|0|Local only|App-specific, unclear contract, or tightly coupled to DOM/storage.|
|1|Candidate|Useful behavior exists, but it is under-tested, underspecified, or partially coupled.|
|2|Characterized|Current behavior is documented with representative fixtures and comparison notes.|
|3|Reusable|Function is pure or mostly pure, named by action, has clear JSDoc, and has focused tests.|
|4|Package ready|Function is environment-neutral, has predictable error handling, and separates adapters from core logic.|
|5|Canonical|Shared package is adopted by all intended consumers and local duplicates have been deleted.|

## Rating Table

|ID|Function or package|Current level|Target level|Evidence|Blockers|Next action|Owner|Date updated|
|:---|:---|:---:|:---:|:---|:---|:---|:---|:---|
|MAT-001|CQ Ferret nested `escapeCSV` / `downloadCSV`|0|2|Real export workflow exists.|Global graph cache, inline schema projection, no focused tests, export and download coupled.|Use as migration evidence only; do not promote directly.|TBD|2026-07-27|
|MAT-002|CQ Ferret inline CSV upload parser|0|2|Real upload workflow exists.|Regex split parser is fragile; parsing, graph reconstruction, confirmation, and persistence are coupled.|Replace later with generic parser plus CQ row adapter after fixtures.|TBD|2026-07-27|
|MAT-003|OntoEagle term extractor `escapeCsv` / `exportRowsToCsv`|1|3|Small pure helpers once isolated.|IIFE global exposure; no focused tests.|Compare fixed-schema row export behavior with OCM and TOM.|TBD|2026-07-27|
|MAT-004|TOM `tom-core-utils` CSV export helpers|3|4|Pure utilities, clear tests for escaping, row building, and CRLF output.|Contract is CSV-only and option shape is TOM-oriented.|Use as a serializer candidate for fixtures and naming decisions.|TBD|2026-07-27|
|MAT-005|TOM `parseSpreadsheetData`|1|3|Covers CSV/TSV/XLS/XLSX through SheetJS and returns `{ rows, header }`.|Reads browser files, logs, depends on global `XLSX`, no parser fixtures.|Split file read, SheetJS adapter, and row normalization.|TBD|2026-07-27|
|MAT-006|Axiolotl deprecated `parseIriMappingCsv`|3|4|Pure-ish parser, returns warnings, focused tests for CSV/TSV and duplicates.|Deprecated area; limited CSV parser using simple split; optional global normalizer.|Use for warning-model comparison in IRI mapping parser cycle.|TBD|2026-07-27|
|MAT-007|Axiolotl saved-query CSV import/export|1|3|Hand-rolled parser supports quotes/newlines and strict header validation.|Storage import coupled to IndexedDB/events; no focused tests found.|Extract parser/serializer behavior as app adapter evidence.|TBD|2026-07-27|
|MAT-008|OCM `csvEscape` / `rowsToCsv`|3|4|Pure ESM helpers with focused Jest for commas, quotes, and newlines.|CSV-only; no options for delimiter/newline/header mode.|Strong seed for generic row serializer.|TBD|2026-07-27|
|MAT-009|OCM report CSV builders|2|3|Typed JSDoc, stable schemas, focused Jest assertions.|Domain row projection mixed with serialization calls; CSV only.|Keep domain-specific row builders local; use generic serializer underneath.|TBD|2026-07-27|
|MAT-010|OCM measures CSV/TSV builders|2|4|CSV and TSV wrappers exist with Jest assertions.|Need inspect/characterize delimiter escaping edge cases more deeply.|Use as evidence for delimiter option in canonical serializer.|TBD|2026-07-27|
|MAT-011|Ontology Tabulator `tableModelToCsv`|1|3|Simple table model export with shared download wrapper.|Headers are not escaped; no focused tests; UI helper file mixes DOM and serialization.|Extract pure serializer or replace with canonical row serializer.|TBD|2026-07-27|
|MAT-012|IRI Swapper RDF mapping parse/import|1|3|Uses PapaParse for CSV/TSV and SheetJS for workbook rows.|File read, parsing, row mapping, session mutation, and UI updates coupled.|Defer replacement until parser packages are adopted.|TBD|2026-07-27|
|MAT-013|IRI Swapper SPARQL mapping parse/import|1|3|Duplicates RDF page mapping import behavior.|Same blockers as RDF page; no focused tests.|Consolidate with RDF page through mapping parser package.|TBD|2026-07-27|
|MAT-014|IRI Swapper `rowsToMapping` functions|2|4|Small sync row normalizers with clear header fallback and duplicate metadata.|Duplicated across two pages; throws string-specific messages; no tests.|Promote as `createIriMappingFromRows` after conflict policy is decided.|TBD|2026-07-27|
|MAT-015|Table Nova `parseTabular.js`|3|4|Focused Jest for detection, delimiter choice, quotes, header options; clean ESM file.|Text parser does not support quoted multiline records; no structured warnings; SheetJS adapter uses global.|Strong parser candidate, likely with PapaParse adapter replacing hand parser for hard CSV cases.|TBD|2026-07-27|
|MAT-016|Table Nova data dictionary CSV serializer|2|3|Pure fixed-schema serializer with JSDoc.|No focused tests; fixed schema belongs to app adapter.|Use as records-to-CSV migration evidence.|TBD|2026-07-27|

## Promotion Checklist Status

- [ ] Function name describes the action, not the source app or one current use case.
- [ ] Inputs and outputs are explicit and documented.
- [ ] Core logic is pure or mostly pure.
- [ ] DOM, storage, file, download, and vendor side effects are behind adapters.
- [ ] Error and warning behavior is predictable.
- [ ] Representative fixtures exist.
- [ ] Jest tests cover happy paths, edge cases, and known invalid inputs.
- [ ] Browser, worker, and Node assumptions are documented.
- [ ] Dependency and vendor provenance is documented.

No tabular function is yet `4 - Package ready` because parser/serializer contracts have not been characterized with shared fixtures.

## Notes

- The strongest current parser evidence is Table Nova plus PapaParse usage in IRI Swapper.
- The strongest current serializer evidence is OCM `rowsToCsv` plus TOM `generateCsvString`.
- Mapping parsing should not be collapsed into generic tabular parsing; it is a domain adapter over generic tabular rows.

## Completion Update 2026-07-29

**Current package rating: 5 - Canonical for active CSV/TSV parsing and delimited-row serialization reviewed in this cycle.**

Evidence:

- The shared `tabular-io` package now owns delimiter-aware escaping, delimited-row serialization, CSV/TSV delimiter detection, delimited-line parsing, text-to-header/row parsing, and header-row option application.
- Active consumers have been rewired to shared helpers for CSV/TSV export, tabular text parsing, header handling, and report serialization.
- Local active duplicates discovered during cleanup were deleted or reduced to domain-specific row projection functions.
- Package and app Jest coverage preserves old expected behavior for quote escaping, comma/tab/newline cells, trailing newlines, CRLF compatibility expectations, delimiter detection, quoted field parsing, header-row selection, no-header tables, empty input, and domain report output.

Qualification:

- XLS/XLSX handling remains a vendor adapter concern until the shared package explicitly owns a SheetJS runtime contract.
- IRI mapping import/export remains a domain adapter over generic tabular rows and should not be folded into generic tabular parsing.

## 2026-08-15 Headless API Audit

Maturity remains Level 5 for the scoped CSV/TSV and delimited-record
capability.

- Delimited parsing/serialization, query-record exchange, table-shape helpers,
  and IRI mapping row normalization are pure, environment-neutral JavaScript.
- Browser file reads, downloads, IndexedDB writes, UI status, and File System
  Access folder sync remain outside the package.
- XLS/XLSX support remains deferred to a future SheetJS adapter with explicit
  runtime injection and the same row/record output contracts.
- `createIriMappingFromRows` now rejects unsupported duplicate policies instead
  of silently treating them like `last`.
- Jest coverage now includes TSV query exchange, unknown query-language
  warnings, and invalid IRI mapping duplicate-policy errors.
