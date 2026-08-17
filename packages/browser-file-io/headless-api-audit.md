# Browser File/Download Utilities Headless API Audit

Date: 2026-08-15

## Scope

This package owns browser file read and browser download adapter behavior.

It deliberately does not own parsing, serialization, MIME registry decisions, RDF/tabular conversion, IndexedDB persistence, File System Access folder sync, ZIP construction, or UI status rendering.

## Headless Boundary Finding

This capability family is not fully headless in the same sense as `normalization-utils`, `format-registry`, or `namespace-registry`.

The correct architecture is:

- pure helper functions remain callable under Node/Jest without DOM;
- browser adapter functions keep browser-only side effects isolated and injectable;
- headless domain packages produce file-like artifacts;
- this package turns those artifacts into browser reads or browser downloads.

The package should not pretend that `FileReader`, `Blob`, `URL.createObjectURL`, anchor-click downloads, or File System Access permissions are headless APIs. They are browser adapter boundaries.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### Pure or Mostly Pure Helpers

- `createAcceptAttribute(entries, options)`
- `normalizeFileExtension(extension)`
- `stripFileExtension(fileName)`
- `createSafeFilenameBase(value, options)`
- `isBlobLike(value)`
- `normalizeTextMimeType(mimeType, charset)`
- `normalizeDownloadFileName(fileName)`

These helpers are deterministic and side-effect free except for ordinary string/object inspection.

### Browser Adapter Functions

- `readFileAsText(file, options)`
- `readFileAsArrayBuffer(file, options)`
- `createTextBlob(text, options)`
- `downloadBlob(fileName, blob, options)`
- `downloadTextFile(fileName, text, options)`

These functions depend on browser file/download primitives, but they expose injectable seams so Jest can validate behavior without a real browser UI.

## Input Contracts

- File readers accept browser `File`/`Blob`-like values.
- Text reads can use native `Blob.text()` or `FileReader` with optional encoding and abort behavior.
- ArrayBuffer reads can use native `Blob.arrayBuffer()` or `FileReader`.
- Download functions accept caller-produced content and filenames; they do not serialize RDF, CSV, JSON, YAML, HTML, ZIP, or app records.
- Accept-attribute construction accepts raw extensions, MIME strings, or registry-like descriptors supplied by `format-registry`.

## Output Contracts

- Read functions return `Promise<string>` or `Promise<ArrayBuffer>`.
- Blob creation returns a `Blob`.
- Download functions return a small descriptor:

```js
{
  fileName,
  objectUrl,
  revokeDelayMs
}
```

The descriptor is for tests, diagnostics, and logging. The actual download remains a browser side effect.

## Error Model

- Invalid file-like inputs throw `TypeError` before browser APIs are touched.
- Missing browser primitives reject or throw with stable messages.
- FileReader read errors preserve the native `reader.error` when available.
- Abort behavior rejects with an `AbortError`.
- Serialization/parser errors are out of scope and must be raised by the calling capability package before browser download begins.

## Adapter Rule

Headless packages should produce artifacts like:

```js
{
  data,
  mediaType,
  format,
  encoding,
  suggestedFilename,
  metadata,
  warnings
}
```

Browser UI code may then adapt that artifact:

1. Create a `Blob` for text/binary output.
2. Call `downloadBlob` or `downloadTextFile`.
3. Render warnings/status through `ui-feedback`.

The browser adapter must not re-detect formats, re-serialize data, mutate IndexedDB, or rewrite domain records.

## Relationship To File System Access

File System Access folder handles, permission lifecycle, folder scans, and write-back sync belong to the IndexedDB/project data-management capability family, not this browser download package.

This package may be reused by FSA adapters for filename utilities, but it should not own durable project-folder synchronization.

## Relationship To ZIP Export

ZIP export should be modeled as a headless artifact-building capability that returns bytes plus media type `application/zip`.

This package should only download the resulting `Blob` or bytes in the browser.

## Headless Coverage

Current Jest coverage exercises:

- native and FileReader text reads;
- native and FileReader ArrayBuffer reads;
- FileReader errors and setup failures;
- abort behavior;
- safe filename helpers;
- Blob-like detection;
- text MIME charset normalization;
- text Blob creation;
- browser download anchor lifecycle with mocked DOM/URL;
- delayed URL revocation;
- accept-attribute construction from descriptor inputs.

## Maturity Assessment

Current maturity: Level 5 for browser adapter reuse, with explicit qualification.

Qualification:

- The capability is canonical for browser file reads and browser downloads.
- It is not a standalone headless transformation package.
- Its headless responsibility is to keep pure helpers and adapter seams testable while domain packages remain responsible for producing canonical artifacts.
