# Tabular Parsing and Serialization Headless API Audit

Date: 2026-08-15

## Scope

This package owns dependency-free delimited text parsing and serialization, CSV/TSV table-shape helpers, query-record exchange over delimited text, and IRI mapping row normalization.

It does not own browser file reads, downloads, File System Access, IndexedDB persistence, UI status, spreadsheet workbook parsing, RDF generation, ontology modeling, or app-specific report/schema projection.

## Headless Boundary Finding

The promoted CSV/TSV surface is fully headless.

- Core functions accept strings, row arrays, record objects, and explicit options.
- Core functions return data structures, warnings, or delimited text.
- No function touches DOM, `File`, `Blob`, `FileReader`, downloads, storage, network, or vendor libraries.

XLS/XLSX remains outside this package's current stable headless API. A future SheetJS adapter can be added with explicit runtime injection, following the same pattern used by `rdf-io`.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### Delimited Text Grammar

- `detectDelimitedTextDelimiter(text, options)`
- `parseDelimitedText(text, options)`
- `escapeDelimitedCell(value, options)`
- `serializeDelimitedRows(rows, options)`
- `serializeDelimitedRecords(records, options)`
- `rowsToRecords(rows, headers)`

### CSV/TSV Table Shape

- `detectCsvOrTsvDelimiter(text)`
- `parseDelimitedLine(line, delimiter)`
- `parseDelimitedTextAsHeaderRows(text, delimiterHint)`
- `applyHeaderRowOptions(tabular, treatFirstRowAsHeader, headerRowNumber)`

### Query Record Exchange

- `QUERY_RECORD_HEADERS`
- `serializeQueryRecordsToDelimitedText(queryRecords, options)`
- `parseQueryRecordsFromDelimitedText(text, options)`

This API is query-language-neutral. It supports SQL, SPARQL, NoSQL, Cypher, GraphQL, Gremlin, and unknown query languages as normalized strings with warnings.

### IRI Mapping Rows

- `createIriMappingFromRows(rows, options)`

This is a domain adapter over already-parsed tabular records. It does not parse CSV itself.

## Input Contracts

- Delimited parsers accept text and optional delimiter/header options.
- Serializers accept row arrays or record arrays plus explicit delimiter/newline/header options.
- Query-record parsers accept delimited text with recognized header aliases.
- IRI mapping accepts parsed row records and explicit old/new header aliases when defaults are insufficient.
- `duplicatePolicy` for IRI mapping must be one of `first`, `last`, or `error`.

## Output Contracts

`parseDelimitedText` returns:

```js
{
  headers,
  rows,
  records,
  delimiter,
  warnings
}
```

Query parsing returns:

```js
{
  records,
  warnings,
  delimiter
}
```

IRI mapping returns:

```js
{
  mapping,
  meta,
  warnings
}
```

Serializers return delimited text only. They do not create `Blob`, write files, download files, or persist records.

## Error Model

- Delimited parsing is tolerant and returns warnings for recoverable row/header problems.
- Unterminated quotes produce an `unterminated_quote` warning while preserving parsed content.
- Duplicate headers, blank headers, short rows, and wide rows produce stable warning codes.
- Query rows missing required query text/language are skipped with warnings.
- Unknown query languages are retained as normalized values with an `unknown_query_language` warning.
- IRI mapping throws for missing required old/new columns, conflicting mappings when `duplicatePolicy: 'error'`, and unsupported duplicate policies.

## Adapter Rule

Browser adapters may:

- read text using `browser-file-io`;
- detect file format using `format-registry`;
- call this package with explicit delimiter/header options;
- write results to IndexedDB through the data-management package;
- download returned text through `browser-file-io`;
- render warnings through `ui-feedback`.

Browser adapters must not:

- reimplement CSV/TSV grammar;
- parse delimited text inside DOM handlers;
- combine file reading with parsing in reusable core functions;
- call SheetJS/PapaParse directly inside app workflows once a future workbook adapter exists;
- turn IRI mappings, query records, or ontology rows into durable data without explicit app/project storage functions.

## Spreadsheet Adapter Deferred

XLS/XLSX support should be implemented as a separate adapter over this package's row/record contracts:

```js
parseWorkbookBytesToRows(bytes, { runtime: { XLSX }, sheet })
```

That future adapter should accept `ArrayBuffer`/`Uint8Array`, require explicit SheetJS runtime injection in headless contexts, and return the same table shape used by the delimited parsers.

## Headless Coverage

Jest coverage exercises:

- CSV/TSV delimiter detection;
- quoted cells and escaped quotes;
- embedded newlines;
- BOM removal;
- duplicate/blank headers;
- short and wide row warnings;
- generated headers for no-header tables;
- unterminated quote warnings;
- CRLF and quote-all serialization;
- explicit record header order;
- SQL/SPARQL/NoSQL query record round trips;
- legacy Axiolotl saved-query headers;
- query fields containing commas, quotes, and newlines;
- TSV query exchange and unknown-language warnings;
- IRI mapping duplicate, missing value, missing header, conflict, and invalid policy behavior.

## Maturity Assessment

Current maturity: Level 5 for scoped CSV/TSV parsing, delimited serialization, query-record exchange, and IRI mapping row normalization.

Rationale:

- public functions are headless and deterministic for supplied inputs;
- active app CSV/TSV parser/serializer duplicates reviewed in this cycle were rewired or reduced to domain row projection;
- warning and error behavior is stable and tested;
- browser/file/download/storage concerns are outside the package;
- workbook parsing is explicitly deferred as a runtime-injected adapter rather than smuggled into generic parsing.
