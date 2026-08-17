# RDF I/O Promoted Function Proposal

## Decision

Promote RDF parsing/serialization as two layers:

1. **Core RDF/JS data functions** that are dependency-free and testable now.
2. **Vendor adapters** for full Turtle, TriG, JSON-LD expansion/compaction, and RDF/XML parse/serialize.

GRP-008 and GRP-009 are promoted into the first layer instead of being deferred. The reusable target is not "TOM rows" or "OntoEagle graph documents"; it is a mapping-driven function that turns an app's in-memory objects into RDF quads. JSON-LD output must depend on those quads and the shared serializer, not on a separate app-specific JSON-LD branch.

## Deep Comparison

|Capability|Current candidates|Consolidation decision|
|:---|:---|:---|
|Generic RDF parse dispatch|OCM `parseRdfInput`, Visual Lynx `parseToStore`, OntoEagle `parseRdfToStore`, TOM `parseOntologyText`, Ontology Tabulator parser, IRI Swapper parser|Promote `parseRdfText(text, options)`. OCM supplies the contract baseline; Visual Lynx supplies transform and RDF/XML repair lessons.|
|Generic RDF serialize dispatch|OCM `serializeRdfStore`, Visual Lynx `serializeFromStore`, Table Nova serializers, TOM `serializeQuads`, Axiolotl workspace serializers|Promote `serializeRdfDataset(dataset, options)`. Single-format output is the primitive; batch export composes it.|
|App object to RDF|TOM row-to-quads, Table Nova schema-to-ontology, OntoEagle/CQ JSON-LD graph builders|Promote `createRdfQuadsFromObjects(objects, mapping)`. Apps keep their object models and provide declarative mappings.|
|JSON-LD graph projection|OntoEagle JSON-LD graph extraction, CQ-style JSON-LD exports, Table Nova JSON-LD export|Promote `rdfDatasetToJsonLdGraph(dataset, options)` and `serializeRdfDatasetToJsonLd(dataset, options)`. JSON-LD depends on RDF quads.|
|JSON-LD graph ingest|OntoEagle graph extraction and app-local JSON-LD records|Promote `createRdfQuadsFromJsonLdGraph(graph, options)` for simple JSON-LD-like app objects. Full JSON-LD parsing remains a jsonld adapter.|
|Graph export scope selection|Axiolotl active workspace export; expected TOM, Table Nova, DocxHund, OCD, and Graphite exports|Promote `selectRdfGraphExportQuads()`, `createRdfGraphExportDataset()`, and `serializeRdfGraphExport()`. Default graph, named graphs, and combined dataset export are generic RDF dataset concerns, not app-local UI concerns.|
|Named graph assignment|IRI Swapper and Axiolotl named graph workflows|Keep as app/graph adapter. It can call `parseRdfText` first, then assign graph names.|
|Domain ontology modeling|TOM ontology row rules and Table Nova column schema rules|Keep domain-specific mapping decisions local, but express final mapping through `createRdfQuadsFromObjects` where practical.|

## Proposed JS Functions

### `createRdfQuadsFromObjects(objects, options)`

Converts arbitrary app records into RDF/JS quads.

- **Input domain:** in-memory app objects, mapping with `subject`, `type`, `properties`, optional `graph`.
- **Output range:** `{ quads, warnings, subjects }`.
- **Error model:** throws for invalid mapping shape; returns warnings for missing subjects and invalid property values.
- **Logging:** none.
- **Side effects:** none.
- **Promotion use:** TOM rows, Table Nova column schemas/records, CQ Ferret records, OntoEagle graph/document records where the object shape is already known.

### `serializeRdfDataset(dataset, options)`

Serializes RDF/JS dataset-like values to one target syntax.

- **Input domain:** array/iterable/dataset-like quads.
- **Output range:** `{ text, format, mimeType, warnings }`.
- **Current implementation:** dependency-free `ntriples`, `nquads`, and simple JSON-LD projection.
- **Future adapter implementation:** Turtle/TriG via N3, RDF/XML via rdflib, canonical JSON-LD via jsonld.js.
- **Error model:** throws unsupported-format and invalid-dataset errors.
- **Logging:** none.
- **Side effects:** none.

### `parseRdfText(text, options)`

Parses RDF text.

- **Input domain:** RDF text and format/MIME/file metadata.
- **Output range:** `{ dataset, quads, sourceFormat, prefixes, baseIri, warnings }`.
- **Current implementation:** dependency-free N-Triples/N-Quads subset for tests and fallback.
- **Future adapter implementation:** Turtle/TriG/N3 via N3, JSON-LD via jsonld.js, RDF/XML via rdflib.
- **Error model:** throws unsupported-format and parse errors with line context where available.
- **Logging:** none.
- **Side effects:** none.

### `rdfDatasetToJsonLdGraph(dataset, options)`

Projects quads to simple JSON-LD graph objects.

- **Input domain:** RDF/JS dataset-like values.
- **Output range:** JSON-LD `@graph` node array.
- **Error model:** throws invalid dataset/term errors.
- **Logging:** none.
- **Side effects:** none.
- **Important constraint:** app JSON-LD export should call this or `serializeRdfDataset(..., { format: 'jsonld' })` after quads are built.

### `createRdfQuadsFromJsonLdGraph(graph, options)`

Converts simple JSON-LD-like app graph objects into quads.

- **Input domain:** object, array, or document with `@graph`.
- **Output range:** `{ quads, warnings, subjects }`.
- **Error model:** throws for invalid mapping only through the object mapper; warnings for skipped records.
- **Logging:** none.
- **Side effects:** none.
- **Limit:** not a full JSON-LD parser. Full expansion belongs to the jsonld adapter.

### `serializeRdfGraphExport(dataset, options)`

Serializes a graph export scope from a dataset-like object.

- **Input domain:** RDF/JS dataset-like value with `getQuads()`, graph export scope `default`, `named`, or `all`, target RDF format/MIME, and optional adapter runtime.
- **Output range:** `{ text, count, format, mimeType, warnings }`.
- **Error model:** throws for invalid dataset, unsupported scope, missing runtime for scoped N3-backed exports, unsupported output format, and non-empty graph selections that serialize to empty text.
- **Logging:** none.
- **Side effects:** none.
- **Promotion use:** Axiolotl workspace export, TOM ontology artifact export, Table Nova RDF output export, OCD inspection export, DocxHund RDF export, and future Graphite graph export.
- **Important constraint:** Turtle and N-Triples are triple syntaxes. Named graph exports should use TriG, N-Quads, or JSON-LD if graph names must be preserved.
- **Triple-syntax behavior:** When a selected graph export is serialized to Turtle or N-Triples, graph names are intentionally flattened to the default graph before serialization. This prevents TriG-like graph syntax from leaking into Turtle output. TriG, N-Quads, and JSON-LD remain the graph-preserving choices.

Supporting helpers:

- `selectRdfGraphExportQuads(dataset, { scope, defaultGraphTerm })` selects only default graph triples, only named graph quads, or all quads.
- `createRdfGraphExportDataset(dataset, { scope, runtime })` creates a runtime-native scoped dataset/store for serialization.
- `assertNonEmptyRdfGraphExport(text, { count, mimeType })` prevents silent zero-byte downloads when a non-empty graph selection serializes incorrectly.
- `flattenRdfQuadsToDefaultGraph(quads, dataFactory)` supports explicit flattening when apps need triples-only output from graph-scoped data.

## Conditional App Changes

|App|Change if promoted package is adopted|
|:---|:---|
|OntoEagle|Replace local parse dispatch with `parseRdfText` once vendor adapters land. Convert app JSON-LD graph exports/projections to build quads first, then call `serializeRdfDataset(..., { format: 'jsonld' })` where the output is RDF data rather than search-specific metadata.|
|CQ Ferret|Use `createRdfQuadsFromObjects` for competency question records and metadata. JSON-LD export should serialize those quads instead of maintaining a separate JSON-LD construction path.|
|tabular-ontology-maker|Keep TOM row interpretation and axiom rules local. Use `createRdfQuadsFromObjects` for straightforward row-to-triple mappings where possible, then use `serializeRdfGraphExport`/`serializeRdfDataset`; remove local `serializeQuads`/JSON-LD conversion after adapter parity is reached.|
|axiolotl|Keep IndexedDB, Comunica, workspace, and named graph orchestration local. Use shared parser/serializer and `serializeRdfGraphExport` for pure RDF text boundaries.|
|visual-lynx|Replace transformer internals with shared parse/serialize plus adapter hooks. Keep D3 and Mermaid projections outside RDF I/O.|
|ontology-curation-manager|Likely source/pilot. Move `rdf-io.js` behavior into adapters and keep compatibility exports.|
|ontology-tabulator|Replace parse core with `parseRdfText`; keep table extraction local.|
|iri-swapper|Parse uploaded ontology through shared parser, then apply named graph/run mapping locally. Serialize filtered run quads through shared serializer.|
|table-nova|Use `createRdfQuadsFromObjects` or local dataset builders for schema/instance data, then use `serializeRdfGraphExport`/`serializeRdfDataset`; JSON-LD comes from the same quads.|
|DocxHund|Use `serializeRdfGraphExport` for any RDF-backed document/project graph export. Keep DOCX rendering local.|
|Graphite|Use `selectRdfGraphExportQuads` for graph-scope UI controls and `serializeRdfGraphExport` for download/export surfaces. Keep graph editing and visualization local.|

## File Structure Created

```text
packages/rdf-io/
  src/
    index.js
    graph-export.js
    jsonld-adapter.js
    n3-adapter.js
    object-to-rdf.js
    rdf-model.js
    rdflib-adapter.js
    runtime.js
    serialize-rdf.js
  __tests__/
    rdf-io.test.js
  package.json
  promoted-function-proposal.md
```

## Adapter Layer Added

- `parseRdfTextWithAdapters(text, options)` dispatches to N3, jsonld.js, or rdflib based on normalized RDF format.
- `serializeRdfDatasetWithAdapters(dataset, options)` serializes through N3, jsonld.js, or rdflib when a runtime is available.
- `runtime.js` normalizes RDF aliases and MIME types, resolves browser globals, and maps formats to adapter families.
- `n3-adapter.js` covers Turtle, TriG, N3, N-Triples, and N-Quads parse/serialize.
- `jsonld-adapter.js` covers JSON-LD to RDF via `jsonld.toRDF` and RDF to JSON-LD via `jsonld.fromRDF`.
- `rdflib-adapter.js` covers RDF/XML parse/serialize and RDF/JS/rdflib term conversion.

## Adapter Work Still Required Before Full Migration Waves

- Add real vendor-backed browser smoke tests in at least OntoEagle and one RDF-heavy app.
- Decide whether Visual Lynx RDF/XML repair is strict opt-in or an app-specific preprocessor.
- Add fixtures shared with OCM and Visual Lynx before migration waves.
- Characterize N3 prefix preservation and RDF/XML prefix serialization against real vendor libraries.
- Replace app-local parser/serializer branches incrementally, starting with simple import/export surfaces.

## Deferred Promotion Candidates

These functions came up during the first app rewiring wave. They should receive a second look before the RDF parsing/serialization cycle is closed, but they should not be folded into the current parser/serializer API until their boundaries are explicit.

|Candidate|Observed locations|Proposed package-level shape|Decision note|
|:---|:---|:---|:---|
|RDF format detection from file names|OCM `detectRdfFormat`, Ontology Tabulator `detectRdfFormatFromFilename`, IRI Swapper `detectOntologyFormat`|`detectRdfFormatFromFileName(fileName, options)` returning `{ format, mimeType, extension, supported, warnings }`|Promote into `rdf-io` or `format-registry` after deciding whether RDF IO owns extension support policy.|
|Supported RDF file-name check|OCM `isSupportedRdfFileName`|`isSupportedRdfFileName(fileName, options)`|Should share the same source table as format detection so `.owl`, `.rdf`, `.ttl`, `.trig`, `.jsonld`, `.nt`, and `.nq` stay consistent.|
|Format-aware RDF prefix extraction|IRI Swapper `parseTurtlePrefixes`, `parseXmlnsPrefixes`, `parseJsonLdPrefixes`; Visual Lynx `extractRdfXmlPrefixes`|`extractRdfPrefixesFromText(text, { format })`|Likely belongs near namespace/format registry helpers, with RDF IO using it for parser result metadata.|
|RDF/XML namespace repair|Visual Lynx `repairRdfXmlUnqualifiedElements`|`repairRdfXmlNamespaces(text, { baseIri })`|Useful but must be opt-in. It changes invalid RDF/XML into parseable RDF/XML and should return a warning such as `rdfxml-repair-applied`.|
|RDF dataset summary|IRI Swapper `computeStatsFromQuads`|`summarizeRdfDataset(dataset)`|Pure utility. Return counts for quads, subjects, predicates, objects, named graphs, literals, IRIs, and blank nodes.|
|Ontology import target derivation|TOM `deriveOntologyImportTarget` and TOM utility tests|`deriveOntologyImportTarget(quads)` in a future ontology-model/ontology-rdf package|Do not put in generic RDF IO unless the package grows an ontology-specific submodule. It interprets OWL ontology semantics, not RDF syntax.|

## App Contract Test Gaps

The current shared Jest suite covers the core adapter contract, dependency-free N-Triples/N-Quads, JSON-LD projection, object-to-RDF projection, and mocked N3/jsonld/rdflib adapters. It does not yet preserve every app-level behavior that was already tested in source apps.

Before declaring `rdf-io` canonical, add a second Jest file such as `__tests__/rdf-io-app-contract.test.js` with parity cases from OCM and TOM:

- Alias normalization: `ttl`, `json-ld`, `application/rdf+xml`, `nq`.
- Filename detection: `.ttl`, `.trig`, `.jsonld`, `.rdf`, `.owl`, and unknown extension fallback.
- Supported filename checks: RDF extensions accepted and `.txt` rejected.
- N3-compatible round trips for Turtle, N-Triples, N-Quads, TriG, and N3.
- JSON-LD parse and serialize round trip through mocked `jsonld.toRDF` and `jsonld.fromRDF`.
- RDF/XML parse and serialize round trip through mocked rdflib.
- rdflib `Collection` conversion into RDF list triples.
- Malformed JSON-LD error behavior.
- Unsupported file type rejection behavior for app-facing file names.
- TOM ontology import target derivation cases, if that function is promoted into an ontology-specific package.

## RDF/XML Runtime Caveat

RDF/XML support requires an rdflib-compatible runtime. Apps that copy the piecemeal `rdf-io` modules but do not load `$rdf` should treat RDF/XML as unavailable or provide an explicit app-level fallback. During the first app wave, TOM had N3 and jsonld vendors available but no rdflib vendor in its docs tree, so RDF/XML should not be considered complete there until that runtime is added.
