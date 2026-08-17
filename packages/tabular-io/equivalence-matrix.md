# Tabular Parsing and Serialization Equivalence Matrix

## Capability Family

- **Capability family:** Tabular parsing and serialization
- **Candidate groups:** GRP-001 through GRP-005 from `inventory.md`
- **Related inventory IDs:** TAB-001 through TAB-018
- **Comparison date:** 2026-07-27

## Behavior Matrix

|Candidate ID|App|Function|Core behavior|Input shape|Output shape|Formats|Options|Error model|Warning model|Side effects|Dependencies|Worker-safe|Node-safe|Browser-only assumptions|Known bugs|Legitimate variations|Test fixtures|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---|:---|:---|:---|
|TAB-001|OntoEagle CQ Ferret|`escapeCSV`|Escapes one CSV field and quotes all values.|Scalar.|CSV cell string.|CSV.|None.|No throws.|None.|None.|None.|Yes|Yes|None.|Always quoting is verbose but valid.|Always quote can be an option.|None.|
|TAB-003|OntoEagle CQ Ferret|inline parser|Splits CSV text into object rows by header.|String text.|Array of records.|CSV.|None.|Parser itself has no malformed error handling.|None.|File read and app mutation in parent.|None.|No|No|Browser/app globals.|Quoted newlines and escaped quote edge cases likely fail.|App-specific CQ graph reconstruction.|None.|
|TAB-005|TOM|`generateCsvString`|Builds CSV rows with optional cell resolver and escapes cells.|Headers, 2D rows, resolver.|CSV string.|CSV.|Resolver callback; CRLF fixed.|No throws for ordinary input.|None.|None.|None.|Yes|Yes|None.|No delimiter option.|CRLF output is legitimate export choice.|Focused Jest.|
|TAB-006|TOM|`parseSpreadsheetData`|Reads browser File and parses text/workbook through SheetJS.|File, extension, header flag.|`{ rows, header }`.|CSV, TSV, XLS, XLSX.|Header flag.|Logs and rethrows errors.|None.|File read and console logging.|SheetJS, browser-file-io.|No|No|Browser File API.|Uses SheetJS for delimited text; no shared diagnostics.|Async browser adapter is legitimate.|Tutorial files, no focused parser tests.|
|TAB-007|Axiolotl|`parseIriMappingCsv`|Parses mapping CSV/TSV into Map with warnings.|Text, optional delimiter/normalizer.|`{ map, warnings }`.|CSV, TSV.|Delimiter, normalizer.|Returns warnings instead of throwing for empty/missing header.|String warnings.|Optional global normalizer read.|None.|Mostly|Mostly|Global optional fallback.|Simple split does not handle quoted delimiters.|Warning model and first-conflict-wins policy are useful options.|Focused Jest.|
|TAB-008|Axiolotl|`parseSavedQueriesCsv` / `savedQueriesToCsv`|Round-trips strict saved-query CSV schema.|CSV text or saved query rows.|Records or CSV text.|CSV.|Fixed schema.|Throws header mismatch.|None.|Import wrapper writes IndexedDB and dispatches event.|idb for import wrapper.|Core yes|Core yes|Storage wrapper browser-only.|Parser is schema-specific.|Strict header validation is valid for app-owned CSV.|No focused CSV tests found.|
|TAB-009|OCM|`rowsToCsv`|Serializes 2D rows to CSV.|Array of row arrays.|CSV text.|CSV.|None.|No throws for ordinary input.|None.|None.|None.|Yes|Yes|None.|No delimiter/newline options.|Trailing newline is legitimate option.|Focused Jest.|
|TAB-010|OCM|report CSV builders|Build fixed report CSV documents.|Domain arrays/objects.|CSV text.|CSV.|Fixed schemas.|Throws for missing selected standard or empty batch.|None.|None.|None.|Yes|Yes|None.|Not generic by design.|Domain row builders should remain adapters.|Focused Jest.|
|TAB-011|OCM|measure CSV/TSV builders|Serializes metrics to CSV/TSV.|Metric arrays / analysis arrays.|Delimited text.|CSV, TSV.|Delimiter wrapper.|No throws for nullish arrays.|None.|None.|None.|Yes|Yes|None.|Needs deeper delimiter fixture coverage.|Delimiter option required in canonical serializer.|Focused Jest assertions.|
|TAB-012|Ontology Tabulator|`tableModelToCsv`|Serializes filtered/sorted table rows.|Table model and rows.|CSV text.|CSV.|None.|No throws observed.|None.|None in serializer; download wrapper separate.|None.|Yes|Yes|None.|Headers are not escaped.|Always quote values is legitimate.|No focused fixtures.|
|TAB-013/TAB-015|IRI Swapper|mapping ingest branches|Parse mapping file through PapaParse or SheetJS.|Browser File.|Rows then app session map.|CSV, TSV, XLS, XLSX.|Header true, skip empty lines, delimiter for TSV.|PapaParse first error throws; unsupported extension throws.|PapaParse warnings not retained.|File read, UI/session mutation.|PapaParse, SheetJS.|No|No|Browser File API, DOM/UI state.|Duplicated RDF/SPARQL code.|Vendor parser adapter is legitimate.|Example CSV only.|
|TAB-014/TAB-016|IRI Swapper|`rowsToMapping`|Find old/new IRI columns and create mapping metadata.|Array of row records.|`{ mapping, meta }`.|Parsed rows from CSV/TSV/XLS/XLSX.|Fuzzy header fallback.|Throws if headers absent.|Duplicate count only.|None.|None.|Yes|Yes|None.|No IRI validation; duplicate policy implicit.|Last duplicate wins may match spreadsheet expectation.|No focused fixtures.|
|TAB-017|Table Nova|`parseTabular.js` functions|Detects tabular kind, parses CSV/TSV lines/text, applies header row, parses XLSX.|Filename, text, delimiter hint, ArrayBuffer.|`{ header, rows }`.|CSV, TSV, XLS, XLSX.|Delimiter hint, header row number.|No structured errors; malformed quotes tolerated.|None.|None except SheetJS adapter.|SheetJS, format-registry.|Text core yes|Text core yes|XLSX global browser assumption.|No quoted multiline support.|Header row selection and string trimming are useful options.|Focused Jest.|
|TAB-018|Table Nova|`serializeDataDictionaryCsv`|Serializes fixed data dictionary rows.|Array of records.|CSV text.|CSV.|Fixed headers.|No throws.|None.|None.|None.|Yes|Yes|None.|No tests found.|Fixed schema belongs in app adapter.|No focused fixtures.|

## Difference Classification

|Difference ID|Candidates affected|Description|Classification|Decision|Rationale|
|:---|:---|:---|:---|:---|:---|
|DIFF-001|TAB-001, TAB-005, TAB-009, TAB-012|Some serializers quote every data cell, some quote only when needed.|Legitimate option|Canonical should default to quote only when required and allow `quoteAll`.|Both outputs are valid CSV; compact output is easier to inspect.|
|DIFF-002|TAB-005, TAB-009, TAB-010, TAB-011, TAB-017|Newline handling differs: LF, CRLF, and trailing newline choices.|Legitimate option|Canonical should expose `newline` and `trailingNewline` options.|Existing exports may rely on stable snapshots.|
|DIFF-003|TAB-003, TAB-007, TAB-017|Custom CSV parsers vary in support for quoted commas, escaped quotes, and multiline fields.|Bug / improvement|Canonical parser should use PapaParse or equivalent for CSV/TSV text and fixture hard cases.|Regex or line-by-line split is not enough for CSV correctness.|
|DIFF-004|TAB-006, TAB-013, TAB-015, TAB-017|Workbook parsing is handled through SheetJS but output shapes differ.|Accidental divergence|Canonical workbook adapter should normalize to one `TabularDataset` shape.|The app-level consumers all want rows/headers with empty cells preserved.|
|DIFF-005|TAB-007, TAB-014, TAB-016|IRI mapping duplicate policy differs: Axiolotl keeps first conflicting mapping with warning; IRI Swapper keeps last and counts duplicates.|Legitimate option|Mapping parser should make conflict policy explicit: `first`, `last`, or `error`.|Both behaviors can be valid depending on workflow.|
|DIFF-006|TAB-010, TAB-011, TAB-018|Domain row projection is often mixed with delimited serialization.|App-specific adapter|Keep row projection local; share only generic row/record serialization.|Avoids a large domain-aware serializer.|
|DIFF-007|TAB-006, TAB-013, TAB-015|File reading is mixed with tabular parsing.|Boundary issue|Use `browser-file-io` for reads and pass text/buffer into tabular parser functions.|Keeps parser package browser/worker/Node portable.|
|DIFF-008|TAB-013, TAB-015|IRI Swapper RDF and SPARQL pages duplicate mapping import code.|Duplicate|Consolidate through shared tabular parser plus `iri-mapping-parser` adapter.|This is a strong pilot target after parser contract definition.|

## Canonical Behavior Recommendation

- **Recommended canonical behavior:** Define a small `tabular-io` package with pure `parseDelimitedText`, `serializeDelimitedRows`, `serializeDelimitedRecords`, `normalizeTabularRows`, and vendor adapter `parseWorkbookArrayBuffer`.
- **Behavior to preserve as options:** delimiter, quote policy, newline, trailing newline, header row selection, blank row handling, trim behavior, duplicate header handling, workbook sheet selection.
- **Behavior to reject:** regex-only CSV parsing for uploaded app data; parser functions that mutate DOM/session/storage; generic parsers that guess RDF or IRI mapping semantics.
- **Behavior requiring migration notes:** CQ Ferret upload limitations, TOM CRLF export snapshots, OCM trailing newline, IRI Swapper duplicate mapping policy, Ontology Tabulator unescaped headers.
- **Open questions:** Should PapaParse be the canonical CSV adapter, or should the core include a small standards-aware parser? Should XLS and XLSX support live in `tabular-io` or a separate `workbook-io` adapter?
