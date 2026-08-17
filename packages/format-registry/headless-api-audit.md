# Format Registry Headless API Audit

Date: 2026-08-15

Milestone: 18.2 MIME type/format/extension registry headless API audit and contract stabilization.

## Contract Decision

`format-registry` is the canonical headless source for supported MIME descriptors, filename extension lookup, MIME normalization, category lookup, preferred extension lookup, and RDF parser-adapter metadata.

It must not export browser download helpers, DOM/file-input helpers, storage helpers, parser execution, logging, or UI status behavior.

## Public API

The stable public JavaScript API is exported from `src/index.js`.

| Function or export | Contract | Side effects | Failure model |
| --- | --- | ---: | --- |
| `SUPPORTED_MIME_DESCRIPTORS` | Frozen descriptor map keyed by stable format id. | None | Not applicable. |
| `listSupportedMimeDescriptors(options)` | Return all descriptors, or descriptors filtered by `category`. | None | Empty array for unmatched category. |
| `getFilenameExtension(fileName)` | Return lowercase final extension without dot. | None | Empty string when absent. |
| `getSupportedMimeTypeForFilename(fileName)` | Return descriptor result from filename extension. | None | `{ ok:false, error:'unknown filetype' }`. |
| `getOutputMimeTypeForExtension(extension)` | Return descriptor result from extension. | None | `{ ok:false, error:'unknown filetype' }`. |
| `normalizeSupportedMimeType(input)` | Normalize MIME type, descriptor id, or alias to descriptor result. | None | `{ ok:false, error:'unknown filetype' }`. |
| `getPreferredExtensionForMimeType(mimeType)` | Return preferred extension for a supported MIME type or alias. | None | `{ ok:false, error:'unknown filetype' }`. |
| `getInputKindForExtension(extension)` | Return broad import category used by browser intake adapters. | None | `'unsupported'`. |
| `getMimeTypeForFormatKey(formatKey)` | Alias-oriented descriptor lookup for app export keys. | None | `{ ok:false, error:'unknown filetype' }`. |
| `createFormatMimeTypeMap(formatKeys)` | Build app export-key to MIME map from registry descriptors. | None | Unknown keys omitted. |
| `createFormatExtensionMap(formatKeys)` | Build app export-key to preferred extension map. | None | Unknown keys omitted. |
| `getMermaidOutputMimeDescriptor()` | Return Mermaid descriptor. | None | Not applicable. |
| `getD3JsonOutputMimeDescriptor()` | Return D3 JSON descriptor. | None | Not applicable. |
| `isMimeDescriptorCategory(descriptor, category)` | Predicate for category membership. | None | `false` for malformed descriptor. |
| `getRdfAdapterDescriptorForMimeType(mimeType)` | Resolve parser/serializer adapter metadata for RDF MIME. | None | Unknown or unsupported RDF result object. |
| `getN3ParserFormatForMimeType(mimeType)` | Resolve N3 parser/writer format string. | None | Unknown or unsupported parser-format result object. |
| `isN3ParserSupportedMimeType(mimeType)` | Predicate for direct N3 parser support. | None | `false`. |
| `rdfSerializationPreservesNamedGraphs(mimeType)` | Predicate for named graph preservation. | None | `false`. |
| `detectRdfMimeTypeFromText(text)` | Lightweight RDF content sniffing to a supported descriptor result. | None | Falls back to `text/plain` descriptor. |

## Removed From Format Registry

| Old export | Replacement | Reason |
| --- | --- | --- |
| `downloadTextFile` | `browser-file-io/downloadTextFile` | Creates Blob/object URL/anchor and belongs to a browser adapter package. |
| `getAcceptExtensions` | `browser-file-io/createAcceptAttribute(listSupportedMimeDescriptors(), { category })` | Produces an HTML file-input attribute, not a registry fact. |
| `guessRdfMimeTypeFromText` | `detectRdfMimeTypeFromText` | New name is action-oriented and returns the same structured descriptor-result shape used by the registry. |

## Runtime Boundary

- Node safe: yes.
- Browser safe: yes.
- Worker safe: yes.
- Requires DOM: no.
- Requires `Blob`, `File`, `FileReader`, `URL`, `window`, `document`, `localStorage`, `indexedDB`, FSA, or vendor parser globals: no.
- Logs: no.
- Network: no.
- Storage: no.

## Interface Matrix

| Capability | JS API | Browser | CLI | CI | Agent/Tool | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Parse/inspect | Yes | Via adapters | Not yet | Via Jest | Not yet | Registry inspects names/tokens/text snippets only; it does not parse files. |
| Validate | Partial | Via adapters | Not yet | Via Jest | Not yet | Validation means supported/unsupported descriptor lookup, not syntax validation. |
| Convert/transform | Partial | Via adapters | Not yet | Via Jest | Not yet | Normalizes aliases and maps MIME to extension/parser adapter metadata. |
| Serialize/export | Partial | Via adapters | Not yet | Via Jest | Not yet | Provides MIME/extension decisions; actual serialization belongs to RDF/tabular/report packages. |
| Diagnostics/report | Result objects | Via adapters | Not yet | Via Jest | Not yet | Expected failures return structured result objects. |

## App Adapter Rule

Browser code may import `format-registry` for format decisions. Browser code must import `browser-file-io` for file reads, accept attributes, downloads, and Blob/URL/DOM behavior.

OntoEagle, TOM, Axiolotl, Visual Lynx, OCM, SPV, Ontology Tabulator, Table Nova, and IRI Swapper shared `format-registry` copies were aligned with this source boundary during this audit.

## Test Coverage

`__tests__/mime-registry.test.js` now covers:

- Uppercase, path-like, query-string, extensionless, and dotfile filename cases.
- RDF, tabular, document, query, data, archive, Mermaid, D3 JSON, and binary descriptors.
- Unknown extension and unknown MIME result objects.
- Alias normalization.
- Preferred extension lookup.
- Category filtering through `listSupportedMimeDescriptors`.
- N3 adapter mapping and unsupported parser cases.
- Named graph preservation decisions.
- RDF text content detection for JSON-LD, RDF/XML, Turtle, SPARQL-style `PREFIX`, N-Triples, and plain text.
- Absence of browser adapter exports from the public format-registry API.

Command run:

```powershell
npm test
```

from `monorepo-staging/packages/format-registry`.

Result: 15 tests passed.
