# Browser File I/O

Browser File I/O is the third capability family in the monorepo migration plan.
It covers only browser file-boundary utilities:

- reading `File`/`Blob` objects as text;
- reading `File`/`Blob` objects as `ArrayBuffer`;
- creating text `Blob` objects;
- triggering browser downloads;
- creating HTML file input `accept` strings.

It deliberately does not parse RDF, tabular data, reports, DOCX, SPARQL, or
project records. Those packages should call this package at their browser
boundary and then continue with their domain-specific logic.

## Proposed Exports

```js
readFileAsText(file, options)
readFileAsArrayBuffer(file, options)
createTextBlob(text, options)
downloadBlob(fileName, blob, options)
downloadTextFile(fileName, text, options)
createAcceptAttribute(entries, options)
```

## Package Shape

```text
browser-file-io/
  src/
    create-accept-attribute.js
    create-text-blob.js
    download-blob.js
    download-text-file.js
    index.js
    read-file-as-array-buffer.js
    read-file-as-text.js
  __tests__/
    browser-file-io.test.js
  fixtures/
    README.md
  contract.md
  decision-log.md
  migration.md
  promoted-function-proposal.md
```

## Dependency Notes

This package depends on browser platform APIs. It does not vendor third-party
code. MIME/extension knowledge should be supplied by `format-registry` or by
explicit caller options; this package should not become a second MIME registry.

