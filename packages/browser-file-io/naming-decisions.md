# Naming Decisions

## Capability Family

- **Capability family:** Browser File I/O and Downloads
- **Decision date:** 2026-07-26

## Naming Principles

- Name functions by action and data boundary.
- Avoid app-specific names.
- Avoid format-specific names when a MIME type or options object is enough.
- Avoid vague verbs such as `handle`, `process`, `manage`, or `do`.
- Keep browser-only behavior explicit.
- Keep MIME registry names out of browser file/download utilities except as imported dependencies.

## Decision Table

|Decision ID|Old name(s)|Proposed canonical name|Accepted?|Reason|Rejected alternatives|Migration notes|
|:---|:---|:---|:---:|:---|:---|:---|
|NAME-001|`readFileAsText` in OntoEagle, Axiolotl, Visual Lynx, Table Nova|`readFileAsText`|Yes|Already action-oriented, widely understood, and clear about input domain and output range|`loadFileText`, `readText`, `handleFile`|Normalize error behavior and optional encoding in contract.|
|NAME-002|`readFileAsArrayBuffer` in Table Nova and DocxHund|`readFileAsArrayBuffer`|Yes|Clear browser File input and ArrayBuffer output; mirrors native API language|`readBinaryFile`, `loadArrayBuffer`|Canonical can use native `file.arrayBuffer()` with FileReader fallback.|
|NAME-003|`downloadTextFile`, `downloadText`, `downloadContent`, `downloadCsv`|`downloadTextFile`|Yes|Action and range are clear; covers CSV, TTL, JSON-LD, SPARQL, reports through MIME options|`downloadContent`, `exportText`, `saveText`, `downloadRDF`|Migrate wrappers to filename-first canonical order.|
|NAME-004|manual Blob/object URL download snippets|`downloadBlob`|Yes|Names the browser side-effect boundary without implying text only|`triggerDownload`, `saveBlob`, `downloadFile`|Use under `downloadTextFile`; expose for Zip, XLSX, or other binary downloads.|
|NAME-005|implicit Blob construction inside download functions|`createTextBlob`|Yes|Pure-ish Blob construction is separate from anchor click side effect|`makeBlob`, `blobFromText`, `serializeToBlob`|Can be tested without DOM if `Blob` exists in test environment.|
|NAME-006|`getAcceptExtensions`|`createAcceptAttribute`|Yes|Better describes the output as an HTML input `accept` attribute, not just extensions. This browser-adjacent string belongs in browser-file-io, while descriptor facts remain in format-registry.|`getAcceptExtensions`, `buildAcceptExtensions`, `formatAccept`|Use with `listSupportedMimeDescriptors()` when category-based registry descriptors are needed.|
|NAME-007|OCM `downloadTextFile(text, fileName, mimeType)`|No new canonical; app adapter only|No|The function name is good but argument order conflicts with canonical shape|`downloadReportText`, `exportReportFile`|Either migrate callers or rename local adapter to make old order obvious.|
|NAME-008|IRI Swapper `downloadRun`, `downloadRunAsRq`|Keep app-local names|No|They include storage lookup, serialization, filename selection, and download; not browser utility functions|`downloadTextFile` for whole function|Use canonical helper only for final browser action.|
|NAME-009|TOM `parseSpreadsheetData`, `parseOntologyData`|No browser-file canonical name|No|They combine browser reads with SheetJS/RDF parsing|`readSpreadsheetFileAsRows`, `readOntologyFile`|Split later: browser read in this package, tabular/RDF parsing in later cycles.|
|NAME-010|Axiolotl `downloadText`|`downloadTextFile` for shared layer; app may keep `downloadText` adapter|Partial|The app name is concise but less explicit than canonical; current behavior is fire-and-forget|`downloadText`, `downloadRdfText`|If retained, document it as a classic-script adapter around canonical module.|

## Proposed Canonical API Names

```js
readFileAsText(file, options = {})
readFileAsArrayBuffer(file, options = {})
createTextBlob(text, options = {})
downloadBlob(fileName, blob, options = {})
downloadTextFile(fileName, text, options = {})
createAcceptAttribute(descriptorsOrExtensions, options = {})
```

## Notes

- `downloadTextFile` should remain format-neutral. The caller supplies `mimeType`, or a MIME registry helper may infer it before calling.
- `downloadBlob` is needed so future Zip, XLSX, and binary export utilities do not misuse a text-only helper.
- Avoid `BrowserFileIO` or app-branded names in exported functions; the package path already communicates browser scope.
