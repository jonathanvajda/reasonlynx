# RDF Parsing and Serialization Maturity

## Maturity Ladder

```text
0 - Local only
1 - Candidate
2 - Characterized
3 - Reusable
4 - Package ready
5 - Canonical
```

## Ratings

|Candidate IDs|Primary source|Rating|Rationale|Promotion blockers|
|:---|:---|:---:|:---|:---|
|RDF-024, RDF-025|Ontology Compliance Diagnostic `rdf-io.js`|4|Environment-neutral API, runtime injection, broad format support, JSDoc, parse and serialize dispatchers, focused test file present.|Needs extraction into `packages/rdf-io`, shared fixture suite, canonical result/error classes, and adoption by consumers.|
|RDF-020, RDF-021, RDF-022, RDF-023|Visual Lynx transformer core|3|Broad practical behavior, transform workflow, logger hooks, RDF/XML repair path, and prefix preservation.|Runtime model and result shape differ from OCM; logger side effects need structured warning output; XML repair needs opt-in contract.|
|RDF-034, RDF-035, RDF-036|Table Nova RDF serializer|3|Focused serializer module with tests and a useful multi-format export wrapper.|Module depends on globals at load time; no parse side; batch serializer should wrap a canonical single-format serializer.|
|RDF-026|OCM term conversion helpers|3|Mostly pure adapter functions with explicit runtime dependency and direct relevance to RDF/XML bridge.|Needs shared RDFJS/rdflib term fixture tests, especially collections and blank nodes.|
|RDF-001 through RDF-004|OntoEagle `rdf_io.js` parser helpers|2|Compact and easy to understand; covers N3-like, JSON-LD, and RDF/XML inputs.|Bare store output, no structured warnings, less complete format metadata, global runtime fallback.|
|RDF-008 through RDF-014|TOM parser/serializer helpers|2|Several useful N3/JSON-LD snippets and enhanced N-Quads error context.|Embedded in a large UI/workspace file; app row builders and IndexedDB/session behavior are mixed with core RDF I/O.|
|RDF-016 through RDF-019|Axiolotl graph/store serializer helpers|2|Useful coverage for rdflib and N3 stores, including JSON-LD fallback behavior.|Storage, workspace, and UI coupling around callers; inconsistent output models; fallback JSON-LD needs explicit option.|
|RDF-027|Ontology Tabulator parser|2|Clear parse-only function used for ontology-to-table import; covers common RDF inputs.|No serializer side, dynamic/global vendor loading, limited structured error model.|
|RDF-028 through RDF-033|IRI Swapper RDF page helpers|1-2|Important named-graph ingest/export behavior and useful N3/rdflib/jsonld snippets.|Browser File, run id, IndexedDB, prefix UI state, and graph rehoming are workflow concerns; only inner parser/serializer helpers should be shared.|
|RDF-005, RDF-006|OntoEagle JSON-LD graph projection|1|Useful local projection of parsed RDF/JSON-LD into app records.|Not generic RDF I/O; belongs in ontology metadata extraction or graph projection.|
|RDF-007, RDF-011, RDF-037|TOM/Table Nova domain ontology builders|0-1|They generate RDF from app-specific row/schema models.|Domain mapping should remain outside RDF I/O; only final RDF serialization should use the shared package.|

## Strongest Promotion Path

1. Use OCM `parseRdfInput` / `serializeRdfStore` as the structural baseline because it already separates runtime libraries from core behavior.
2. Pull Visual Lynx behavior into the comparison for format transform, logger/warning expectations, RDF/XML prefix extraction, and optional repair mode.
3. Pull Table Nova `writeWithN3` and `datasetToSerializations` tests/fixtures into serializer characterization.
4. Treat IRI Swapper named-graph assignment, Axiolotl workspace export, TOM row export, and OntoEagle JSON-LD graph projection as app adapters.

## Target Maturity For First Package

The first extracted package should reach **4 - Package ready** before app rewiring:

- Core parse and serialize functions are environment-neutral.
- Vendor libraries are passed through a runtime object or imported through explicit package adapters.
- Browser File, Blob, download, DOM, IndexedDB, and UI logging are outside core.
- Errors are typed or at least consistently shaped.
- Warnings are returned as data, not only logged.
- Fixtures cover TTL, TriG, N-Triples, N-Quads, JSON-LD, RDF/XML, malformed text, empty graph, prefixes, literals, blank nodes, named graphs, and RDF lists.

The package becomes **5 - Canonical** only after every intended consumer adopts it and duplicate app-local parser/serializer implementations are removed.

## Completion Update 2026-07-29

**Current package rating: 5 - Canonical for active RDF parsing and serialization paths reviewed in this cycle.**

Evidence:

- The shared `rdf-io` package owns the parser/serializer boundary, triple/quad handling, RDFJS normalization, runtime dependency adapters, and focused Jest coverage for paradigmatic RDF inputs and outputs.
- OntoEagle, TOM, Axiolotl, Axiolotl `graph-analytics.html`, Visual Lynx, OCM, Ontology Tabulator, IRI Swapper, SPARQL Pattern Visualizer, and Table Nova active RDF paths reviewed in this cycle now route RDF parsing and serialization through shared `rdf-io` package imports or app-local copies of the same package structure.
- Package Jest coverage preserves expected behavior for Turtle/N-Triples/N-Quads/TriG-style parsing, JSON-LD conversion, RDF/XML runtime behavior, serialization dispatch, triple-only output, named graph preservation, malformed input failure, and empty graph handling.

Completion evidence:

- Direct active app-owned calls to `new N3.Parser`, `N3.Writer`, `jsonld.toRDF`, `jsonld.fromRDF`, `$rdf.parse`, and `$rdf.serialize` were removed from TOM, Axiolotl, Axiolotl `graph-analytics.html`, and Visual Lynx transformer modules.
- Vendor parser/serializer calls now live inside the shared `rdf-io` adapter layer, which is the intended architecture boundary.

Regression note:

- Old app-level RDF expectations are represented by package Jest fixtures and thin app tests. Any intentional output differences should continue to be documented where app adapters normalize MIME names, return structured result objects, choose triple-vs-quad output, or preserve prefixes differently.

## 2026-08-15 Headless API Audit

Maturity remains Level 5 for the scoped RDF parsing and serialization capability.

- Dependency-free RDF model, N-Triples/N-Quads parse/serialize, object-to-RDF
  projection, JSON-LD fallback projection, and graph export scope helpers are
  environment-neutral.
- Turtle, N3, TriG, JSON-LD expansion/compaction, and RDF/XML are
  vendor-adapter capabilities. Headless callers should pass `runtime: { N3,
  jsonld, $rdf }`; browser globals remain only as static-app runtime fallback.
- The package returns RDF text, RDF/JS data, warnings, and graph export counts.
  It does not read files, download files, mutate DOM, write IndexedDB, or own UI
  status.
- Additional Jest coverage now confirms unsupported formats and missing adapter
  runtimes fail with stable messages.
