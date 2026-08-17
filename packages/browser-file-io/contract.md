# Browser File I/O Contract

## Scope

The package owns browser file and download boundaries. It is allowed to use:

- `File` and `Blob` methods;
- `FileReader`;
- `Blob`;
- `URL.createObjectURL`;
- `URL.revokeObjectURL`;
- `document.createElement('a')`;
- temporary DOM insertion for browser-compatible anchor clicks.

It is not allowed to:

- parse RDF, CSV, XLSX, DOCX, SPARQL, JSON-LD, or reports;
- read or write IndexedDB, OPFS, localStorage, or File System Access handles;
- log, toast, confirm, or mutate application state;
- depend on app-specific globals.

## Functions

### `readFileAsText(file, options = {})`

Reads a browser `File` or `Blob` as text.

```js
const text = await readFileAsText(file, { encoding: 'utf-8' });
```

Input:

- `file`: File/Blob-like object.
- `options.encoding`: optional encoding. Forces FileReader path.
- `options.signal`: optional `AbortSignal`.
- `options.preferNativeText`: defaults to `true`.

Output:

- `Promise<string>`.

Errors:

- Throws `TypeError` synchronously when the input is not file-like.
- Rejects native `reader.error` when available.
- Rejects `Error('Failed to read file as text.')` when FileReader fails without a native error.
- Rejects `AbortError` when aborted.

### `readFileAsArrayBuffer(file, options = {})`

Reads a browser `File` or `Blob` as binary data.

Input:

- `file`: File/Blob-like object.
- `options.signal`: optional `AbortSignal`.
- `options.preferNativeArrayBuffer`: defaults to `true`.

Output:

- `Promise<ArrayBuffer>`.

Errors:

- Same browser primitive errors as text reads.
- Rejects `TypeError('File read did not produce an ArrayBuffer.')` if a FileReader path returns an unexpected result.

### `createTextBlob(text, options = {})`

Creates a text `Blob` without triggering a download.

Input:

- `text`: any value, stringified with `String(text ?? '')`.
- `options.mimeType`: defaults to `text/plain`.
- `options.charset`: defaults to `utf-8`; use `false` to suppress charset.

Output:

- `Blob`.

### `downloadBlob(fileName, blob, options = {})`

Triggers a browser download for a `Blob`.

Input:

- `fileName`: suggested filename. Empty values become `download.txt`.
- `blob`: payload.
- `options.revokeDelayMs`: default `0`.
- `options.appendToDocument`: default `true`.

Output:

- `{ fileName, objectUrl, revokeDelayMs }`.

Errors:

- Throws if `document.createElement`, `URL.createObjectURL`, or `URL.revokeObjectURL` is unavailable.

### `downloadTextFile(fileName, text, options = {})`

Creates a text Blob and downloads it.

Input:

- `fileName`, `text`, and the combined options of `createTextBlob` and `downloadBlob`.

Output:

- The `downloadBlob` descriptor.

### `createAcceptAttribute(entries, options = {})`

Creates a comma-separated HTML input `accept` value.

Input:

- `entries`: strings or descriptor objects with `{ extensions, mimeType, category }`.
- `options.category`: optional descriptor category filter.
- `options.includeMimeTypes`: default `false`.

Output:

- String such as `.ttl,.rdf,.jsonld`.

## Compatibility

- Browser: intended for modern evergreen browsers.
- Worker: read helpers may work where File/Blob APIs exist; download helpers are not worker-safe.
- Node: not Node-safe except tests using mocks and Node's `Blob`.

