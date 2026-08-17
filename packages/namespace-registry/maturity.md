# Namespace Prefix Registry Reuse Maturity Ratings

## How to Fill This Out

Rate candidates based on their current state, not their expected usefulness after refactor. For namespace-prefix work, separate pure prefix operations from app adapters. A function can be strategically important and still have a low current maturity rating if it is coupled to DOM, localStorage, mutable globals, or vendor APIs.

## Maturity Scale

|Level|Name|Meaning|
|:---:|:---|:---|
|0|Local only|App-specific, unclear contract, or tightly coupled to DOM/storage.|
|1|Candidate|Useful behavior exists, but it is under-tested, underspecified, or partially coupled.|
|2|Characterized|Current behavior is documented with representative fixtures and comparison notes.|
|3|Reusable|Function is pure or mostly pure, named by action, has clear JSDoc, and has focused tests or strong fixture path.|
|4|Package ready|Function is environment-neutral, has predictable error handling, and separates adapters from core logic.|
|5|Canonical|Shared package is adopted by all intended consumers and local duplicates have been deleted.|

## Rating Table

|ID|Function or package|Current level|Target level|Evidence|Blockers|Next action|Owner|Date updated|
|:---|:---|:---:|:---:|:---|:---|:---|:---|:---|
|MAT-001|OntoEagle `COMMON_PREFIXES`|3|4|Frozen prefix-to-IRI map; broad ontology-oriented defaults.|Needs canonical selection of CCO/CCEO/CCO2 aliases and documented source of truth.|Compare maps and define canonical baseline plus app extension rule.|TBD|2026-07-24|
|MAT-002|OntoEagle `shortIri`|3|4|Pure and widely useful; existing callers in search/slim output.|Mixes strict CURIE compaction with display fallback to local name.|Split into `compactIriWithPrefixes` and `formatIriForDisplay`.|TBD|2026-07-24|
|MAT-003|OntoEagle namespace filter helpers|2|2|Useful search behavior and pure logic.|App-specific document fields and filter semantics.|Keep as app adapter until namespace filtering becomes cross-app requirement.|TBD|2026-07-24|
|MAT-004|OntoEagle `computeNamespace`|3|4|Existing hash/slash tests in `tests\rdf_extract.test.js`.|Need compare validation behavior with OCM.|Create namespace-stem fixtures and pick null-vs-empty behavior.|TBD|2026-07-24|
|MAT-005|TOM Python `PREFIXES`/`to_curie`|2|2|Rdflib namespace-manager fallback and longest-prefix logic are useful.|Python runtime; not local-native browser package code.|Use as behavioral evidence, not direct implementation.|TBD|2026-07-24|
|MAT-006|TOM browser `iriPrefixes` and CURIE helpers|2|4|Broad app usage across parsing, writing, predicate lookup, and prefix manager.|Mutable global; UI mutation; sparse tests.|Extract pure map and helpers; leave prefix manager as adapter.|TBD|2026-07-24|
|MAT-007|TOM axiom-builder term formatting|2|3|Mostly pure RDF/JS term-to-text formatting with passed prefixes.|Display/Turtle-ish semantics mixed with axiom UI needs.|Compare with Visual Lynx/Table Nova Turtle formatting fixtures.|TBD|2026-07-24|
|MAT-008|Axiolotl SPARQL declaration registry and UI prefix manager|0|2|Shows user-facing active-prefix requirement.|Declaration strings, localStorage, DOM, and mutable globals are coupled.|Document adapter requirements only.|TBD|2026-07-24|
|MAT-009|Axiolotl `bestPrefixForIri`/`compactIri`|3|4|Pure ESM helpers with longest-prefix semantics and clear JSDoc.|Needs fixtures and local-name grammar decision.|Promote as top compaction candidate after comparison.|TBD|2026-07-24|
|MAT-010|Visual Lynx XMLNS/N3 prefix capture|2|3|Captures source prefixes and carries through conversion pipeline.|Vendor/global `window.N3` and logging in parser; XML regex needs fixture coverage.|Separate pure extraction from N3 adapter.|TBD|2026-07-24|
|MAT-011|Visual Lynx `n3-sugar-serial` prefix helpers|3|4|Has default merge, extraction, longest sort, valid-local-name handling.|IIFE/internal functions; no public module boundary yet.|Compare with Axiolotl and IRI Swapper, then promote selected pure helpers.|TBD|2026-07-24|
|MAT-012|Visual Lynx local-name extractor|1|2|Useful display helper with explicit errors.|Not registry behavior; error model conflicts with silent display fallbacks.|Treat as display helper option, not prefix core.|TBD|2026-07-24|
|MAT-013|OCM RDF IO prefix capture and serializer pass-through|3|3|Runtime injection is cleaner than direct globals; prefix data travels with parsed ontology.|Vendor adapter; not pure registry; JSON-LD/RDF/XML behavior differs by serializer.|Use as adapter design reference and fixture source.|TBD|2026-07-24|
|MAT-014|OCM namespace-stem/store discovery helpers|3|4|Pure helpers with clear contracts and sorted output.|Adjacent to prefixes rather than registry; compare with OntoEagle behavior.|Create namespace utilities submodule or separate capability if broad enough.|TBD|2026-07-24|
|MAT-015|Ontology Tabulator `NS` and `iriToCurieIfCommon`|2|4|Constants are used in tests; CURIE helper is simple.|Reverse map duplicates source registry; compaction logs side effects and lacks longest-prefix ordering.|Use tests as fixture inspiration; derive reverse map from canonical registry.|TBD|2026-07-24|
|MAT-016|IRI Swapper RDF prefix extractors|3|4|Covers Turtle, XMLNS, JSON-LD; used in actual import pipeline.|Regex/DOMParser error details need characterization; JSON-LD support is simple-context only.|Promote extraction adapters after fixtures.|TBD|2026-07-24|
|MAT-017|IRI Swapper SPARQL prologue and expansion helpers|3|4|Pure SPARQL `PREFIX`/`BASE` extraction and prefixed-name expansion.|SPARQL grammar coverage likely incomplete; no focused tests found.|Create SPARQL prefix fixtures before promotion.|TBD|2026-07-24|
|MAT-018|Table Nova defaults and ontology compact IRI helpers|3|4|Serializer and ontology tests verify prefix behavior.|App-specific prefixes; compact helper does not use longest namespace ordering.|Reuse fixtures; adapt helper to canonical longest-match behavior.|TBD|2026-07-24|
|MAT-019|Table Nova serializer prefix pass-through|3|3|Async N3 writer wrapper with tests.|Vendor adapter, not registry core.|Keep as evidence for serializer adapter contract.|TBD|2026-07-24|

## Top Candidates for Deep Comparison

|Rank|Candidate IDs|Why this belongs in the top set|Risk to check|
|:---:|:---|:---|:---|
|1|NS-014, NS-018|Best pure compaction behavior: longest-prefix matching plus valid-local-name logic.|Need decide fallback policy: original IRI, `<IRI>`, or local display label.|
|2|NS-001, NS-023, NS-032|Best registry baseline evidence: broad ontology prefixes, test-used constants, app defaults.|Need normalize duplicated CCO/CCEO/CCO2 and app-specific prefixes.|
|3|NS-026, NS-030, NS-016/NS-027, NS-028|Best source-prefix extraction coverage across Turtle/SPARQL/XMLNS/JSON-LD.|Need syntax fixtures and clear adapter boundaries.|
|4|NS-020, NS-017, NS-034|Best serializer/parser adapter patterns for carrying prefixes through N3/jsonld/rdflib.|Need keep vendor adapters outside pure core.|

## Promotion Checklist

- [ ] Canonical registry is prefix-to-IRI and immutable.
- [ ] Reverse namespace-to-prefix lookups are derived, not hand-maintained separately.
- [ ] IRI compaction uses longest namespace match.
- [ ] Strict CURIE/QName output is separated from display-label fallback.
- [ ] CURIE expansion handles unknown prefixes predictably.
- [ ] Turtle, SPARQL, XMLNS, and JSON-LD extraction have separate fixtures.
- [ ] DOMParser, N3, rdflib, jsonld, localStorage, and DOM UI behavior remain adapters.
- [ ] App-specific defaults extend the shared registry instead of mutating it.

## Notes

- No candidate should be rated `5 - Canonical` until the shared package is adopted and local duplicates are removed.
- TOM has wide application/reuse prospect, but its current registry is mutable and UI-coupled. It should be a demanding pilot, not the unexamined source of truth.

## Completion Update 2026-07-29

**Current package rating: 5 - Canonical for active shared namespace, prefix, CURIE, and common-IRI usage reviewed in this cycle.**

Evidence:

- The shared `namespace-registry` package now owns canonical prefix-to-IRI entries, common vocabulary IRIs, CURIE expansion/compaction, longest-prefix matching, and display fallback behavior.
- Active app-local constants for RDF, RDFS, OWL, SKOS, XSD, Dublin Core, IAO, CCO, and related common vocabulary terms found during cleanup were replaced with shared registry calls or direct shared common-IRI imports.
- Reverse maps and display labels are derived from the registry instead of hand-maintained local copies.
- Package and app Jest coverage preserves the old expected behavior for registry lookups, strict CURIE conversion, unknown prefix handling, longest-prefix matching, display fallback, and common vocabulary IRI availability.

Qualification:

- App-specific project namespaces remain local configuration where they describe the app's own ontology or data model rather than common vocabulary registry content.

## Headless API Audit Update 2026-08-15

**Headless package rating: 5 - Canonical for the namespace-registry source package and mirrored shared app copies.**

Evidence:

- The package exports deterministic namespace facts, generated full-IRI maps, prefix maps, CURIE expansion/compaction, prefix extraction, serializer prefix preparation, and namespace-stem discovery.
- `curieForNamespaceId()` was added to prevent downstream local wrappers around registry term CURIE creation.
- `saveProjectPrefixes()` remains an explicit storage-adapter helper, not implicit storage logic.
- `applyPrefixesToRdflibStore()` remains an explicit vendor-adapter helper, not pure core.
- Package Jest covers registry facts, structured lookup failures, prefix warnings, syntax extraction, vendor adapter boundaries, and namespace-stem discovery.
