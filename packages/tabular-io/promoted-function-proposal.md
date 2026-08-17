# Promoted Function Proposal: Tabular I/O

## Deep Comparison Summary

The candidate functions divide into four reusable capabilities:

1. Delimited text parsing.
2. Delimited text serialization.
3. Query-record CSV/TSV exchange for SQL, SPARQL, and NoSQL queries.
4. IRI mapping row normalization.

IRI mapping should remain separate from generic tabular parsing. Query-record
exchange should be generic rather than SPARQL-only because CQ Ferret and future
apps need to store SQL/SPARQL/NoSQL query artifacts with the same tabular
contract.

## Naming, Domain, and Range

|Capability|Canonical function|Domain|Range|
|:---|:---|:---|:---|
|Delimited parsing|`parseDelimitedText(text, options)`|CSV/TSV-style text|`{ headers, rows, records, delimiter, warnings }`|
|Delimited serialization|`serializeDelimitedRows(rows, options)`|2D rows|CSV/TSV-style text|
|Record serialization|`serializeDelimitedRecords(records, options)`|Record objects plus headers|CSV/TSV-style text|
|Cell escaping|`escapeDelimitedCell(value, options)`|Scalar value|Escaped cell text|
|Query exchange parse|`parseQueryRecordsFromDelimitedText(text, options)`|Delimited query records|Normalized query records plus warnings|
|Query exchange serialize|`serializeQueryRecordsToDelimitedText(records, options)`|SQL/SPARQL/NoSQL query records|Delimited text|
|IRI mapping rows|`createIriMappingFromRows(rows, options)`|Parsed tabular records|`Map` plus metadata and warnings|

## Error Handling and Logging

Canonical functions do not log. They either:

- return structured warnings for recoverable data issues; or
- throw for violated contracts that prevent meaningful output.

Examples:

- Duplicate headers produce warnings and normalized header names.
- Short/wide rows produce warnings and normalized row widths.
- Missing IRI mapping headers throw.
- Conflicting IRI mappings can warn or throw depending on `duplicatePolicy`.

## App Adoption Impact

|App|Change if adopted|
|:---|:---|
|OntoEagle CQ Ferret|Replace inline CSV upload parser with `parseDelimitedText`; keep CQ graph reconstruction local. Replace nested CSV escaping with `serializeDelimitedRecords` or `serializeDelimitedRows`. Use query-record helpers for database-query artifacts later.|
|OntoEagle term extractor|Replace local `escapeCsv`/`exportRowsToCsv` with record/row serializer.|
|tabular-ontology-maker|Replace CSV export helpers with `serializeDelimitedRows`; split `parseSpreadsheetData` into browser read, delimited parser, and future workbook adapter.|
|Axiolotl|Adapt saved query CSV import/export to generic query records, preserving legacy header import as an adapter. Keep IndexedDB import/export local.|
|ontology-curation-manager|Replace `csvEscape`/`rowsToCsv` and measures delimiter helpers with `serializeDelimitedRows`; keep report row builders local.|
|ontology-tabulator|Replace `tableModelToCsv` internals with `serializeDelimitedRows`, ensuring headers are escaped.|
|IRI Swapper RDF/SPARQL|Use `parseDelimitedText` or future workbook adapter for mapping rows, then `createIriMappingFromRows`; remove duplicate `rowsToMapping` functions after adoption.|
|table-nova|Use `parseDelimitedText` as the stronger CSV/TSV parser surface or keep Table Nova parser as compatibility adapter; use `serializeDelimitedRecords` for data dictionary CSV.|
|visual-lynx|No direct tabular migration currently required.|

## Why This Is Not a Frankenstein Function

The proposal does not create a single `processTabularFile` API. It keeps these
boundaries explicit:

```text
browser File -> browser-file-io -> tabular parser -> domain adapter -> app state
app records -> tabular serializer -> browser-file-io -> download
```

That structure lets each app adopt only the relevant layer.
