# Promoted Function Proposal: Browser File I/O

## Deep Comparison Summary

The candidate functions separate into three reusable capabilities and one
non-promotable group:

1. File-to-text reads.
2. File-to-ArrayBuffer reads.
3. Browser downloads.
4. Mixed app workflows that combine file reading with parsing, storage, UI, or serialization.

The reusable functions should be small and composable rather than a single
large "handle file" abstraction. A single Frankenstein function would obscure
the boundary between browser APIs and app/domain logic.

## Naming Comparison

|Capability|Observed names|Decision|
|:---|:---|:---|
|Read file as text|`readFileAsText`, inline `file.text()`, inline FileReader callbacks|Accept `readFileAsText`. It is already action-oriented and widely used.|
|Read file as binary|`readFileAsArrayBuffer`, inline `file.arrayBuffer()`|Accept `readFileAsArrayBuffer`. It mirrors the platform output range.|
|Download text|`downloadTextFile`, `downloadText`, `downloadContent`, `downloadCsv`|Accept `downloadTextFile(fileName, text, options)`. Keep format-specific names as local adapters only.|
|Download Blob|Inline Blob/object URL snippets|Introduce `downloadBlob(fileName, blob, options)`. This prevents text helpers from absorbing binary concerns.|
|Create accept string|`getAcceptExtensions`|Prefer `createAcceptAttribute` because the output is an HTML attribute string.|

## Input Domain and Output Range

|Function|Domain|Range|Notes|
|:---|:---|:---|:---|
|`readFileAsText`|Browser File/Blob-like object|`Promise<string>`|No parsing and no app state mutation.|
|`readFileAsArrayBuffer`|Browser File/Blob-like object|`Promise<ArrayBuffer>`|Useful for XLSX, DOCX, Zip, and future binary exports.|
|`createTextBlob`|Any text-like value plus MIME options|`Blob`|Stringifies `null`/`undefined` to empty string for app compatibility.|
|`downloadBlob`|Filename and Blob|Download descriptor|Owns object URL and anchor lifecycle.|
|`downloadTextFile`|Filename, text, MIME/download options|Download descriptor|Composition only; no format registry globals.|
|`createAcceptAttribute`|Extensions/MIME strings/descriptors|String|Pure helper; no DOM dependency.|

## Error Handling and Logging

Canonical functions do not log. Apps own user-facing toasts, console messages,
and recovery flows.

Error model:

- Invalid file-like inputs throw `TypeError`.
- Missing browser primitives reject or throw clear `Error` messages.
- FileReader errors preserve `reader.error` when possible.
- Abort signals reject with `AbortError`.
- Download helpers throw if `document` or object URL APIs are missing.

## Side Effects

|Function|Side effects|
|:---|:---|
|`readFileAsText`|Reads user-selected file only.|
|`readFileAsArrayBuffer`|Reads user-selected file only.|
|`createTextBlob`|Creates Blob only; no DOM/object URL.|
|`downloadBlob`|Creates object URL, creates/clicks/removes anchor, revokes URL.|
|`downloadTextFile`|Creates Blob and delegates all download side effects to `downloadBlob`.|
|`createAcceptAttribute`|None.|

## Proposed Canonical JS

The proposed implementation is in `src/`:

- `read-file-as-text.js`
- `read-file-as-array-buffer.js`
- `create-text-blob.js`
- `download-blob.js`
- `download-text-file.js`
- `create-accept-attribute.js`
- `index.js`

## App Adoption Impact

|App|Change if adopted|
|:---|:---|
|OntoEagle|Replace `rdf_io.readFileAsText` and inline FileReader/Blob snippets with package calls; keep RDF/CQ parsing local.|
|tabular-ontology-maker|Split FileReader portions out of spreadsheet/ontology import functions; keep SheetJS/RDF parsing local.|
|axiolotl|Use package for `semantic-core` file read/download adapters; keep classic-script bridge local until module conversion.|
|visual-lynx|Replace `linked-data-transformer-browser.js` implementation and remove duplicate legacy copies.|
|ontology-curation-manager|Migrate old-order report download adapter or keep a thin compatibility wrapper; use package reader for upload flows.|
|ontology-tabulator|Use package read/download helpers; keep CSV serialization and print window local.|
|iri-swapper|Use package reads for ontology/query/mapping files and package download for final exported text.|
|table-nova|Replace `io/fileReaders.js` and `io/download.js` with package exports or thin adapters; keep JSZip/XLSX parsing local.|

## Test Coverage Added

`__tests__/browser-file-io.test.js` covers:

- native `Blob.text()` path;
- FileReader text fallback and native error preservation;
- empty result normalization;
- native `Blob.arrayBuffer()` path;
- ArrayBuffer type validation;
- missing browser primitive errors;
- MIME and charset normalization;
- text Blob construction;
- anchor click/object URL lifecycle;
- text download composition;
- accept attribute normalization and category filtering.

## Maturity Rating After This Proposal

The new package candidate is rated `4 - Package ready` once tests pass because:

- functions are named by action;
- inputs and outputs are explicit;
- side effects are isolated;
- errors are predictable;
- tests cover core behavior;
- browser assumptions are documented.

It is not `5 - Canonical` until all intended consumers adopt it and local
duplicates are deleted.

