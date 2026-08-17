# YAML, HTML, and Print Export Headless API Audit

Date: 2026-08-15

## Scope

This package owns report-oriented YAML text emission, generic HTML report document serialization, text export descriptor construction, stable report-export errors, and the browser print-window adapter.

It does not own browser file downloads, IndexedDB persistence, File System Access sync, RDF/tabular parsing, ontology-specific report projection, UI toast/status rendering, or PDF generation.

## Headless Boundary Finding

YAML, HTML, and export descriptor creation are headless.

Print is not fully headless. The correct boundary is:

- `appendPrintScript(html, options)` is string transformation and can be tested headlessly.
- `openPrintableHtmlDocument(html, options)` is a browser adapter. It owns `window.open`, document writing, focus, and popup-blocker errors.

The package should not treat browser printing as a core headless capability. Headless callers can generate printable HTML, but actual print execution belongs to browser automation or a renderer adapter.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### Errors

- `ReportExportError`
- `createReportValidationError(message, details)`

### YAML

- `serializeReportValueToYaml(value, options)`

This is a deterministic report-oriented YAML emitter for ordinary JavaScript values. It is not a general YAML parser, YAML schema engine, or arbitrary YAML round-trip validator.

### HTML

- `escapeHtmlText(value)`
- `serializeReportTableToHtml(table)`
- `serializeReportSectionToHtml(section, depth)`
- `serializeReportDocumentToHtml(report, options)`

### Export Descriptor

- `createReportTextExportDescriptor(options)`

This composes with `format-registry`, `browser-file-io`, and `normalization-utils` to produce a text export descriptor. It does not download the file.

### Print Adapter

- `appendPrintScript(html, options)`
- `openPrintableHtmlDocument(html, options)`

## Input Contracts

- YAML serialization accepts ordinary JavaScript primitives, arrays, plain objects, and nullish values.
- YAML object keys are preserved. The serializer does not invent semantic data-property names.
- HTML serialization accepts generic report descriptors containing title, paragraphs, metadata pairs, tables, and nested sections.
- Export descriptors accept serialized text plus explicit format, MIME, extension, basename, timestamp, and UTC options.
- Print opening accepts HTML text plus a browser `window`-like object.

## Output Contracts

- YAML serialization returns YAML text.
- HTML serialization returns HTML fragment or complete document text.
- Export descriptor creation returns:

```js
{
  text,
  fileName,
  mimeType,
  extension
}
```

- `appendPrintScript` returns HTML text.
- `openPrintableHtmlDocument` returns the opened print window.

No function creates `Blob`, triggers downloads, writes storage, or mutates app state.

## YAML Subset Policy

The current YAML contract is a conservative emitter subset:

- strings are JSON-quoted;
- numbers, booleans, and null use YAML scalar forms;
- arrays use block list syntax;
- plain objects use block mapping syntax;
- empty arrays emit `[]`;
- empty objects emit `{}`;
- unsafe keys such as full IRIs and CURIEs are JSON-quoted;
- optional trailing newline is controlled by `trailingNewline`.

This is sufficient for report export inspection and machine-readable handoff where consumers accept standard YAML scalar/list/map syntax.

The package does not currently guarantee round-trip identity through an arbitrary YAML parser. If future consumers require strict schema validation or comments/anchors/custom tags, add a runtime-injected YAML adapter rather than expanding this hand emitter into a full YAML implementation.

## HTML Safety Policy

Report content is HTML-escaped through `escapeHtmlText`.

Custom CSS passed to `serializeReportDocumentToHtml` is intentionally inserted as CSS, not escaped as text. Callers should only pass trusted stylesheet text. The package does not sanitize arbitrary untrusted CSS.

## Error Model

- Missing HTML report title throws `ReportExportError` with validation code.
- Missing export text throws `ReportExportError` with validation code.
- Blank printable HTML throws `ReportExportError` with validation code.
- Missing browser `window.open` throws `ReportExportError` with `PRINT_WINDOW_UNAVAILABLE`.
- Blocked print windows throw `ReportExportError` with `PRINT_WINDOW_BLOCKED`.

Expected app adapters should convert these errors into UI status, CLI diagnostics, CI failures, or agent/tool results.

## Adapter Rule

Browser adapters may:

- call report projection functions in app code to build report descriptors;
- call this package to serialize YAML/HTML;
- call `createReportTextExportDescriptor`;
- download descriptors through `browser-file-io`;
- print HTML through `openPrintableHtmlDocument`;
- render status through `ui-feedback`.

Browser adapters must not:

- duplicate HTML escaping;
- build generic report tables by string concatenation;
- hard-code YAML/HTML MIME and extension decisions already covered by the descriptor plus `format-registry`;
- mix report serialization with DOM mutation, storage writes, or file downloads inside reusable core functions.

## Headless Coverage

Jest coverage exercises:

- nested YAML report emission;
- YAML scalar quoting;
- YAML full-IRI and CURIE key quoting;
- empty arrays/objects and optional trailing newline;
- complete escaped HTML report documents;
- independent HTML table fragments;
- missing title validation;
- YAML/HTML export descriptors with MIME/extension/timestamp behavior;
- print script insertion;
- browser print-window adapter behavior through a mocked window;
- blocked popup and blank HTML errors;
- HTML text escaping.

## Maturity Assessment

Current maturity: Level 5 for report-oriented YAML/HTML export descriptors and print adapter reuse, with explicit qualifications.

Rationale:

- YAML/HTML/descriptor functions are headless and deterministic for supplied inputs;
- print-window behavior is isolated as a browser adapter with injectable window;
- active print/download duplication reviewed in this cycle was rewired to shared functions;
- output MIME and extension decisions reuse `format-registry`;
- file download behavior remains in `browser-file-io`;
- app-specific report projection remains local, as intended.
