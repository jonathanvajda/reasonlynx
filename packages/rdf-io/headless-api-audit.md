# RDF Parsing and Serialization Headless API Audit

Date: 2026-08-15

## Scope

This package owns RDF/JS term construction, dataset normalization, dependency-free line-format parsing/serialization, object-to-RDF projection, RDF graph export scope selection, and adapter-based RDF parsing/serialization through N3, jsonld.js, and rdflib.

It does not own browser file reads, downloads, IndexedDB persistence, File System Access sync, UI status, ontology-specific metadata policy, SPARQL execution, or app-specific row/schema-to-ontology mapping.

## Headless Boundary Finding

The package is headless-capable, but not every public function is dependency-free.

- RDF model helpers, object-to-RDF projection, line-format parsers/serializers, JSON-LD fallback projection, and graph export selection are pure or environment-neutral.
- N3, JSON-LD, and RDF/XML parsing/serialization are adapter-backed and require runtime libraries.
- Browser apps may rely on local vendor globals through `createRdfIoRuntime`.
- Headless Node, CLI, CI, and agent callers should pass explicit runtime libraries through the `runtime` option rather than depending on `globalThis`.

This is the intended boundary. Vendor parser libraries are semantic dependencies, not UI dependencies.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### RDF/JS Model

- `namedNode(value)`
- `blankNode(value)`
- `literal(value, options)`
- `defaultGraph()`
- `quad(subject, predicate, object, graph)`
- `normalizeQuad(value)`
- `datasetToQuads(dataset)`
- `createRdfDataset(quads)`

### Dependency-Free Parse/Serialize

- `normalizeRdfLineFormat(value)`
- `parseRdfText(text, options)`
- `serializeRdfDataset(dataset, options)`
- `serializeRdfDatasetToNTriples(dataset)`
- `serializeRdfDatasetToNQuads(dataset)`
- `serializeRdfDatasetToJsonLd(dataset, options)`
- `rdfDatasetToJsonLdGraph(dataset, options)`

Dependency-free parsing is intentionally limited to N-Triples and N-Quads. Turtle, TriG, JSON-LD expansion, and RDF/XML require adapters.

### Runtime and Adapter Dispatch

- `createRdfIoRuntime(runtime)`
- `normalizeRdfFormat(value)`
- `mimeTypeForRdfFormat(format)`
- `n3FormatForRdfFormat(format)`
- `adapterForRdfFormat(format)`
- `parseRdfTextWithAdapters(text, options)`
- `serializeRdfDatasetWithAdapters(dataset, options)`

### Vendor Adapters

- `parseRdfTextWithN3(text, options)`
- `serializeRdfDatasetWithN3(dataset, options)`
- `parseJsonLdTextToRdfDataset(text, options)`
- `serializeRdfDatasetWithJsonLd(dataset, options)`
- `parseRdfXmlTextToRdfDataset(text, options)`
- `serializeRdfDatasetWithRdflib(dataset, options)`
- `rdflibTermToRdfJs(term, targetQuads)`
- `rdfJsTermToRdflib(term, $rdf)`

### Object Projection and Graph Export

- `createRdfQuadsFromObjects(objects, options)`
- `createRdfQuadsFromJsonLdGraph(graph, options)`
- `RDF_GRAPH_EXPORT_MIME_TYPES`
- `isSupportedRdfGraphExportMimeType(mimeType)`
- `getRdfGraphExportGraphShape(mimeType)`
- `selectRdfGraphExportQuads(dataset, options)`
- `flattenRdfQuadsToDefaultGraph(quads, dataFactory)`
- `shouldFlattenGraphNamesForRdfGraphExport(options)`
- `createRdfGraphExportDataset(dataset, options)`
- `assertNonEmptyRdfGraphExport(text, options)`
- `serializeRdfGraphExport(dataset, options)`

## Input Contracts

- Core model functions accept RDF/JS term-like objects or strings where documented.
- Dataset functions accept arrays, iterables, RDF/JS dataset-like objects, or N3 Store-like objects.
- Dependency-free parse functions accept RDF text plus `ntriples`/`nquads` format aliases.
- Adapter parse/serialize functions accept RDF text or dataset-like inputs plus explicit `format`/`mimeType` and optional `baseIri`, `prefixes`, `context`, and `runtime`.
- Object projection accepts app-owned records plus explicit mapping metadata. It does not infer ontology semantics.
- Graph export accepts a dataset plus `scope: 'default' | 'named' | 'all'`.

## Output Contracts

Parse functions return:

```js
{
  dataset,
  quads,
  sourceFormat,
  prefixes,
  baseIri,
  warnings
}
```

Serialize functions return:

```js
{
  text,
  format,
  mimeType,
  warnings
}
```

Graph export returns the serializer result plus `count`.

Object projection returns:

```js
{
  quads,
  warnings,
  subjects
}
```

The package returns RDF text or RDF/JS data. It does not create `Blob`, write files, download files, write IndexedDB, or mutate DOM.

## Error Model

- Programmer/configuration errors throw `TypeError` or `Error`.
- Unsupported formats throw stable messages.
- Missing N3/jsonld/rdflib runtimes throw stable messages.
- Malformed line-based RDF throws `SyntaxError` with line context.
- Object projection reports row/property conversion problems as warnings when a single object value can be skipped.
- Empty serialized output for a non-empty graph export throws through `assertNonEmptyRdfGraphExport`.

Expected user-facing adapters should catch these errors and convert them into UI status, CLI exit codes, CI diagnostics, or agent/tool JSON results.

## Runtime Boundary

`createRdfIoRuntime` resolves libraries from explicit runtime options or browser globals:

```js
createRdfIoRuntime({ N3, jsonld, $rdf })
```

For headless Node/CLI/CI/agent use, explicit runtime injection is the stable contract. Browser globals exist only to support static browser app deployment with local vendor bundles.

## Adapter Rule

Browser adapters may:

- read text through `browser-file-io`;
- detect MIME/format through `format-registry`;
- pass RDF text and explicit runtime libraries into this package;
- download returned text through `browser-file-io`;
- render warnings through `ui-feedback`.

Browser adapters must not:

- call N3/jsonld/rdflib directly;
- duplicate MIME alias maps;
- parse inside DOM handlers;
- serialize inside storage or download helpers;
- write app-specific durable records inside RDF parser/serializer functions.

## Headless Coverage

Jest coverage exercises:

- RDF/JS term and dataset normalization;
- N-Triples and N-Quads parse/serialize round trips;
- unsupported dependency-free parse formats;
- object-to-RDF projection and warning behavior;
- JSON-LD graph projection from quads;
- JSON-LD-like graph to RDF quads;
- default/named/all graph export selection;
- triple-only versus quad-preserving export policy;
- N3 adapter parse/serialize with injected runtime;
- JSON-LD adapter parse/serialize with injected runtime;
- RDF/XML adapter parse/serialize with injected runtime;
- rdflib collection conversion to RDF lists;
- missing adapter runtime errors.

## Maturity Assessment

Current maturity: Level 5 for the scoped RDF parsing and serialization capability.

Rationale:

- active app parser/serializer paths reviewed in this cycle route through the shared package;
- direct app-owned calls to N3/jsonld/rdflib parser/serializer APIs were removed from reviewed apps;
- browser globals are isolated behind runtime resolution;
- Node/Jest tests exercise the public API with injected runtimes;
- triple-vs-quad export behavior is explicit and tested;
- graph export empty-output regression behavior is guarded.
