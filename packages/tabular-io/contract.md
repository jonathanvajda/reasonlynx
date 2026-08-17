# Tabular I/O Contract

## Scope

Allowed:

- Parse delimited text into headers, rows, records, and warnings.
- Serialize row arrays and record arrays to CSV/TSV-style text.
- Normalize SQL/SPARQL/NoSQL query exchange rows.
- Create IRI mapping data from already parsed row records.

Not allowed:

- Read browser `File` objects.
- Trigger browser downloads.
- Mutate DOM, app session state, graph caches, or IndexedDB.
- Parse RDF, SPARQL syntax, SQL syntax, or NoSQL syntax.
- Edit or inline vendor code.

## Error and Warning Model

Core delimited parsing returns non-fatal warnings for duplicate headers,
blank headers, row-width differences, and unterminated quotes. Programmer or
contract errors, such as impossible IRI mapping headers, throw `Error`.

The package does not log. Apps own console logging, toasts, confirmation
dialogs, and recovery.

## Query Record Exchange

The query exchange contract is language-neutral:

```js
{
  queryId: 'query:active-users',
  queryLabel: 'Active users',
  queryLanguage: 'sql',
  queryText: 'select * from users where active = 1',
  queryKind: 'select',
  description: '',
  tags: ['users'],
  createdAt: '',
  updatedAt: ''
}
```

Axiolotl's current saved SPARQL CSV can be adapted by mapping:

- `query ID (IRI)` -> `queryId`
- `label` -> `queryLabel`
- `type (class iri)` -> `queryKind`
- `value ('has sparql query text value')` -> `queryText`
- pass `defaultQueryLanguage: 'sparql'` if the legacy CSV omits a language column.

CQ Ferret can use the same contract for database-query artifacts by setting
`queryLanguage` to `sql`, `sparql`, `mongodb`, or another explicit language.
