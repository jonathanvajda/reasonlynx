# MIME Handling Deep Comparison

## Purpose

This note refines the first format-registry inventory into a cleaner JavaScript-only package design. Python candidates are ignored for promotion. App-specific conversion matrices remain app-local. Mermaid and D3 JSON outputs are treated as distinct output helpers, not as ordinary RDF or file-intake normalization.

## Revised Capability Split

|Capability|Canonical function|Domain|Range|Notes|
|:---|:---|:---|:---|:---|
|Get filename extension|`getFilenameExtension(fileName)`|String-like filename or path.|Lowercase extension without dot, or empty string.|Pure utility. Based on TOM `parseFileExtension`, but should handle query/hash suffixes if browser file URLs ever appear.|
|Guess MIME from filename extension|`getSupportedMimeTypeForFilename(fileName)`|String-like filename.|Result object with canonical MIME descriptor, or `{ ok: false, error: 'unknown filetype' }`.|Generic across supported monorepo formats. File picker filters stay independent.|
|Assign MIME for intended output extension|`getOutputMimeTypeForExtension(extension)`|Extension selected for export, with or without dot.|Result object with canonical MIME descriptor, or unknown-filetype result.|Reasonable as the converse of filename lookup, but should be explicit that output extensions may be narrower than input extensions.|
|Normalize a MIME or token|`normalizeSupportedMimeType(input)`|MIME string or known shorthand token.|Result object with canonical descriptor, or unknown-filetype result.|Generic, but only for supported registry values.|
|Mermaid output descriptor|`getMermaidOutputMimeDescriptor()`|None.|Canonical Mermaid output descriptor.|Separate by design; not part of RDF serialization.|
|D3 JSON output descriptor|`getD3JsonOutputMimeDescriptor()`|None.|Canonical D3 JSON output descriptor.|Separate by design; not part of RDF serialization.|
|RDF parser adapter format|`getN3ParserFormatForMimeType(mimeType)`|Canonical RDF MIME.|N3 parser format string or unknown/unsupported result.|Vendor adapter, not MIME registry source of truth.|
|Supported conversions|App-local, e.g. `getLinkedDataTransformerOutputOptions(inputMime)`|Input MIME plus app context.|App-specific option list.|Do not promote as universal core yet.|

## Candidate Comparison

|Candidate|Current name|Naming fit|Input domain|Output range|Unknown handling|Logging/side effects|Promotion decision|
|:---|:---|:---|:---|:---|:---|:---|:---|
|FMT-002 TOM|`parseFileExtension(filename)`|Good utility name, though `getFilenameExtension` is clearer.|Filename string.|Extension string or empty string.|Invalid input returns empty string.|None.|Promote behavior as generic extension utility.|
|FMT-003 TOM|`detectFormatByExtension(extension)`|Too broad and lossy for MIME registry.|Extension only.|`spreadsheet`, `ontology`, `unsupported`.|Unknown returns `unsupported`.|None.|Do not promote as MIME function; keep as app intake classifier if needed.|
|FMT-012 Visual Lynx|`normalizeMimeType`|Good generic name, but registry mixes RDF with Mermaid/D3.|MIME or token.|MIME string; unknown returns original input.|Unknown can masquerade as known normalized value.|None.|Use registry shape, but change unknown handling and split Mermaid/D3.|
|FMT-012 Visual Lynx|`guessInputMimeFromFilename`|Too tentative if backed by exact extension registry.|Filename string.|MIME string or `null`.|Unknown returns `null`.|None.|Rename to `getSupportedMimeTypeForFilename`; return result object.|
|FMT-012 Visual Lynx|`getDownloadExtension`|Useful, but direction is MIME-to-extension, not output extension-to-MIME.|MIME string.|Extension string, fallback `txt`.|Unknown returns `txt`.|None.|Keep as separate `getPreferredExtensionForMimeType`; do not use for user's converse function.|
|FMT-014 OCM|`normalizeRdfFormat`|Good RDF-specific name, not generic.|RDF token or MIME.|RDF MIME or `null`.|Unknown returns `null`.|None.|Use RDF alias coverage in generic registry.|
|FMT-014 OCM|`detectRdfFormat(fileName)`|RDF-specific and returns MIME, not "format".|Filename string.|RDF MIME.|Unknown falls back to Turtle.|None.|Do not preserve fallback in core; use coverage only.|
|FMT-018 IRI Swapper|`detectOntologyFormat(fileName)`|Too app-specific, but descriptor output is useful.|Filename string.|`{ contentType, label }`.|Unknown descriptor uses octet-stream and "will attempt parsing".|None.|Use descriptor idea; do not map `.trig` to Turtle in canonical MIME.|
|FMT-009 Axiolotl|`workspaceExportExtension(mime)`|Direction is MIME-to-extension.|MIME string.|Extension string.|Unknown fallback `rdf`.|None.|Replace with canonical preferred-extension helper plus app fallback if needed.|
|FMT-020 Table Nova|Inline export map|App-specific closure.|Export kind.|Text and extension.|Missing key exits handler.|Download side effect in caller.|Keep app-local; can call canonical output MIME helper.|

## Error and Warning Model

Prefer a result object over throwing for registry lookup:

```js
{ ok: true, value: descriptor }
{ ok: false, error: 'unknown filetype', input: 'file.xyz' }
```

Rationale:

- The function stays pure and predictable.
- File pickers can reject unknowns without try/catch.
- Apps can deliberately choose fallback behavior in adapters.
- Unknown filetype is not exceptional inside a generic intake workflow.

No canonical MIME registry function should log. Logging belongs at the app boundary where the app knows whether an unknown file blocks import, triggers a best-effort parser, or shows a UI warning.

## Proposed JavaScript

```js
export const SUPPORTED_MIME_DESCRIPTORS = Object.freeze({
  turtle: Object.freeze({
    id: 'turtle',
    mimeType: 'text/turtle',
    label: 'Turtle',
    category: 'rdf',
    extensions: Object.freeze(['ttl', 'turtle']),
    aliases: Object.freeze(['ttl', 'turtle', 'text/turtle'])
  }),
  nTriples: Object.freeze({
    id: 'nTriples',
    mimeType: 'application/n-triples',
    label: 'N-Triples',
    category: 'rdf',
    extensions: Object.freeze(['nt', 'ntriples']),
    aliases: Object.freeze(['nt', 'ntriples', 'n-triples', 'application/n-triples'])
  }),
  nQuads: Object.freeze({
    id: 'nQuads',
    mimeType: 'application/n-quads',
    label: 'N-Quads',
    category: 'rdf',
    extensions: Object.freeze(['nq', 'nquads']),
    aliases: Object.freeze(['nq', 'nquads', 'n-quads', 'application/n-quads'])
  }),
  trig: Object.freeze({
    id: 'trig',
    mimeType: 'application/trig',
    label: 'TriG',
    category: 'rdf',
    extensions: Object.freeze(['trig']),
    aliases: Object.freeze(['trig', 'application/trig'])
  }),
  n3: Object.freeze({
    id: 'n3',
    mimeType: 'text/n3',
    label: 'Notation3',
    category: 'rdf',
    extensions: Object.freeze(['n3']),
    aliases: Object.freeze(['n3', 'text/n3'])
  }),
  jsonLd: Object.freeze({
    id: 'jsonLd',
    mimeType: 'application/ld+json',
    label: 'JSON-LD',
    category: 'rdf',
    extensions: Object.freeze(['jsonld', 'json-ld']),
    aliases: Object.freeze(['jsonld', 'json-ld', 'application/ld+json'])
  }),
  rdfXml: Object.freeze({
    id: 'rdfXml',
    mimeType: 'application/rdf+xml',
    label: 'RDF/XML',
    category: 'rdf',
    extensions: Object.freeze(['rdf', 'owl', 'xml']),
    aliases: Object.freeze(['rdf', 'owl', 'xml', 'rdfxml', 'rdf/xml', 'application/rdf+xml'])
  }),
  sparqlQuery: Object.freeze({
    id: 'sparqlQuery',
    mimeType: 'application/sparql-query',
    label: 'SPARQL Query',
    category: 'query',
    extensions: Object.freeze(['rq', 'sparql']),
    aliases: Object.freeze(['rq', 'sparql', 'application/sparql-query'])
  }),
  csv: Object.freeze({
    id: 'csv',
    mimeType: 'text/csv',
    label: 'CSV',
    category: 'tabular',
    extensions: Object.freeze(['csv']),
    aliases: Object.freeze(['csv', 'text/csv'])
  }),
  tsv: Object.freeze({
    id: 'tsv',
    mimeType: 'text/tab-separated-values',
    label: 'TSV',
    category: 'tabular',
    extensions: Object.freeze(['tsv']),
    aliases: Object.freeze(['tsv', 'text/tab-separated-values'])
  }),
  xlsx: Object.freeze({
    id: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'XLSX',
    category: 'tabular',
    extensions: Object.freeze(['xlsx', 'xls']),
    aliases: Object.freeze(['xlsx', 'xls'])
  }),
  docx: Object.freeze({
    id: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
    category: 'document',
    extensions: Object.freeze(['docx']),
    aliases: Object.freeze(['docx'])
  }),
  plainText: Object.freeze({
    id: 'plainText',
    mimeType: 'text/plain',
    label: 'Plain text',
    category: 'text',
    extensions: Object.freeze(['txt', 'text']),
    aliases: Object.freeze(['txt', 'text', 'text/plain'])
  }),
  html: Object.freeze({
    id: 'html',
    mimeType: 'text/html',
    label: 'HTML',
    category: 'document',
    extensions: Object.freeze(['html', 'htm']),
    aliases: Object.freeze(['html', 'htm', 'text/html'])
  }),
  json: Object.freeze({
    id: 'json',
    mimeType: 'application/json',
    label: 'JSON',
    category: 'data',
    extensions: Object.freeze(['json']),
    aliases: Object.freeze(['json', 'application/json'])
  })
});

const FORMAT_LIST = Object.freeze(Object.values(SUPPORTED_MIME_DESCRIPTORS));

const MIME_BY_EXTENSION = Object.freeze(
  Object.fromEntries(FORMAT_LIST.flatMap((format) =>
    format.extensions.map((extension) => [extension, format])
  ))
);

const MIME_BY_ALIAS = Object.freeze(
  Object.fromEntries(FORMAT_LIST.flatMap((format) =>
    [format.mimeType, ...format.aliases].map((alias) => [normalizeToken(alias), format])
  ))
);

export function getFilenameExtension(fileName) {
  const clean = String(fileName || '').split(/[?#]/, 1)[0].trim();
  const base = clean.split(/[\\/]/).pop() || '';
  const index = base.lastIndexOf('.');
  if (index <= 0 || index === base.length - 1) return '';
  return base.slice(index + 1).toLowerCase();
}

export function getSupportedMimeTypeForFilename(fileName) {
  const extension = getFilenameExtension(fileName);
  const descriptor = MIME_BY_EXTENSION[extension];
  return descriptor
    ? { ok: true, value: descriptor }
    : { ok: false, error: 'unknown filetype', input: String(fileName || ''), extension };
}

export function getOutputMimeTypeForExtension(extension) {
  const normalized = normalizeExtension(extension);
  const descriptor = MIME_BY_EXTENSION[normalized];
  return descriptor
    ? { ok: true, value: descriptor }
    : { ok: false, error: 'unknown filetype', input: String(extension || ''), extension: normalized };
}

export function normalizeSupportedMimeType(input) {
  const descriptor = MIME_BY_ALIAS[normalizeToken(input)];
  return descriptor
    ? { ok: true, value: descriptor }
    : { ok: false, error: 'unknown filetype', input: String(input || '') };
}

export function getPreferredExtensionForMimeType(mimeType) {
  const result = normalizeSupportedMimeType(mimeType);
  if (!result.ok) return result;
  return { ok: true, value: result.value.extensions[0] };
}

export function getMermaidOutputMimeDescriptor() {
  return Object.freeze({
    id: 'mermaid',
    mimeType: 'text/mermaid',
    label: 'Mermaid',
    category: 'visualization',
    extensions: Object.freeze(['mmd', 'mermaid'])
  });
}

export function getD3JsonOutputMimeDescriptor() {
  return Object.freeze({
    id: 'd3Json',
    mimeType: 'application/d3+json',
    label: 'D3 JSON',
    category: 'visualization',
    extensions: Object.freeze(['json'])
  });
}

export function getN3ParserFormatForMimeType(mimeType) {
  const result = normalizeSupportedMimeType(mimeType);
  if (!result.ok) return result;

  const n3Formats = {
    'text/turtle': 'Turtle',
    'application/n-triples': 'N-Triples',
    'application/n-quads': 'N-Quads',
    'application/trig': 'TriG',
    'text/n3': 'N3'
  };

  const value = n3Formats[result.value.mimeType];
  return value
    ? { ok: true, value }
    : { ok: false, error: 'unsupported parser format', input: result.value.mimeType };
}

function normalizeExtension(extension) {
  return String(extension || '').trim().toLowerCase().replace(/^\./, '');
}

function normalizeToken(input) {
  return String(input || '').trim().toLowerCase();
}
```

## Pushback on the Converse Function

`getOutputMimeTypeForExtension(extension)` is appropriate, with one caution: it is not a perfect converse of filename detection because some extensions are ambiguous by context. The clearest example is `.json`: as input it should probably mean ordinary JSON unless a file picker or content heuristic says JSON-LD; as output it might mean D3 JSON, JSON-LD if the app chose `.jsonld`, or ordinary JSON depending on the export action.

The solution is to keep the pure function simple and exact by extension, then let export workflows provide the intended extension. For ambiguous exports, the app should choose a more specific extension such as `.jsonld` or pass an explicit output descriptor such as `getD3JsonOutputMimeDescriptor()`.

## App Migration Notes

|App|Current candidates|Adoption change if promoted|
|:---|:---|:---|
|OntoEagle|`detectRdfFormat`, RDF constants in `docs\app\rdf_io.js`.|Replace filename detection with `getSupportedMimeTypeForFilename(file.name)`, then reject or app-adapt unknowns. Keep RDF parser adapter separate.|
|tabular-ontology-maker|`parseFileExtension`, `detectFormatByExtension`, `guessMediaType`, export `mimeTypes`/`extensions`.|Replace `parseFileExtension` with `getFilenameExtension`; replace broad classifier with `descriptor.value.category`; keep content sniffing as separate heuristic; replace export maps with `getOutputMimeTypeForExtension` or `getPreferredExtensionForMimeType`.|
|axiolotl|`detectRdfMimeByName`, `workspaceExportExtension`, `commonMIMEType`, `getWorkspaceExportFormats`.|Replace import filename detection and export extension lookup. Keep `getWorkspaceExportFormats(scope)` app-local because default graph vs named graph is app context. Remove logging from pure lookup.|
|visual-lynx|`normalizeMimeType`, `extensionToMime`, `guessInputMimeFromFilename`, `getDownloadExtension`, `supportedConversions`.|Use the canonical generic registry for MIME/extension lookup. Move Mermaid/D3 to dedicated output descriptor functions. Keep `supportedConversions` local to Linked Data Transformer.|
|ontology-curation-manager|`normalizeRdfFormat`, `detectRdfFormat`, `isSupportedRdfFileName`, `getMimeTypeForFormat`.|Replace RDF-only normalizer where generic lookup is acceptable; preserve `isSupportedRdfFileName` as a file-picker/app filter using descriptor category. Replace charset helper with download utility or output descriptor logic.|
|ontology-tabulator|`detectRdfFormatFromFilename`, `isN3ParserFormat`.|Replace detector with generic lookup plus RDF category check. Replace N3 predicate with `getN3ParserFormatForMimeType` or a parser-support predicate. Keep app logging outside lookup.|
|iri-swapper|`detectOntologyFormat`.|Replace descriptor detector with canonical filename lookup. Keep best-effort "will attempt parsing" as app adapter behavior for unknowns. Correct TriG canonical MIME to `application/trig` unless a parser adapter explicitly needs Turtle-compatible handling.|
|table-nova|`detectTabularType`, inline export map.|Replace tabular detector with generic lookup plus `category === 'tabular'`. For exports, call `getOutputMimeTypeForExtension` and keep app-specific text/export-kind mapping local.|

## Decision Summary

- JavaScript-only promotion is appropriate.
- Mermaid and D3 JSON should be dedicated output descriptor helpers, not part of RDF MIME normalization.
- Generic extension-to-MIME lookup is appropriate and should return an explicit unknown result.
- Output-extension-to-MIME lookup is appropriate, but `.json` ambiguity means export workflows should choose specific descriptors when needed.
- Supported conversions are app behavior and should not be promoted as a universal function yet.
