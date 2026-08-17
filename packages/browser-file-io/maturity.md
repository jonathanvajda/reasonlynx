# Reuse Maturity Ratings

## Capability Family

- **Capability family:** Browser File I/O and Downloads
- **Date updated:** 2026-07-26
- **Apps covered:** OntoEagle, tabular-ontology-maker, axiolotl, visual-lynx, ontology-curation-manager, ontology-tabulator, iri-swapper, table-nova

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
|MAT-001|BFI-001 `downloadTextFile`|5|5|Clear JSDoc, direct behavior, focused tests with mocked DOM/URL/Blob, and active app callers import `browser-file-io` rather than `format-registry`.|None for current browser adapter scope.|Keep MIME detection supplied by `format-registry`; do not define a second registry here.|Codex|2026-08-15|
|MAT-002|BFI-024 Table Nova `readFileAsText`|3|4|Best current FileReader error preservation and setup-error catch; narrow contract|No shared tests; browser-only; no encoding option|Use as reference for canonical text reader with optional encoding and File API fallback notes|TBD|2026-07-26|
|MAT-003|BFI-025 Table Nova `readFileAsArrayBuffer`|3|4|Narrow contract, preserves `reader.error`, catches setup errors|No shared tests; choice between FileReader and `file.arrayBuffer()` unresolved|Define baseline: modern `file.arrayBuffer()` with FileReader fallback, or FileReader only|TBD|2026-07-26|
|MAT-004|BFI-003/BFI-010/BFI-014 text readers|2|4|Common behavior across OntoEagle, Axiolotl, Visual Lynx; simple Promise contract|Duplicate implementations differ in error detail and null handling; no fixtures|Characterize against mock FileReader and converge on MAT-002 behavior|TBD|2026-07-26|
|MAT-005|BFI-017 OCM `downloadTextFile(text, fileName, mimeType)`|2|3|Good app adapter; isolates old argument order from shared helper|Argument order conflicts with canonical pattern; report module also contains serializers|Retain only as app adapter or migrate callers to canonical order|TBD|2026-07-26|
|MAT-006|BFI-015 Visual Lynx `downloadContent`|3|3|Clean wrapper around promoted helper; object parameter is expressive|Name is generic; wrapper adds little after canonical package exists|Replace or keep as local adapter if object-parameter readability is preferred|TBD|2026-07-26|
|MAT-007|BFI-011 Axiolotl `downloadText`|1|3|Useful app-wide download surface, with fallback if module import fails|Dynamic import makes completion/error behavior opaque; classic-script coupling; no tests|After package adoption, make caller awaitable or document fire-and-forget behavior|TBD|2026-07-26|
|MAT-008|BFI-007/BFI-008/BFI-012/BFI-018/BFI-020/BFI-023 mixed read+parse flows|1|2|Important consumers expose real app constraints|Not reusable as browser utilities; mixed parser/storage/UI side effects|Document as callers; split browser reads from domain parsing in later capability cycles|TBD|2026-07-26|
|MAT-009|BFI-002 `getAcceptExtensions` / `createAcceptAttribute`|5|5|Canonical behavior is `createAcceptAttribute`, tested in `browser-file-io`, and it can consume descriptors from `format-registry` without the registry exporting HTML adapter strings.|None.|Use `createAcceptAttribute(listSupportedMimeDescriptors(), { category })` for category-based file inputs.|Codex|2026-08-15|
|MAT-010|`@ontoeagle/browser-file-io` package candidate|4|5|Dedicated package structure now exists with JSDoc-covered functions, focused Jest tests, DOM/URL/Blob injection points, and documented contracts|No consuming app has adopted the package yet; local duplicates still exist|Pilot adoption in one simple app and one high-constraint app, then delete duplicates once behavior is confirmed|TBD|2026-07-26|

## Promotion Checklist

Use this checklist before rating anything `4 - Package ready`.

- [ ] Function name describes the action, not the source app or one current use case.
- [ ] Inputs and outputs are explicit and documented.
- [ ] Core logic is pure or mostly pure.
- [ ] DOM, storage, file, download, and vendor side effects are behind adapters.
- [ ] Error and warning behavior is predictable.
- [ ] Representative fixtures exist.
- [ ] Jest tests cover happy paths, edge cases, and known invalid inputs.
- [ ] Browser, worker, and Node assumptions are documented.
- [ ] Dependency and vendor provenance is documented.

Use this checklist before rating anything `5 - Canonical`.

- [ ] Shared package has a documented contract.
- [ ] Simple pilot app has adopted the package.
- [ ] Demanding pilot app has adopted the package.
- [ ] All intended consumers have adopted the package.
- [ ] Local duplicate implementations have been deleted.
- [ ] Stale function names have been searched and resolved.
- [ ] App-specific adapter tests remain where needed.
- [ ] Inventory and naming decision files have been updated.

## Notes

- No function should be rated `5 - Canonical` yet. The capability has a package-ready candidate, but the intended consumers have not adopted it and local duplicates still exist.
- The package candidate promotes the stable parts of BFI-001, BFI-002, BFI-024, and BFI-025 without importing parser, serializer, UI, storage, or vendor spreadsheet behavior into the browser utility boundary.

## Completion Update 2026-07-29

**Current package rating: 5 - Canonical for active browser read/download utilities reviewed in this cycle.**

Evidence:

- The shared `browser-file-io` package now owns browser text reads, ArrayBuffer reads, object URL downloads, text downloads, JSON downloads, and accept-attribute construction.
- Active consumers have been rewired to direct package imports rather than local wrappers or browser globals.
- Local active duplicates discovered during cleanup were deleted, including old FileReader wrappers, download helpers, CSV-download wrappers where they only duplicated browser download behavior, and argument-order compatibility shims.
- Package and app Jest coverage preserves the old expected behavior for successful text reads, successful ArrayBuffer reads, FileReader errors, setup errors, text download cleanup, JSON download formatting, and accept-attribute generation.

Qualification:

- Functions that combine file reading with parsing, IndexedDB writes, or UI state remain app workflows and are intentionally not part of this capability family.

## 2026-08-15 Headless Adapter-Boundary Audit

Maturity remains Level 5 for browser adapter reuse, with an explicit headless
qualification.

- `browser-file-io` is not a fully headless transformation package.
- Pure helpers such as filename normalization, accept-attribute construction,
  and MIME charset normalization remain headless-testable.
- File reads and downloads remain browser adapter functions with injectable
  seams for `FileReader`, `Blob`, `document`, and `URL`.
- Domain packages must produce canonical artifacts before this package is
  called; this package must not own RDF/tabular/report serialization, parser
  selection, IndexedDB writes, ZIP assembly, or FSA folder synchronization.
- The audit document records this boundary so later CLI, CI, and agent work
  does not try to call browser-only behavior as if it were headless core logic.
