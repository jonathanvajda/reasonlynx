# Format and MIME Registry Naming Decisions

## How to Fill This Out

Use this file before defining the canonical API. Record old names, proposed names, rejected names, and the reason for each choice. Names should describe the action and data boundary, not the source app.

This first pass proposes names only. Do not treat them as accepted until characterization tests and contract review are complete.

## Naming Principles

- Use MIME type when the function returns a MIME type.
- Use extension when the function returns a filename extension.
- Use descriptor when the function returns a structured object.
- Avoid vague names such as `detectFormat` when the result is specifically a MIME type, parser format, tabular kind, or app input kind.
- Keep content sniffing separate from filename extension lookup.

## Decision Table

|Decision ID|Old name(s)|Proposed canonical name|Accepted?|Reason|Rejected alternatives|Migration notes|
|:---|:---|:---|:---:|:---|:---|:---|
|NAME-001|`detectRdfFormat`, `detectRdfMimeByName`, `detectRdfFormatFromFilename`, `guessInputMimeFromFilename`, `detectOntologyFormat`|`getRdfMimeTypeForFilename(fileName)`|Proposed|The output is a MIME type, and the input is a filename. The name avoids vague `format` language.|`detectRdfFormat`, `guessRdfFormat`, `downloadRDFFormat`|Apps that need fallback behavior should wrap this with an adapter.|
|NAME-002|`normalizeMimeType`, `normalizeRdfFormat`|`normalizeRdfMimeType(input)`|Proposed for RDF-only core|The function normalizes shorthand tokens and MIME aliases into canonical RDF MIME strings.|`normalizeFormat`, `normalizeMimeType` for RDF-only use|If non-RDF output types are included, keep a separate `normalizeMimeType` generic helper.|
|NAME-003|`workspaceExportExtension`, `getDownloadExtension`|`getExtensionForMimeType(mimeType)`|Proposed|The function returns a download/file extension for a MIME type.|`getDownloadExtension`|App-specific export-kind maps should call this after resolving kind to MIME.|
|NAME-004|`detectFormatByExtension`|`getInputKindForExtension(extension)`|Proposed for adapter|The TOM function returns a broad kind, not a MIME type.|`detectFormatByExtension`|Keep this as app intake adapter unless canonical package supports broad categories.|
|NAME-005|`detectTabularType`|`getTabularFormatForFilename(filename)`|Proposed for tabular registry|The output is a tabular kind based on filename.|`detectTabularType`|Likely belongs to `tabular-formats.js`.|
|NAME-006|`guessMediaType`, `guessRdfMimeTypeFromText`|`detectRdfMimeTypeFromText(text)`|Yes|This is deterministic content sniffing, not parser validation. `detect` is the action and the return follows the registry descriptor-result shape.|`guessMediaType`, `guessRdfMimeTypeFromText`|Callers that need only the MIME string should read `result.value.mimeType` after checking `result.ok`.|
|NAME-007|`isN3ParserFormat`|`isN3SupportedRdfMimeType(mimeType)`|Proposed|Clarifies that the predicate is about MIME support for N3 parser/writer behavior.|`isN3ParserFormat`|May need separate parse/write support predicates.|
|NAME-008|`supportedConversions`, `getWorkspaceExportFormats`|`getSupportedOutputMimeTypes(inputMime, options)`|Proposed|Names behavior as output MIME selection, while options can carry app-specific scope.|`supportedConversions` alone|Visual output formats and graph-scope rules may require adapters.|

## Naming Review Questions

- Does the name say whether the output is a MIME type, extension, descriptor, or app kind?
- Does the name avoid pretending a parser adapter format is the same thing as a canonical MIME type?
- Does the name keep filename lookup separate from content sniffing?
- Does the name still make sense in OntoEagle, TOM, Axiolotl, Visual Lynx, OCM, Ontology Tabulator, IRI Swapper, and Table Nova?

## Notes

- Most existing functions use `format` to mean different things: MIME type, parser format, export kind, or input class. The canonical package should reserve `format` for structured format records or avoid it in function names.
- 2026-08-15: Browser download helpers were removed from the format-registry public API. Use `browser-file-io` for download and accept-attribute behavior.
