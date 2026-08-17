# Parsing and Serialization Next Steps

## Purpose

This note captures the likely next capability families after `browser-file-io`. It is intentionally a planning note, not an implementation spec. The next cycle should still begin with inventory and comparison using the roadmap templates.

## Boundary Decisions

- `browser-file-io` owns browser file reads, Blob creation, download triggering, and file input accept attributes.
- `format-registry` owns generic format descriptors: extensions, MIME types, aliases, categories, preferred output extensions, and parser-format metadata.
- Parser packages should consume `format-registry` results rather than duplicating MIME or extension detection.
- Serializer packages should consume `format-registry` descriptors for output MIME and extension choices, but own writer options, output contracts, and serialization warnings.
- App code should eventually orchestrate these packages, not implement shared parser or serializer behavior inline.

## Likely Capability Families

### RDF Parsing

Candidate scope:

- Parse RDF text into an RDF/JS-compatible store or quad array.
- Support Turtle, N3, N-Triples, N-Quads, TriG, JSON-LD, and RDF/XML where current apps already support them.
- Normalize parser errors into a predictable structure.
- Preserve base IRI handling, prefix extraction, named graph behavior, and parser warnings.
- Keep vendor adapters explicit: N3, jsonld, rdflib, Comunica-adjacent ingest paths.

Likely promoted functions:

- `parseRdfTextToStore(text, options)`
- `parseRdfTextToQuads(text, options)`
- `parseRdfTextToJsonLdGraph(text, options)`
- `detectRdfParserPlan(input, options)`

`detectRdfParserPlan` should call `format-registry`; it should not own generic MIME detection itself.

### RDF Serialization

Candidate scope:

- Serialize RDF/JS stores or quads to Turtle, N-Triples, N-Quads, TriG, JSON-LD, and RDF/XML where supported.
- Normalize prefix handling through `namespace-registry`.
- Preserve app needs around pretty output, native prefixes, named graph preservation, and JSON-LD shape.
- Make serializer limitations explicit, especially where vendor libraries do not preserve graph or prefix behavior.

Likely promoted functions:

- `serializeRdfStore(store, options)`
- `serializeRdfQuads(quads, options)`
- `createRdfSerializationPlan(outputMimeType, options)`
- `normalizeRdfSerializationWarnings(warnings, context)`

### Tabular Parsing

Candidate scope:

- Parse CSV, TSV, XLS, and XLSX into a stable intermediate table shape.
- Normalize header handling, delimiter inference, blank rows, BOMs, quoted values, escaped quotes, and parser warnings.
- Keep SheetJS and PapaParse as explicit vendor adapters.
- Separate parser output from app-specific validation and merge behavior.

Likely promoted functions:

- `parseDelimitedText(text, options)`
- `parseSpreadsheetArrayBuffer(buffer, options)`
- `parseTabularFileContent(content, options)`
- `normalizeTabularRows(rows, options)`
- `normalizeTabularParserWarnings(warnings, context)`

### Mapping File Parsing

Candidate scope:

- Parse IRI mapping files from CSV, TSV, XLS, and XLSX.
- Normalize old/new IRI column detection.
- Report duplicate source IRIs, empty mappings, invalid IRIs, and unsupported headers.
- Return both `Map` output and diagnostics for UI reporting.

Likely promoted functions:

- `parseIriMappingRows(rows, options)`
- `detectIriMappingColumns(headers, options)`
- `createIriMappingMap(rows, options)`

This may live under tabular parsing or become a domain-specific package depending on overlap found during inventory.

### SPARQL Parsing and Rewriting

Candidate scope:

- Extract SPARQL prefixes.
- Parse SPARQL query structure where a parser is available.
- Rewrite IRIs and prefixed names while preserving comments, strings, and query syntax.
- Report skipped or ambiguous replacements.

Likely promoted functions:

- `extractSparqlPrefixMap(text, options)`
- `parseSparqlQuery(text, options)`
- `rewriteSparqlIris(text, mapping, options)`
- `summarizeSparqlRewrite(input, output, mapping)`

## App-Specific Follow-Ups

|App|Parsing/serialization follow-up|
|:---|:---|
|OntoEagle|Move `rdf_io.js` RDF parsing and JSON-LD graph conversion behind RDF parser/serializer packages.|
|CQ Ferret|Treat CSV import/export as tabular serialization/parsing work. Current upload behavior is fragile around headers, quoting, and global DB dependencies.|
|tabular-ontology-maker|Split SheetJS parsing, RDF parsing, validation, and table merge behavior. Parser packages should stop before TOM-specific validation and merge.|
|axiolotl|Separate RDF file ingest from IndexedDB graph persistence. Classic-script dynamic imports can remain until a module-structure pass.|
|ontology-curation-manager|Separate RDF parser preparation from report generation. Keep report-specific models local until export serialization is inventoried.|
|visual-lynx|Separate parse, transform, serialize, and visualization-export phases in `linked-data-transformer-functions.js`.|
|sparql-pattern-visualizer|Inventory SPARQL parser and graph extraction behavior before adding browser upload features.|
|ontology-tabulator|Separate RDF-to-table parsing from CSV table export.|
|table-nova|Promote CSV/TSV/XLSX parsing before touching ontology/table modeling behavior.|
|iri-swapper RDF|Promote mapping parser and RDF serializer/rewrite behavior separately.|
|iri-swapper SPARQL|Promote mapping parser and SPARQL rewrite behavior separately.|

### IRI Swapper Browser-File Read Cleanup

IRI Swapper is aligned with this cycle on downloads, but its read side should be completed during the parsing cycles so parser adoption and file-boundary adoption happen together.

Current state:

- `D:\GitHub\iri-swapper\docs\app\ont-iri-swapper.js` imports and uses `downloadTextFile`.
- `D:\GitHub\iri-swapper\docs\app\sparql-iri-swapper.js` imports and uses `downloadTextFile`.
- Both pages include the piecemeal `browser-file-io` shared modules and precache them.
- The RDF and SPARQL app modules still call native `file.text()` and `file.arrayBuffer()` directly before RDF, SPARQL, CSV/TSV, and XLS/XLSX parsing.

Fix when RDF/SPARQL/tabular parser packages are adopted:

- Import `readFileAsText` and `readFileAsArrayBuffer` from `./shared/browser-file-io/index.js` in both IRI Swapper app modules.
- Replace ontology/query/mapping text reads with `readFileAsText(file)`.
- Replace workbook binary reads with `readFileAsArrayBuffer(file)`.
- Keep parsing decisions in the parser packages: RDF parser, SPARQL parser/rewrite, tabular parser, and IRI mapping parser should consume the text or buffer returned by `browser-file-io`.
- Do not move PapaParse, SheetJS, N3, jsonld, rdflib, token scanning, rewrite logic, or IndexedDB persistence into `browser-file-io`.

Known direct-read locations as of 2026-07-27:

- `D:\GitHub\iri-swapper\docs\app\ont-iri-swapper.js`: ontology text read in `parseOntologyToNQuads`.
- `D:\GitHub\iri-swapper\docs\app\ont-iri-swapper.js`: CSV/TSV mapping text read in `ingestMapping`.
- `D:\GitHub\iri-swapper\docs\app\ont-iri-swapper.js`: XLS/XLSX mapping buffer read in `ingestMapping`.
- `D:\GitHub\iri-swapper\docs\app\sparql-iri-swapper.js`: query text read in `ingestQueryFile`.
- `D:\GitHub\iri-swapper\docs\app\sparql-iri-swapper.js`: CSV/TSV mapping text read in `ingestMappingFile`.
- `D:\GitHub\iri-swapper\docs\app\sparql-iri-swapper.js`: XLS/XLSX mapping buffer read in `ingestMappingFile`.

## First Inventory Pass

Start by copying the capability templates into one or more new package folders. Recommended order:

1. `packages/rdf-parser`
2. `packages/rdf-serializer`
3. `packages/tabular-parser`
4. `packages/iri-mapping-parser`
5. `packages/sparql-parser-rewriter`

The cycle may merge or split these after inventory. Do not assume all parser behavior belongs in one package.

## Specific Risks To Capture

- CSV import/export code often assumes a narrow schema and may fail on BOMs, quoted newlines, or alternate header names.
- RDF/XML support depends on rdflib in several apps and has different behavior than N3/jsonld paths.
- JSON-LD parsing may return N-Quads as an intermediate representation; preserve that explicitly in contracts.
- Named graph preservation differs by format and vendor serializer.
- Prefix handling crosses parser, serializer, and namespace-registry boundaries; contracts should specify who owns each step.
- Vendor code should not be edited as part of capability promotion unless the user explicitly approves it.
