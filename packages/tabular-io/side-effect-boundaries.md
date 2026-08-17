# Tabular Parsing and Serialization Side-Effect Boundaries

## Boundary Categories

|Category|Description|Allowed examples|
|:---|:---|:---|
|Pure core|Deterministic transformation of explicit inputs into explicit outputs.|Escape cell, serialize rows, normalize headers, normalize row arrays.|
|Browser adapter|Thin wrapper around browser APIs.|Use `browser-file-io` to read `File` text/ArrayBuffer.|
|Storage adapter|Controlled persistence boundary.|IndexedDB saved-query import, CQ graph persistence.|
|DOM adapter|Rendering or event collection boundary.|File input handlers, table export button handlers.|
|Vendor adapter|Stable wrapper around third-party library APIs.|PapaParse, SheetJS.|
|Node adapter|Optional server-side processing boundary.|Future filesystem/stream adapters.|

## Boundary Table

|ID|Function|Current category|Target category|Side effects|Reads from|Writes to|Adapter needed?|Worker-safe?|Node-safe?|Notes|
|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
|BOUND-001|CSV cell escaping helpers|Pure core|Pure core|None|Explicit value|Return string|No|Yes|Yes|Unify as `escapeDelimitedCell`.|
|BOUND-002|Generic row CSV serializers|Pure core|Pure core|None|Explicit row arrays/records|Return string|No|Yes|Yes|Expose delimiter, newline, quote policy, trailing newline.|
|BOUND-003|Domain report/table CSV builders|Mixed pure/domain|App adapter over pure core|None in serializer|Report/table models|Return string|Yes|Yes|Yes|Keep domain row projection local.|
|BOUND-004|CQ Ferret CSV upload handler|DOM/storage workflow|DOM adapter plus parser package|Confirm dialog, file read, graph mutation, IndexedDB write|File input and app state|App graph/storage|Yes|No|No|Do not promote wholesale.|
|BOUND-005|TOM `parseSpreadsheetData`|Browser/vendor adapter|Browser read adapter plus vendor parser adapter|File read, console logging|Browser File|Return rows/header|Yes|No|No|Split into `readFileAsText`/`readFileAsArrayBuffer` and `parseWorkbookArrayBuffer`/`parseDelimitedText`.|
|BOUND-006|Table Nova text parsing helpers|Pure core|Pure core or vendor adapter|None|Text string|Tabular dataset|Maybe|Yes|Yes|If PapaParse is adopted, this may become an adapter wrapper or fallback parser.|
|BOUND-007|Table Nova `parseXlsxArrayBuffer`|Vendor adapter|Vendor adapter|Uses global SheetJS parser|ArrayBuffer|Tabular dataset|Yes|Likely|Maybe|Inject SheetJS dependency for testability and worker/Node compatibility.|
|BOUND-008|IRI Swapper mapping ingest branches|DOM/browser/vendor workflow|App adapter over browser-file-io, tabular parser, mapping parser|File read, session/UI mutation|Browser File, DOM state|Session/UI|Yes|No|No|Fix during parser cycles with `readFileAsText`/`readFileAsArrayBuffer`.|
|BOUND-009|IRI Swapper `rowsToMapping`|Pure domain core|IRI mapping parser core|None|Parsed row records|Map and metadata|No|Yes|Yes|Belongs in adjacent domain package.|
|BOUND-010|Axiolotl saved-query CSV import/export|Storage workflow plus pure parser|App adapter over pure parser/serializer|IndexedDB writes and browser event dispatch for import|CSV text, IndexedDB|Saved query store|Yes|Core yes|Core yes|Strict schema parser remains app-specific.|
|BOUND-011|Ontology Tabulator `tableModelToCsv`|UI helper with pure serializer|Pure serializer plus DOM download adapter|Download wrapper outside serializer|Table model rows|CSV text/download|Yes|Serializer yes|Serializer yes|Headers need escaping in canonical serializer.|

## Side-Effect Rules

- `tabular-io` core must not read browser `File` objects directly. Use `browser-file-io` first and pass text or ArrayBuffer into parser functions.
- `tabular-io` core must not trigger downloads. Use `browser-file-io` after serialization.
- `tabular-io` core must not update IndexedDB, app sessions, graph caches, or DOM views.
- PapaParse and SheetJS should be wrapped as vendor adapters with explicit dependency injection or provenance notes.
- IRI mapping, CQ graph reconstruction, saved-query import, ontology/table modeling, and report row projection are app/domain adapters over generic tabular parsing/serialization.

## Refactor Plan

|Refactor ID|Problem|Target boundary|Affected functions|Required tests|Migration notes|
|:---|:---|:---|:---|:---|:---|
|REF-001|CSV escaping duplicated across apps.|Pure core.|TAB-001, TAB-005, TAB-009, TAB-012, TAB-018.|Cells with comma, quote, CRLF, LF, tab, nullish, formula-like strings if needed.|Default to quote only when needed; document quote-all option.|
|REF-002|Delimited row serialization duplicated and mixed with row projection.|Pure core plus app adapters.|TAB-002, TAB-004, TAB-005, TAB-010, TAB-011, TAB-012, TAB-018.|Row arrays, records with headers, empty rows, trailing newline, CRLF/LF, TSV escaping.|Domain functions should build rows first, then call generic serializer.|
|REF-003|CSV/TSV parsing quality differs and CQ Ferret uses fragile regex splitting.|Vendor adapter plus pure normalization.|TAB-003, TAB-007, TAB-017.|simple, quoted commas, escaped quotes, embedded newlines, BOM, CRLF, blank rows, malformed row.|Likely adopt PapaParse for text parsing or fixture-match an equivalent implementation.|
|REF-004|Workbook parsing repeats SheetJS calls and output normalization.|Vendor adapter.|TAB-006, TAB-013, TAB-015, TAB-017.|XLSX first sheet, empty workbook, blank cells, numeric/date cells as strings, sheet selection.|Keep file reading outside workbook parser.|
|REF-005|IRI mapping parsing is duplicated but domain-specific.|IRI mapping parser package.|TAB-007, TAB-014, TAB-016.|Header aliases, missing headers, empty old/new, duplicate old, conflicting old, angle bracket trimming.|Decide first-vs-last duplicate policy explicitly.|
|REF-006|IRI Swapper file read cleanup is blocked until parser cycle.|App adapter.|TAB-013, TAB-015.|Smoke tests or manual fixtures for RDF and SPARQL mapping upload.|Replace direct `file.text()`/`file.arrayBuffer()` with `browser-file-io` reads while adopting parsers.|

## Notes

- The clean package boundary is: browser file read -> tabular parse -> domain row interpretation -> domain model mutation.
- The clean export boundary is: domain rows -> tabular serialize -> browser download.
- Vendor code should not be edited during this capability cycle unless explicitly approved.
