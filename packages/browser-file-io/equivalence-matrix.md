# Equivalence Matrix

## Capability Family

- **Capability family:** Browser File I/O and Downloads
- **Candidate groups:** GRP-001 text file readers, GRP-002 array buffer readers, GRP-003 text downloads, GRP-005 embedded file reads
- **Related inventory IDs:** BFI-001 through BFI-028
- **Comparison date:** 2026-07-26

## Behavior Matrix

|Candidate ID|App|Function|Core behavior|Input shape|Output shape|Formats|Options|Error model|Warning model|Side effects|Dependencies|Worker-safe|Node-safe|Browser-only assumptions|Known bugs|Legitimate variations|Test fixtures|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---|:---|:---|:---|
|BFI-003|OntoEagle|`readFileAsText`|Read `File` as text using `FileReader`|`File`|`Promise<string>`|Any text|None|Rejects generic `Error('File read error')`|None|File read|`FileReader`|No|No|Browser File API|Native `reader.error` detail is lost|Simple error message may be user-friendly|None|
|BFI-010|Axiolotl|`readFileAsText`|Read `File` as text using `FileReader`|`File`|`Promise<string>`|Any text|None|Rejects `FileReader.onerror` event/error|None|File read|`FileReader`|No|No|Browser File API|Unclear exact rejection payload|Preserving native error is useful|None|
|BFI-014|Visual Lynx|`readFileAsText`|Read `File` as text using `FileReader`|`File`|`Promise<string>`|Any text|None|Rejects generic `Error('File read error')`|None|File read|`FileReader`|No|No|Browser File API|Native `reader.error` detail is lost|Matches OntoEagle implementation|None|
|BFI-024|Table Nova|`readFileAsText`|Read `File` as text using `FileReader`|`File`|`Promise<string>`|Any text|None|Rejects `reader.error` or clear fallback error; catches setup errors|None|File read|`FileReader`|No|No|Browser File API|No encoding option|Strongest current error model|None|
|BFI-025|Table Nova|`readFileAsArrayBuffer`|Read `File` as ArrayBuffer using `FileReader`|`File`|`Promise<ArrayBuffer>`|Binary or text|None|Rejects `reader.error` or clear fallback error; catches setup errors|None|File read|`FileReader`|No|No|Browser File API|No type guard if `reader.result` is unexpected|Useful for XLS/XLSX|None|
|BFI-027|Table Nova DocxHund|`readFileAsArrayBuffer`|Read `File` as ArrayBuffer using modern File API|`File`|`Promise<ArrayBuffer>`|Binary DOCX|None|Native `file.arrayBuffer()` rejection|None|File read|`File.arrayBuffer()`|Potentially yes in workers with File API|No|Modern File API|No fallback for older browser baseline|Cleaner if baseline supports it|None|
|BFI-001|Shared copies|`downloadTextFile`|Create text Blob, object URL, temporary anchor, click, revoke|`fileName`, `text`, options|`void`|Any text MIME; inferred from filename if possible|`mimeType`, `charset`|No explicit errors; browser API errors would throw|None|DOM and object URL mutation|Blob, URL, document|No|No|Browser document and DOM body|No delayed revoke option; not awaitable|MIME inference and charset options are useful|None|
|BFI-015|Visual Lynx|`downloadContent`|Delegates object payload to `downloadTextFile`|`{content, filename, mimeType}`|`void`|Any text MIME|Object parameter|Same as BFI-001|None|Download through helper|BFI-001|No|No|Browser document|Wrapper name is vague|Object parameter reduces argument-order mistakes|None|
|BFI-017|OCM|`downloadTextFile`|Delegates report text to shared helper with old arg order|`text`, `fileName`, `mimeType`|`void`|Report CSV/TSV/YAML/HTML/RDF text|None|Same as BFI-001|None|Download through helper|BFI-001|No|No|Browser document|Argument order conflicts with shared candidate|May be retained as app adapter during migration|Serializer tests only|
|BFI-019|Ontology Tabulator|`downloadCsv`|Download CSV through shared helper|`filename`, `csvContent`|`void`|CSV|Fixed MIME `text/csv`|Same as BFI-001|None|Download through helper|BFI-001|No|No|Browser document|Format-specific wrapper not reusable beyond CSV|Useful local adapter for table UI|None|
|BFI-021|IRI Swapper RDF|`downloadRun`|Serialize stored RDF run then call shared download helper|`runId`, MIME content type|`Promise<void>`|RDF serializations|Content type select|Storage/serialization errors throw; download unmodeled|None|Reads storage and downloads|IndexedDB app storage, BFI-001|No|No|Browser document and app DB|Too broad for browser package|App adapter should remain outside package|None|
|BFI-022|IRI Swapper SPARQL|`downloadRunAsRq`|Read stored SPARQL run then call shared download helper|`runId`|`Promise<void>`|SPARQL query text|Fixed MIME|Storage errors throw; download unmodeled|None|Reads storage and downloads|IndexedDB app storage, BFI-001|No|No|Browser document and app DB|Too broad for browser package|App adapter should remain outside package|None|
|BFI-005/BFI-006/BFI-013|Inline handlers|anonymous / inline|Manual FileReader or Blob URL in UI handler|Event state or app object|Usually no reusable return|CSV/JSON/text|Local constants|Mostly no explicit error model|Console/UI in some cases|DOM, file, download, state mutation|Browser APIs|No|No|Browser document/input events|Hard to test, tightly coupled|Good migration targets, not promotion sources|None|

## Difference Classification

|Difference ID|Candidates affected|Description|Classification|Decision|Rationale|
|:---|:---|:---|:---|:---|:---|
|DIFF-001|BFI-003, BFI-010, BFI-014, BFI-024|Text readers differ on whether they preserve `reader.error` or replace it with generic `File read error`|Improvement|Adopt Table Nova style: reject native error when available, otherwise a stable fallback `Error`|Preserves debugging detail while keeping a predictable fallback.|
|DIFF-002|BFI-024 vs BFI-027|ArrayBuffer readers differ between `FileReader.readAsArrayBuffer` and `file.arrayBuffer()`|Legitimate option|Canonical should prefer modern `file.arrayBuffer()` if available and fall back to FileReader|Keeps code simple for modern browsers while honoring baseline uncertainty.|
|DIFF-003|BFI-001, BFI-015, BFI-017, BFI-019, BFI-026, BFI-028|Download argument order varies: `(fileName, text, options)`, object parameter, `(text, fileName, mimeType)`|Accidental divergence|Canonical should use `(fileName, text, options)`; app adapters may preserve old order temporarily|Action-oriented name plus filename-first matches browser download mental model.|
|DIFF-004|BFI-001 vs inline downloads|Some implementations append the anchor to `document.body`; some click unattached anchors|Legitimate option|Canonical should append and remove anchor for widest browser compatibility|Appending improves compatibility with older browser behavior.|
|DIFF-005|BFI-001|Object URL is revoked immediately after click|Potential bug / browser variation|Characterization should test common browsers; consider deferred revoke option|Some browsers tolerate immediate revoke; delayed revoke may be safer for large downloads.|
|DIFF-006|BFI-001, BFI-002|Browser helper imports MIME registry and also provides accept strings and MIME guessing|Boundary concern|Keep MIME registry as dependency, but browser-file-io should not become a second MIME registry|Avoids the previous confusion between MIME/format and browser file/download capability cycles.|
|DIFF-007|BFI-007, BFI-008, BFI-012, BFI-018, BFI-020, BFI-023|Several functions combine file reading with RDF/tabular parsing and storage|App-specific adapter|Do not promote combined functions; use them as migration/caller notes|Browser package should stop at file bytes/text and download side effects.|

## Canonical Behavior Recommendation

- **Recommended canonical behavior:**
  - `readFileAsText(file, options = {})` returns `Promise<string>`.
  - `readFileAsArrayBuffer(file, options = {})` returns `Promise<ArrayBuffer>`.
  - `createTextBlob(text, options = {})` returns a `Blob`.
  - `downloadBlob(fileName, blob, options = {})` performs the browser anchor/object URL side effect.
  - `downloadTextFile(fileName, text, options = {})` composes `createTextBlob` and `downloadBlob`.
  - `createAcceptAttribute(descriptorsOrExtensions, options = {})` should be pure and may consume format-registry descriptors.
- **Behavior to preserve as options:**
  - Explicit MIME type.
  - Charset option with `false` to suppress charset.
  - Optional object-parameter adapter for app code that prefers named arguments.
  - Modern `file.text()` / `file.arrayBuffer()` path where browser baseline supports it.
- **Behavior to reject:**
  - Global browser registry shims.
  - App workflow functions that mix file reading, parsing, storage, UI, and download into one promoted function.
  - Silent loss of native `reader.error` where it is available.
- **Behavior requiring migration notes:**
  - OCM's `(text, fileName, mimeType)` order.
  - Visual Lynx's `{ content, filename, mimeType }` object wrapper.
  - Table Nova's `mime` string third parameter.
  - Axiolotl's fire-and-forget dynamic import wrapper.
- **Open questions:**
  - Should `downloadBlob` revoke immediately or after a short timeout?
  - Should `readFileAsText` expose encoding options or rely on UTF-8/default browser decoding?
  - Should accept-attribute construction live in `browser-file-io` or remain in `format-registry` as a pure UI helper?
