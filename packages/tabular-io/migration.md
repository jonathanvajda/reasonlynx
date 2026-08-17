# Tabular I/O Migration Notes

## General Pattern

```js
const text = await readFileAsText(file);
const parsed = parseDelimitedText(text, { delimiter: ',' });
```

For export:

```js
const csv = serializeDelimitedRecords(records, { headers });
downloadTextFile('export.csv', csv, { mimeType: 'text/csv' });
```

## Query Records

Apps should normalize stored query exports into:

- `queryId`
- `queryLabel`
- `queryLanguage`
- `queryText`
- `queryKind`
- `description`
- `tags`
- `createdAt`
- `updatedAt`

Axiolotl can keep a legacy import adapter for its existing saved-query CSV
headers while exporting the generic headers going forward. Its legacy import
adapter should call `parseQueryRecordsFromDelimitedText(text, {
defaultQueryLanguage: 'sparql' })`.

## IRI Mapping

Use the generic parser first, then mapping adapter:

```js
const parsed = parseDelimitedText(text, { delimiter: ',' });
const result = createIriMappingFromRows(parsed.records, { duplicatePolicy: 'last' });
```
