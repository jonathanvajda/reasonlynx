# Parser Capability Follow-Ups

## Purpose

Browser file I/O is now separated from parser and serializer behavior. This note records the seams that should be revisited during the next capability cycle so future parsing work does not rediscover the same boundaries.

## Boundary Rule

- `browser-file-io` should read `File`/`Blob`, create text blobs, trigger downloads, and build file-picker accept attributes.
- `format-registry` should remain the authority for generic filename, extension, MIME, descriptor, and parser-format metadata.
- Parser packages should consume `format-registry` descriptors to choose parser pipelines, parser options, vendor parser adapters, parsed output shapes, parser errors, warning normalization, and fixtures.
- App modules should orchestrate UI state and call parser/browser packages, but should not own low-level browser I/O or shared parser contracts long term.

## Follow-Up Targets

|App|Current seam|Likely parser capability|
|:---|:---|:---|
|OntoEagle|`rdf_io.js` still owns RDF parser selection and RDF/XML bridging after delegating file reads.|RDF parser adapter: `parseRdfTextToStore` / `parseRdfTextToJsonLdGraph`.|
|tabular-ontology-maker|`tom-core.js` now delegates file reads, but still combines SheetJS parsing, ontology parsing, validation, and table merge flow.|Tabular parser adapter and RDF parser adapter, with UI merge orchestration left local.|
|axiolotl|Classic-script files call shared browser utilities through dynamic imports; RDF parsing still lives near IndexedDB graph loading.|RDF graph ingest adapter and later ESM/module-structure pass.|
|ontology-curation-manager|Report download wrappers are clean, but RDF parsing, supplemental ontology preparation, and report serialization remain app-local.|RDF parser adapter and report serialization/export capability.|
|visual-lynx|`linked-data-transformer-functions.js` now delegates file reads/downloads, but still combines RDF parsing, conversion, serialization, and UI orchestration.|RDF conversion pipeline: parse, store transform, serialize, visualization export.|
|sparql-pattern-visualizer|No active browser I/O helper callers were found, but shared package files were added for consistency.|SPARQL parser/graph extraction adapter, if UI imports files later.|
|ontology-tabulator|CSV export now uses browser-file-io, while RDF table-building/parser behavior remains local.|RDF parser-to-table adapter and CSV serialization boundary.|
|table-nova|`io/fileReaders.js` is a facade over browser-file-io, but `table-nova.js` still chooses CSV/TSV/XLSX parser paths.|Tabular parser adapter for CSV, TSV, XLSX, header handling, delimiter inference, and parser warnings.|
|iri-swapper RDF|Downloads use browser-file-io; mapping ingest still mixes native reads with PapaParse/SheetJS parsing.|Mapping parser adapter plus RDF parser/serializer adapter.|
|iri-swapper SPARQL|Downloads use browser-file-io; mapping ingest and SPARQL token rewriting remain local.|Mapping parser adapter plus SPARQL parser/rewrite adapter.|

## Comment Placement

Only a few source comments were added at handoff points where a future maintainer might otherwise fold parser work back into browser I/O:

- `tabular-ontology-maker/docs/app/tom-core.js`
- `visual-lynx/docs/app/linked-data-transformer-functions.js`
- `table-nova/docs/app/table-nova.js`

IRI Swapper already uses native `file.text()` / `file.arrayBuffer()` inside parser-oriented mapping ingest functions. That should be addressed in the mapping parser cycle rather than commented heavily now.
