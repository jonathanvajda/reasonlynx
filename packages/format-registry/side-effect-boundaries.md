# Format and MIME Registry Side-Effect Boundaries

## How to Fill This Out

Use this file to separate pure registry behavior from DOM, download, parser, storage, and logging adapters. The canonical format registry should be pure core code.

## Boundary Categories

|Category|Description|Allowed examples|
|:---|:---|:---|
|Pure core|Deterministic lookup or normalization from explicit inputs.|MIME normalization, extension lookup, support predicates.|
|Browser adapter|Reads browser-provided objects but does not own business logic.|Reading `File.name`, selected form values.|
|DOM adapter|Reads controls or updates UI options.|`getSelectedOutputMime()`, `syncWorkspaceExportFormatOptions()`.|
|Download adapter|Creates Blob/object URL or chooses download filename.|TOM export call sites, Table Nova `downloadTextFile`.|
|Parser adapter|Maps canonical MIME to N3/rdflib/jsonld parser options.|`n3FormatByMime`, `isN3ParserFormat`.|
|Tooling adapter|Python/Node/server-side build or indexing scripts.|OntoEagle and Axiolotl Python rdflib maps.|

## Boundary Table

|ID|Function|Current category|Target category|Side effects|Reads from|Writes to|Adapter needed?|Worker-safe?|Node-safe?|Notes|
|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
|FMT-001|OntoEagle `detectRdfFormat`|Pure core|Pure core|None|Input filename|Return value|No|Yes|Likely|Keep parser maps separate from MIME registry if needed.|
|FMT-002|TOM `parseFileExtension`|Pure core|Pure core|None|Input filename|Return value|No|Yes|Yes|Likely generic file utility.|
|FMT-003|TOM `detectFormatByExtension`|Pure core|App adapter or pure broad registry|None|Input extension|Return value|Maybe|Yes|Yes|Output is broad app kind, not MIME.|
|FMT-004|TOM `guessMediaType`|Pure core heuristic|Pure core heuristic|None|Input text|Return value|No|Yes|Yes|Keep separate from filename lookup.|
|FMT-006|TOM wrapper functions|DOM/app adapter|Adapter|Console logging|Input args and `CoreUtils` global|Return value/logs|Yes|Mostly|No|Do not promote wrappers as core.|
|FMT-007|Axiolotl `detectRdfMimeByName`|Pure with logging global|Pure core|Optional console warning|Input filename and debug flag|Return value/logs|Yes|After removing debug global|Likely|Good migration target, not leading candidate.|
|FMT-010|Axiolotl `getSelectedOutputMime`|DOM adapter|DOM adapter over pure label map|Reads DOM|`document.getElementById`|Return value|Yes|No|No|Split `commonMIMEType` from DOM selector.|
|FMT-011|Graph Analytics inline detector|Inline app adapter|Pure core or adapter|None|Input filename|Return value|Yes|Yes if extracted|Likely|Inline HTML should consume shared registry later.|
|FMT-012|Visual Lynx registry|Pure core|Pure core|None|Input strings|Return values|No|Yes|Likely|Strong candidate; may split RDF and visualization types.|
|FMT-014|OCM RDF registry|Pure core|Pure core|None|Input strings|Return values|No|Yes|Likely|Strong RDF-specific candidate.|
|FMT-015|OCM `getMimeTypeForFormat`|Download/export adapter|Download utility|None|Input string|Return MIME with charset|Yes|Yes|Likely|May belong in `download-utils`, not format core.|
|FMT-016|Ontology Tabulator detector|Pure plus logging|Pure core|Console logging|Input filename|Return value/logs|Yes|After removing logging|Likely|Could consume canonical detector.|
|FMT-017|Ontology Tabulator `isN3ParserFormat`|Parser adapter predicate|Parser adapter|None|Input MIME|Return boolean|No|Yes|Yes|Good helper if named precisely.|
|FMT-018|IRI Swapper descriptor detector|Pure core/app descriptor|Pure descriptor or adapter|None|Input filename|Return descriptor|Maybe|Yes|Likely|Descriptor shape may be useful; TriG mapping needs review.|
|FMT-019|Table Nova tabular detector|Pure core|Tabular registry|None|Input filename|Return tabular kind|No|Yes|Likely|Save for tabular formats.|
|FMT-020|Table Nova export map|App export adapter|Adapter over MIME/extension registry|Downloads through surrounding handler|App state, view text, export kind|Download via caller|Yes|No|No|Core should resolve kind to MIME/extension without touching text.|
|FMT-021|OntoEagle Python map|Tooling adapter|Tooling adapter|Filesystem traversal in `iter_rdf_files`|Path/folder|Iterator/format|No for tooling|No|Python only|Document for tertiary alignment.|
|FMT-022|Axiolotl Python map|Tooling adapter|Tooling adapter|Parsing/logging|Text/file name/path|rdflib graph/logs|No for tooling|No|Python only|Document for tertiary alignment.|

## Refactor Plan

|Refactor ID|Problem|Target boundary|Affected functions|Required tests|Migration notes|
|:---|:---|:---|:---|:---|:---|
|REF-001|Filename detectors use different fallback behavior.|Pure core plus app adapters|FMT-001, FMT-007, FMT-011, FMT-014, FMT-016, FMT-018|Known extension fixtures; unknown/extensionless fixtures|Core should return `null` or descriptor; apps decide default.|
|REF-002|MIME normalization and output conversion are mixed with visualization outputs.|Pure RDF core plus optional graph-output registry|FMT-012, FMT-014|Alias-token fixtures; supported-conversion fixtures|Do not force Mermaid/D3 formats into RDF-only packages.|
|REF-003|DOM selector reads are mixed with MIME label lookup.|DOM adapter over pure label map|FMT-010|Label-to-MIME tests; DOM adapter smoke test|Move label map to pure registry, leave DOM read local.|
|REF-004|Download extensions are sometimes keyed by export kind, sometimes MIME.|Pure MIME-to-extension core plus app export descriptors|FMT-005, FMT-009, FMT-012, FMT-020|MIME-to-extension fixtures; export-kind adapter tests|App handlers should resolve export kind to MIME before calling download utils.|
|REF-005|Parser adapter formats are treated as MIME in some places.|Parser adapter boundary|FMT-014, FMT-017, serialization/parsing code|N3 parser/writer support fixtures|Canonical registry can expose MIME; parser adapters map MIME to library-specific format values.|

## Notes

- The canonical package should be worker-safe and browser-native. It should not reference `window`, `document`, `FileReader`, `Blob`, IndexedDB, FSA, OPFS, or vendor parser globals.
- 2026-08-15: The source package boundary was stabilized to enforce this rule. `browser-file-actions.js` was removed from `format-registry`; `detectRdfMimeTypeFromText` remains as pure content detection, and browser download/accept behavior belongs to `browser-file-io`.
