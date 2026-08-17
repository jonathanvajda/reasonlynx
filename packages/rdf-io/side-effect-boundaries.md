# RDF Parsing and Serialization Side-Effect Boundaries

## Boundary Decision

`rdf-io` should own RDF syntax parsing, RDF syntax serialization, vendor adapter normalization, RDF/JS/rdflib term conversion, and structured parse/serialize results.

It should not own browser file reading, download triggering, IndexedDB access, DOM event handling, app toasts, workspace/run selection, SPARQL parsing, tabular-to-RDF mapping, or ontology metadata projection.

## Boundary Table

|Concern|Current examples|Canonical boundary|Reason|
|:---|:---|:---|:---|
|RDF text parsing|OCM `parseRdfInput`, Visual Lynx `parseToStore`, OntoEagle `parseRdfToStore`|Core `parseRdfText`|Pure enough to share; central capability.|
|RDF serialization|OCM `serializeRdfStore`, Visual Lynx `serializeFromStore`, Table Nova `writeWithN3`|Core `serializeRdfDataset`|Pure enough to share; central capability.|
|RDF format conversion|Visual Lynx `transformText`|Core convenience `convertRdfTextFormat`|Composition of parse and serialize with no UI/storage side effects.|
|Browser File reading|TOM `parseOntologyData`, IRI Swapper `parseOntologyToNQuads`|Browser adapter `parseRdfFile`; file text read from `browser-file-io`|File APIs are browser platform concerns.|
|Download/Blob behavior|Axiolotl export callers, IRI Swapper download flows, Table Nova export UI|`browser-file-io` / download utility capability|Serialization returns text; download uses serialized text.|
|IndexedDB / run/workspace reads|IRI Swapper `serializeRun`, Axiolotl workspace export callers|App adapter or future storage package|Storage access should not happen inside RDF serializer.|
|Named graph assignment|IRI Swapper run graph ingest, Axiolotl named graph loader|Graph operations or app adapter|Assigning graph names changes graph semantics; parsing should report source quads.|
|RDF/XML repair|Visual Lynx `repairRdfXmlUnqualifiedElements`, rdflib sugar helpers|Optional adapter behavior under `repairRdfXml` option|Repair is useful but should be explicit and fixture-tested.|
|Term conversion between RDF/JS and rdflib|OCM and Visual Lynx conversion helpers|Internal vendor adapter helpers|Required for RDF/XML support, but not normal public API.|
|Prefix extraction and application|Visual Lynx prefix extraction, OCM namespace shared helpers, IRI Swapper prefix parsers|Use namespace/format registry helpers where possible; return prefixes in RDF I/O results|Prefix handling is cross-cutting but RDF parser should preserve discovered prefixes.|
|App-domain ontology builders|TOM `generateRdfString`, Table Nova `buildOntologyTurtle`|Domain package/app adapter builds dataset, then calls `serializeRdfDataset`|Mapping rows/schemas to ontology triples is not syntax serialization.|
|Ontology metadata extraction|OntoEagle `parseRdfTextToJsonLd`, `parseGraphJsonLdText` callers|Ontology metadata extraction capability|These functions interpret graph content, not just parse RDF syntax.|
|SPARQL page handling|IRI Swapper SPARQL page prefix/query parsing|SPARQL capability family|SPARQL is not RDF syntax parsing/serialization.|

## Proposed Package Structure From Roadmap

```text
packages/rdf-io/
  adapter/
    n3-adapter.js
    jsonld-adapter.js
    rdflib-adapter.js
    runtime.js
  core/
    parse-rdf.js
    serialize-rdf.js
    convert-rdf-format.js
    rdf-result.js
    rdf-error.js
  vendor/
    n3.min.js
    jsonld.min.js
    rdflib.min.js
  fixtures/
    README.md
```

## Logging Boundary

The core package should not call `console`, show toasts, or write status text.

Use returned warnings and optional observer hooks:

```js
await parseRdfText(text, {
  fileName: "ontology.ttl",
  onWarning(warning) {
    // App may log, toast, or ignore.
  }
});
```

Warnings should also be included in the result object so non-UI tests can assert them.

## Error Boundary

Core parser/serializer errors should be predictable and machine-readable:

- `invalid-input`
- `unsupported-format`
- `missing-runtime-library`
- `parse-error`
- `serialize-error`
- `invalid-json`
- `invalid-jsonld`
- `rdfxml-repair-applied`

Application adapters may convert these errors to UI messages, but they should not wrap them so heavily that source line, format, and vendor details are lost.

## Migration Notes By App

|App|Future adapter after package adoption|
|:---|:---|
|OntoEagle|Replace `parseRdfToStore` internals with `parseRdfText`; keep `storeToJsonLdGraph` or move it to ontology metadata/projection.|
|tabular-ontology-maker|Keep row-to-quad builders local; replace N3/JSON-LD parse and serialize helpers with shared parser/serializer.|
|axiolotl|Keep workspace and IndexedDB orchestration local; replace pure N3/rdflib/jsonld serializer helpers with shared functions.|
|visual-lynx|Replace transformer internals with `parseRdfText`, `serializeRdfDataset`, and `convertRdfTextFormat`; keep D3/Mermaid projection outside RDF I/O.|
|ontology-curation-manager|Likely source/pilot app; move `rdf-io.js` into shared package and retain thin compatibility exports.|
|ontology-tabulator|Replace parser core with shared `parseRdfText`; keep table extraction local.|
|iri-swapper|Keep run graph, mapping, storage, and download flows local; use shared parser before named-graph assignment and shared serializer after graph filtering.|
|table-nova|Keep table/schema-to-dataset builders local; replace N3/jsonld serializers with shared `serializeRdfDataset` and optional batch wrapper.|
