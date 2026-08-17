# Tabular I/O

Tabular I/O is the fourth capability family in the monorepo migration plan. It
covers pure CSV/TSV-style parsing and serialization, query-record exchange, and
domain adapters that consume already parsed tabular rows.

It deliberately does not read browser files or trigger downloads. Use
`browser-file-io` before and after this package:

```text
File -> readFileAsText() -> parseDelimitedText()
records -> serializeDelimitedRecords() -> downloadTextFile()
```

## Proposed Exports

```js
parseDelimitedText(text, options)
serializeDelimitedRows(rows, options)
serializeDelimitedRecords(records, options)
escapeDelimitedCell(value, options)
detectDelimitedTextDelimiter(text, options)
parseQueryRecordsFromDelimitedText(text, options)
serializeQueryRecordsToDelimitedText(queryRecords, options)
createIriMappingFromRows(rows, options)
```

## Boundaries

- Query-record exchange is generic across SQL, SPARQL, NoSQL, Cypher, GraphQL,
  and similar query languages.
- IRI mapping is a domain adapter over parsed rows. It is intentionally split
  from generic tabular parsing.
- XLS/XLSX support should be implemented through a SheetJS vendor adapter after
  dependency provenance is finalized.
