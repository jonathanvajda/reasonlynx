# Namespace Prefix Registry Side-Effect Boundaries

## How to Fill This Out

Use this file to separate pure namespace-prefix behavior from adapters. The shared package core should be deterministic and environment-neutral. Browser DOM, localStorage, IndexedDB, File System Access, OPFS, N3.js, jsonld.js, rdflib.js, and UI rendering must stay behind explicit adapters.

## Boundary Categories

|Category|Description|Allowed examples|
|:---|:---|:---|
|Pure core|Deterministic namespace and prefix transforms.|Merge prefix maps, derive reverse map, find longest prefix, compact/expand CURIEs, derive namespace stems.|
|Syntax adapter|Pure text parsing/formatting for a concrete RDF/query syntax.|Extract Turtle prefixes, extract SPARQL prologue, create JSON-LD context object, format Turtle IRI token.|
|Browser adapter|Thin wrapper around browser-only APIs.|DOMParser XMLNS extraction when chosen; UI prefix dialogs.|
|Storage adapter|Controlled persistence boundary.|Saving active prefix preferences in IndexedDB/localStorage/project state.|
|DOM adapter|Rendering or event collection boundary.|Prefix bar, modal, checkbox state collection.|
|Vendor adapter|Stable wrapper around third-party APIs.|N3 parser/writer prefix capture/injection, jsonld compact context, rdflib namespace binding.|
|Node/Python adapter|Optional server-side or tooling boundary.|rdflib Python namespace manager, build scripts.|

## Boundary Table

|ID|Function|Current category|Target category|Side effects|Reads from|Writes to|Adapter needed?|Worker-safe?|Node-safe?|Notes|
|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
|BOUND-001|OntoEagle `COMMON_PREFIXES`|Pure core|Pure core|None|Module constants|None|No|Yes|Yes|Good canonical data seed.|
|BOUND-002|OntoEagle `shortIri`|Pure core/display helper|Pure core plus display helper|None|Explicit IRI and internal registry|None|No|Yes|Yes|Split strict compaction from display fallback.|
|BOUND-003|OntoEagle namespace filter helpers|Pure app helper|App adapter or optional pure helper|None|Explicit filter/doc values|None|Maybe|Yes|Yes|Document fields are app-specific.|
|BOUND-004|TOM Python `bind_prefixes`|Node/Python adapter|Tooling adapter|Mutates rdflib graph namespace manager|Python `PREFIXES`|Graph namespace manager|Yes|No|Python only|Do not promote into browser package core.|
|BOUND-005|TOM browser `iriPrefixes`|Mutable app state|App adapter consuming shared core|Global object mutation through UI manager|Global script state|Global prefix map|Yes|No|No|High-value pilot once shared registry exists.|
|BOUND-006|TOM `iriToCurie`/`curieToIri`|Pure-ish but reads global state|Pure core|None directly|Global `iriPrefixes`|None|Yes|Maybe|Maybe|Pass prefix map explicitly.|
|BOUND-007|TOM axiom-builder term formatting|Pure display/syntax helper|Syntax adapter|None|RDF/JS terms and prefix map|None|Maybe|Yes|Yes|Separate RDF/JS term formatting from UI workflow.|
|BOUND-008|Axiolotl prefix UI manager|DOM/storage adapter|DOM/storage adapter|Reads/writes localStorage, DOM, alert, mutates registry|DOM inputs, localStorage, global prefix registry|DOM, localStorage, global object|Yes|No|No|Useful as adapter requirements only.|
|BOUND-009|Axiolotl `buildQuery`|Pure-ish app helper|Syntax adapter|None|Prefix key array and global declaration registry|None|Yes|Maybe|Maybe|Should receive prefix-to-IRI map and format declarations.|
|BOUND-010|Axiolotl `bestPrefixForIri`/`compactIri`|Pure core|Pure core|None|Explicit IRI/prefix map|None|No|Yes|Yes|Strong promotion candidate.|
|BOUND-011|Visual Lynx `extractRdfXmlPrefixes`|Pure syntax adapter|Syntax adapter|None|XML text|None|No|Yes|Yes|Regex implementation is portable; validate with fixtures.|
|BOUND-012|Visual Lynx `parseWithN3`|Vendor adapter|Vendor adapter|Creates store, logs warnings/errors|`window.N3`, logger, text|N3 store, log sink|Yes|Maybe|Maybe|Prefer injected runtime like OCM.|
|BOUND-013|Visual Lynx `n3-sugar-serial` prefix helpers|Pure helpers inside app script|Pure core/syntax adapter|None|Explicit text, prefixes, IRI|None|Maybe|Yes|Yes|Expose as module functions if promoted.|
|BOUND-014|OCM RDF IO prefix capture|Vendor adapter|Vendor adapter|Creates store; may use runtime libs|Injected N3/Store runtime|Parsed store object|Yes|Maybe|Maybe|Good adapter boundary example.|
|BOUND-015|OCM namespace discovery helpers|Pure core|Pure core or adjacent namespace utility|None|Explicit IRI/store|None|No|Yes|Yes|Useful if package includes namespace discovery.|
|BOUND-016|Ontology Tabulator `iriToCurieIfCommon`|Pure transform with logging side effect|Pure core|Telemetry logging|Logger helpers and reverse map|Log sink|Yes|No|Maybe|Remove logging from shared helper; log at caller if needed.|
|BOUND-017|IRI Swapper `parseTurtlePrefixes`|Pure syntax adapter|Syntax adapter|None|Text|None|No|Yes|Yes|Top extraction candidate.|
|BOUND-018|IRI Swapper `parseXmlnsPrefixes`|Browser adapter|Browser or syntax adapter|Creates DOM document|DOMParser and XML text|None|Yes|No|No|If kept, expose as browser adapter.|
|BOUND-019|IRI Swapper `parseJsonLdPrefixes`|Pure syntax adapter|Syntax adapter|JSON parse only|JSON text|None|No|Yes|Yes|May throw; document clearly.|
|BOUND-020|IRI Swapper SPARQL helpers|Pure syntax adapter|Syntax adapter|None|SPARQL text/prefix map|None|No|Yes|Yes|Good SPARQL adapter seed.|
|BOUND-021|Table Nova `compactIri`|Pure syntax helper|Pure core or Turtle adapter|None|IRI and prefix map|None|No|Yes|Yes|Add longest-prefix ordering if promoted.|
|BOUND-022|Table Nova `writeWithN3`|Vendor adapter|Vendor adapter|Creates N3 writer output|Global `N3`, store, options|Serialized string|Yes|Maybe|Maybe|Good adapter fixture source.|
|BOUND-023|Table Nova defaults|Pure app data|App extension map|None|Module constants|None|No|Yes|Yes|Should extend canonical registry.|

## Refactor Plan

|Refactor ID|Problem|Target boundary|Affected functions|Required tests|Migration notes|
|:---|:---|:---|:---|:---|:---|
|REF-001|Several apps maintain independent common prefix maps.|Pure core registry.|NS-001, NS-008, NS-011, NS-023, NS-032.|Fixture comparing canonical map against app-required prefixes.|Apps import canonical registry and add app-specific prefixes.|
|REF-002|Compaction helpers differ on longest-match and fallback semantics.|Pure core plus syntax/display adapters.|NS-002, NS-009, NS-014, NS-018, NS-025, NS-033.|Overlapping namespace fixture; invalid local-name fixture; unknown namespace fixture.|Callers choose `compactIriWithPrefixes`, `formatIriForTurtle`, or `formatIriForDisplay`.|
|REF-003|Prefix extraction exists separately for Turtle/SPARQL/XMLNS/JSON-LD.|Syntax adapters.|NS-016, NS-026, NS-027, NS-028, NS-030.|One fixture file per syntax, including default prefix and invalid/missing declarations.|Keep source-prefix extraction separate from parser/vendor prefix capture.|
|REF-004|N3/jsonld/rdflib prefix injection is mixed into app serialization flows.|Vendor adapters.|NS-017, NS-020, NS-021, NS-029, NS-034.|Serializer fixture proving prefixes appear or are intentionally omitted by format.|Core package exposes prefix maps; RDF IO packages call vendor adapters.|
|REF-005|User-active prefix settings are coupled to DOM/localStorage.|Storage and DOM adapters.|NS-008, NS-012.|Adapter tests with fake storage and DOM-free state functions.|Canonical package should define data shape only; apps own UI.|

## Side-Effect Rules

- Pure prefix registry functions must accept prefix maps explicitly and must not read mutable app globals.
- A canonical prefix map must be immutable. User/project prefixes should be merged into a new object.
- Reverse lookup data must be derived from prefix-to-IRI data.
- Prefix extraction from text may be pure; parser-captured prefixes are vendor adapters.
- DOMParser-based XML namespace extraction is browser-only unless replaced by a pure parser.
- N3, jsonld, rdflib, localStorage, IndexedDB, File System Access API, OPFS, and DOM rendering must not appear in pure core modules.

## Notes

- The package can remain local-native and static-deployable if browser adapters are plain ESM and vendor libraries are committed/browser-ready per the deployment spec.
- Node/Python tooling can consume the same documented registry, but it should not define the canonical browser package implementation.
