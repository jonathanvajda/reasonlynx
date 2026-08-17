# Format and MIME Registry Reuse Maturity Ratings

## How to Fill This Out

Use this document after the inventory pass to decide which candidates deserve deep comparison. Ratings here are first-pass ratings based on code reading only. Update them after characterization tests and contract decisions.

A candidate is not canonical until the shared package is adopted by all intended consumers and local duplicate implementations have been deleted.

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
|FMT-012|Visual Lynx registry module|4|5|Pure ESM registry with normalization, filename guessing, download extension, and supported conversions.|Includes Mermaid/D3, so RDF-specific and general graph-output concerns may need separation; no dedicated fixtures found.|Deep compare with FMT-014 and define canonical split.|TBD|2026-07-24|
|FMT-014|Ontology Curation Manager RDF registry module|4|5|RDF-specific constants, extensions, normalization, filename detection, support predicate, and JSDoc.|No download extension helper; unknown fallback policy differs from Visual Lynx.|Deep compare with FMT-012 and FMT-001.|TBD|2026-07-24|
|FMT-001|OntoEagle RDF registry|3|4|Pure RDF format constants and filename detector; simple and browser-ready.|No normalizer/support predicate; default Turtle fallback may hide unknown input.|Use as source for baseline RDF coverage.|TBD|2026-07-24|
|FMT-002|TOM `parseFileExtension`|3|4|Pure generic extension extractor with UMD/CommonJS shape.|No fixtures found.|Likely promote as generic file utility or format-registry helper.|TBD|2026-07-24|
|FMT-003|TOM `detectFormatByExtension`|3|4|Pure broad input-kind classifier.|Too broad for canonical MIME registry by itself.|Use for tabular-vs-ontology intake adapter design.|TBD|2026-07-24|
|FMT-004|TOM `guessMediaType`|3|4|Pure content heuristic for JSON-LD/RDF/XML/Turtle/N-Triples.|Heuristic behavior needs fixtures to avoid false positives.|Characterize with small RDF/text fixtures.|TBD|2026-07-24|
|FMT-007|Axiolotl `detectRdfMimeByName`|2|4|Useful filename detector with known callers.|References debug global for warning; coverage lacks `.nq`, `.json`, `.json-ld`, `.turtle`, `.ntriples`.|Treat as consumer migration target, not leading candidate.|TBD|2026-07-24|
|FMT-008|Axiolotl `getWorkspaceExportFormats`|2|3|Encodes default graph vs named graph export options.|Graph-scope behavior is app-specific, not a generic MIME registry.|Keep as adapter shape after canonical MIME registry exists.|TBD|2026-07-24|
|FMT-009|Axiolotl `workspaceExportExtension`|2|4|Pure MIME-to-extension lookup.|Fallback `rdf` differs from Visual Lynx `txt`; no normalizer.|Compare with FMT-012.|TBD|2026-07-24|
|FMT-010|Axiolotl `commonMIMEType` and DOM reader|1|3|Useful UI-label-to-MIME map.|`getSelectedOutputMime` reads DOM; label mapping includes SPARQL formats beyond RDF registry.|Separate pure label map from DOM adapter if retained.|TBD|2026-07-24|
|FMT-011|Graph Analytics inline `detectFormatByName`|1|3|Simple inline filename detector.|Inline HTML; `auto` fallback is parser-specific.|Treat as local adapter behavior to migrate later.|TBD|2026-07-24|
|FMT-015|OCM `getMimeTypeForFormat`|1|2|Simple charset decoration helper.|Name says format but input appears MIME-like; may be better handled by download utils.|Do not promote without renaming/contract cleanup.|TBD|2026-07-24|
|FMT-016|Ontology Tabulator filename detector|2|4|Documented exported function with logging.|Need full behavior review below inspected range; logs inside core detector.|Deep compare only if OCM/Visual Lynx leave unresolved behavior.|TBD|2026-07-24|
|FMT-017|Ontology Tabulator N3 format predicate|2|4|Pure predicate for N3-supported RDF MIME types.|Narrow helper; belongs under RDF registry or RDF IO boundary.|Use to design `isN3WritableMimeType`/`isN3ParsableMimeType`.|TBD|2026-07-24|
|FMT-018|IRI Swapper descriptor detector|2|4|Returns both `contentType` and label; explicit unknown descriptor.|Coupled to app parsing expectations; maps TriG to `text/turtle` content type.|Use as evidence for descriptor shape and unknown handling.|TBD|2026-07-24|
|FMT-019|Table Nova tabular detector|2|4|Pure tabular filename detector.|Tabular-only; not RDF MIME registry.|Save for tabular format registry pass.|TBD|2026-07-24|
|FMT-020|Table Nova export map|1|3|Useful export-kind-to-extension descriptor.|Inline closure with text values; no MIME for RDF downloads.|Treat as app adapter after canonical extension helpers exist.|TBD|2026-07-24|
|FMT-021|OntoEagle Python RDF extension map|1|2|Useful lineage for rdflib formats.|Python build script; not browser runtime.|Document only for tertiary/tooling alignment.|TBD|2026-07-24|
|FMT-022|Axiolotl Python RDF extension map|1|2|Useful lineage and fallback parse behavior.|Python build script; map is local inside parser.|Document only for tertiary/tooling alignment.|TBD|2026-07-24|

## Promotion Checklist for Leading Candidates

- [ ] Define whether the first package is RDF-only or includes tabular/report/visualization MIME types.
- [ ] Decide fallback behavior for unknown filename extension: `null`, `auto`, Turtle, or explicit unknown descriptor.
- [ ] Decide whether `.json` should map to JSON-LD or remain ambiguous.
- [ ] Decide whether `.trig` maps to `application/trig` everywhere or may use `text/turtle` for N3 parser compatibility in adapters.
- [ ] Add fixtures for every supported extension and every shorthand token.
- [ ] Add fixtures for unknown, extensionless, uppercase, and multi-dot filenames.
- [ ] Separate DOM selectors and download side effects from pure registry functions.

## Notes

- First deep comparison should focus on FMT-012 and FMT-014, with FMT-001 as a baseline and FMT-018 as a descriptor/unknown-behavior reference.

## Completion Update 2026-07-29

**Current package rating: 5 - Canonical for the active browser app code reviewed in this cycle.**

Evidence:

- The shared `format-registry` package now owns canonical MIME, extension, category, label, and format-key lookup behavior.
- Active consumers have been rewired to shared helpers for extension extraction, input-kind detection, MIME selection, preferred download extensions, accept attributes, and filename-to-MIME detection.
- Local active duplicates discovered during the cleanup sweep were deleted or replaced with direct imports from the shared package.
- Legacy expected inputs from TOM, Axiolotl, OCM, Visual Lynx, Table Nova, and Ontology Tabulator are represented in package or app Jest coverage, including uppercase extensions, unknown extensions, multi-dot filenames, RDF/Turtle/JSON-LD/RDF-XML detection, CSV/TSV classification, Mermaid/D3 extension behavior, and SPARQL query/update/results formats.

Qualification:

- Deprecated artifacts and standalone experimental pages are not treated as canonical consumers until they are either removed or intentionally migrated.

## Headless API Audit Update 2026-08-15

**Headless package rating: 5 - Canonical for the format-registry source package and OntoEagle active app copy.**

Evidence:

- The source package public API no longer exports browser download or file-input helpers.
- `downloadTextFile` remains owned by `browser-file-io`.
- HTML accept-string construction remains owned by `browser-file-io` as `createAcceptAttribute`.
- RDF text sniffing is retained as pure registry behavior under `detectRdfMimeTypeFromText`, returning the structured descriptor-result shape used by the registry.
- The OntoEagle app copy was aligned with the same boundary.
- Jest now asserts that `downloadTextFile`, `getAcceptExtensions`, and `guessRdfMimeTypeFromText` are absent from the public `format-registry` API.

Mirror status:

- OntoEagle, TOM, Axiolotl, Visual Lynx, OCM, SPV, Ontology Tabulator, Table Nova, and IRI Swapper shared `format-registry` copies were synchronized to this boundary during the audit.
