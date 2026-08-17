# Browser File I/O Decision Log

## 2026-07-26: Keep Browser File I/O Separate From MIME Registry

Decision: Browser file/download utilities receive their own package workspace.

Rationale: MIME registry and namespace registry are foundational but distinct.
The previous global/browser helper blurred registry behavior with browser
download side effects. This package keeps side effects explicit while accepting
MIME strings from callers or from `format-registry`.

## 2026-07-26: Filename-First Download Signature

Decision: canonical download text signature is:

```js
downloadTextFile(fileName, text, options = {})
```

Rationale: The function's browser-visible action is downloading a named file.
This order matches Table Nova and the promoted helper, and avoids OCM's local
`(text, fileName, mimeType)` divergence.

## 2026-07-26: Preserve Native FileReader Errors

Decision: canonical readers reject native `reader.error` when available.

Rationale: OntoEagle and Visual Lynx used a generic error message. Table Nova's
implementation keeps the native error and provides a stable fallback. That is
more useful for debugging without making caller behavior unpredictable.

## 2026-07-26: Split `downloadBlob` From `downloadTextFile`

Decision: expose both `downloadBlob` and `downloadTextFile`.

Rationale: Current apps mostly download text, but the portfolio already has
XLSX, DOCX, Zip, and project data workflows. `downloadBlob` prevents text-only
helpers from becoming a catch-all.

## 2026-07-26: Do Not Promote Mixed File+Parser Workflows

Decision: functions such as TOM `parseSpreadsheetData`, IRI Swapper
`downloadRun`, and OCM upload handlers remain app/domain adapters.

Rationale: They combine browser file reads with parsing, storage, UI state, or
serialization. The browser-file package should stop at text, bytes, Blob, and
download boundaries.

