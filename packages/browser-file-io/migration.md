# Browser File I/O Migration Notes

This document describes conditional app changes if the proposed
`@ontoeagle/browser-file-io` package is adopted. It is a plan, not an app-code
change.

## OntoEagle

Current candidates:

- `docs/app/rdf_io.js::readFileAsText`
- downloads in `bundler-ui.js`, `catalog-data-manager.js`, `ferret.js`
- inline FileReader import in `ferret.js`
- inline Blob export in `extracted-vocabulary-page.js`

Conditional changes:

- Import `readFileAsText` from the package in `rdf_io.js` or replace the local function.
- Keep RDF parsing in `rdf_io.js`.
- Replace inline `FileReader` import in `ferret.js` with `readFileAsText(file)`.
- Replace inline vocabulary CSV Blob export with `downloadTextFile(filename, csv, { mimeType: 'text/csv' })`.
- Continue passing MIME strings from `format-registry` or app serializers.

## tabular-ontology-maker

Current candidates:

- `tom-core.js::parseSpreadsheetData`
- `tom-core.js::parseOntologyData`
- `tom-core.js::processOntologyImportFile`
- export calls to `downloadTextFile`

Conditional changes:

- Split `parseSpreadsheetData` so file reading uses `readFileAsArrayBuffer` or `readFileAsText`, while SheetJS parsing remains in tabular capability code.
- Replace `parseOntologyData` FileReader setup with `readFileAsText`.
- Leave ontology import target derivation and cache writes app-local.
- Normalize export calls to `downloadTextFile(fileName, text, { mimeType })`.

## axiolotl

Current candidates:

- `semantic-core.js::readFileAsText`
- `semantic-core.js::downloadText`
- `graph-analytics.html::parseFileToQuads`
- `playbook-builder-main.js` inline JSON Blob export

Conditional changes:

- Replace `semantic-core.js::readFileAsText` with package import where module conversion is possible.
- For classic-script surfaces, create a local adapter that imports the package once rather than dynamically per call.
- Replace inline JSON Blob export with `downloadTextFile(filename, JSON.stringify(value, null, 2), { mimeType: 'application/json' })`.
- Keep inference, query, parser, and storage behavior app-local.

## visual-lynx

Current candidates:

- `linked-data-transformer-browser.js::readFileAsText`
- `linked-data-transformer-browser.js::downloadContent`
- duplicate local functions in `linked-data-transformer-functions.js`

Conditional changes:

- Replace `readFileAsText` implementation with package import.
- Replace `downloadContent` with either direct `downloadTextFile(filename, content, { mimeType })` or a thin object-parameter adapter.
- Delete duplicate legacy definitions after callers move to the browser module.

## ontology-curation-manager

Current candidates:

- `report-export.js::downloadTextFile(text, fileName, mimeType)`
- multiple `file.text()` upload reads in `main.js`, `measures-main.js`, `report-model.js`

Conditional changes:

- Either migrate callers to `downloadTextFile(fileName, text, { mimeType })` or rename the old-order adapter to make it explicit.
- Use `readFileAsText(file)` for upload reads if standardized error behavior is desired.
- Leave report serializers and ontology parsers in their own modules.

## ontology-tabulator

Current candidates:

- `main.js` uses `file.text()`
- `ui-helpers.js::downloadCsv`

Conditional changes:

- Use `readFileAsText(file)` for ontology load flow.
- Replace `downloadCsv` body with direct package `downloadTextFile`.
- Keep CSV serialization and print-window behavior outside this package.

## iri-swapper

Current candidates:

- RDF and SPARQL pages use `file.text()`.
- `downloadRun` and `downloadRunAsRq` call browser download helper after storage/serialization.

Conditional changes:

- Use `readFileAsText(file)` for ontology, query, and mapping file reads.
- Keep `downloadRun` and `downloadRunAsRq` as app adapters, but make final call `downloadTextFile(fileName, text, { mimeType })`.
- Keep content-type-to-extension logic in format-registry or app adapter.

## table-nova

Current candidates:

- `docs/app/io/fileReaders.js::readFileAsText`
- `docs/app/io/fileReaders.js::readFileAsArrayBuffer`
- `docs/app/io/download.js::downloadTextFile`
- DocxHund `readFileAsArrayBuffer` and `downloadText`

Conditional changes:

- Replace `io/fileReaders.js` with package exports.
- Replace `io/download.js` wrapper with package export or thin compatibility adapter.
- Convert DocxHund `readFileAsArrayBuffer` to package import.
- Keep JSZip DOCX parsing and tabular parsing outside this package.

