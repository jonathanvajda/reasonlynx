# Tabular Parsing and Serialization Naming Decisions

## Naming Principles

- Name functions by action and data boundary.
- Avoid app-specific names such as `downloadCSV`, `parseSpreadsheetData`, or `rowsToMapping` for generic package exports.
- Avoid format-specific names where a delimiter or MIME option is the real variation.
- Keep IRI mapping names domain-specific; do not hide mapping semantics inside generic tabular parser names.

## Decision Table

|Decision ID|Old name(s)|Proposed canonical name|Accepted?|Reason|Rejected alternatives|Migration notes|
|:---|:---|:---|:---:|:---|:---|:---|
|NAME-001|`escapeCSV`, `escapeCsv`, `csvEscape`, `escapeCsvField`, `escapeCsvCell`, `delimitedEscape`|`escapeDelimitedCell(value, options)`|Proposed|The behavior applies to CSV and TSV when delimiter, quote, newline, and quote policy are options.|`escapeCsv`, `quoteCell`, `sanitizeCsv`|CSV-specific wrappers can call this with `{ delimiter: ',' }`.|
|NAME-002|`rowsToCsv`, `generateCsvString`, `tableModelToCsv`|`serializeDelimitedRows(rows, options)`|Proposed|Names the action, input shape, and delimiter-configurable output.|`serializeCsv`, `exportRows`, `rowsToText`|App-specific table/model conversion should happen before this call.|
|NAME-003|`serializeDataDictionaryCsv`, fixed report CSV builders|`serializeDelimitedRecords(records, options)` plus app row builders|Proposed|Record-object input is common when headers are known; generic serializer should not know report/data-dictionary schemas.|`serializeObjectsToCsv`, `recordsToCsv`|Domain-specific wrappers should supply headers and field access.|
|NAME-004|`detectDelimiterFromLine`|`detectDelimitedTextDelimiter(text, options)`|Proposed|Delimiter detection should inspect enough text to handle realistic files, not just one line.|`detectCsvDelimiter`, `guessDelimiter`|Use `format-registry` for extension/MIME classification; this only detects text delimiter.|
|NAME-005|`parseLine`|`parseDelimitedLine(line, options)`|Deferred|Line-level parser may be unnecessary if PapaParse owns CSV grammar.|`parseCsvLine`|Expose only if there is a real app need after parser selection.|
|NAME-006|`parseCsvOrTsvText`, CQ Ferret inline parser, Axiolotl parser|`parseDelimitedText(text, options)`|Proposed|Matches roadmap example and covers CSV/TSV via options.|`parseCsvText`, `parseTableText`, `processCsv`|Should return a normalized dataset plus warnings, not app records directly.|
|NAME-007|`applyHeaderRowOptions`|`applyHeaderSelection(tabularDataset, options)`|Proposed|The operation selects a header row and returns normalized table shape.|`applyHeaderRowOptions`, `useHeaderRow`|Could be private if folded into `parseDelimitedText`.|
|NAME-008|`detectTabularType`|`detectTabularFormatFromFilename(filename, options)`|Proposed|Names filename source and tabular result.|`detectTabularType`, `getFileType`|Should consume `format-registry` descriptors.|
|NAME-009|`parseXlsxArrayBuffer`, `parseSpreadsheetData` workbook branch|`parseWorkbookArrayBuffer(buffer, options)`|Proposed|Covers XLS/XLSX workbook input without browser File reads.|`parseXlsx`, `parseSpreadsheetData`|SheetJS adapter should live behind this function.|
|NAME-010|`parseSpreadsheetData`|`parseTabularFileContent(content, options)`|Deferred|Potential adapter that accepts already-read text/buffer plus format metadata.|`parseFile`, `handleSpreadsheet`|Do not accept browser `File` in core parser.|
|NAME-011|`rowsToMapping`, `parseIriMappingCsv`|`createIriMappingFromRows(rows, options)` and `parseIriMappingDelimitedText(text, options)`|Proposed for adjacent package|IRI mapping is domain-specific and should sit over generic tabular parsing.|`rowsToMapping`, `parseMappingCsv`|Likely belongs in `packages/iri-mapping-parser`, not generic `tabular-io`.|
|NAME-012|`savedQueriesToCsv`, `parseSavedQueriesCsv`|`serializeSavedQueriesToCsv`, `parseSavedQueriesCsvText`|App adapter|Names are acceptable because the schema is app-owned, not generic.|`serializeDelimitedRows` directly|Use generic serializer/parser underneath but keep saved-query schema local.|

## Notes

- `parseDelimitedText(text, options)` remains the central parser name because it is already used as the roadmap example.
- The package name `tabular-io` is used for the documentation pass because the roadmap's initial package sketch uses that path and because this cycle includes both parsing and serialization.
- If implementation later splits parsing and serialization, keep these docs as the capability family root and create subpackage notes under it.
