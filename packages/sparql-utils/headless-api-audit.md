# SPARQL Query/Update Utilities Headless API Audit

Date: 2026-08-15

## Scope

This package owns reusable SPARQL text utilities for prologue handling, lexical scanning, read/update classification, IRI rewrite workflows, query-pattern extraction from SPARQL.js ASTs, and supported SPARQL UPDATE materialization against an injected quad-store adapter.

It does not own DOM rendering, editor state, query textareas, downloads, IndexedDB object stores, Comunica engine construction, remote endpoint mutation, or administrative graph-store safety policies.

## Headless Boundary Finding

The promoted SPARQL surface is headless when callers respect the adapter boundary.

- Core functions accept strings, prefix maps, mappings, SPARQL.js AST objects, RDF/JS quads, and injected runtime/adapters.
- Core functions return text, graph-model data, preview rows, change logs, quad rows, warnings, or execution summaries.
- No source function touches DOM, `File`, `Blob`, downloads, IndexedDB, localStorage, network, or console logging.
- `parseSparqlQueryToAst` requires an explicit SPARQL.js parser runtime through `options.Parser`, `options.sparqljs`, or `options.runtime.sparqljs`.
- `applySparqlUpdateToQuadStore` performs side effects only through required injected callbacks.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### Prologue and Lexical Utilities

- `extractSparqlPrologueDeclarations(queryText)`
- `formatSparqlPrefixDeclarations(prefixes)`
- `prependSparqlPrologue(queryText, prefixes, options)`
- `splitSparqlPrologueFromBody(queryText)`
- `stripSparqlLineComments(queryText)`
- `scanSparqlLexicalTokens(queryText, options)`
- `readBalancedSparqlBraceBlock(queryText, startOffset)`

### Query and Update Classification

- `classifySparqlOperationFamily(queryText)`
- `isSparqlUpdateOperation(queryText)`

### IRI Rewrite Workflow

- `extractSparqlRewriteTokens(queryText, prefixes)`
- `buildSparqlRewritePreviewRows(run, mapping)`
- `rewriteSparqlIris(queryText, prefixes, mapping, options)`
- `formatSparqlIriToken(iri, prefixes, options)`
- `countAppliedSparqlIriRewrites(rewriteResult)`

### Query Pattern Extraction

- `parseSparqlQueryToAst(queryText, options)`
- `extractSelectedVariableKeysFromSparqlAst(ast)`
- `extractWhereTriplesFromSparqlAst(wherePatterns)`
- `createSparqlAstTermKey(term)`
- `formatSparqlAstTermLabel(term, prefixes)`
- `compactSparqlAstIriForDisplay(iri, prefixes)`
- `selectBestSparqlAstPrefixForIri(iri, prefixes)`
- `classifySparqlTriplePatternEdge(predicateTerm, objectTerm, options)`
- `applySparqlTypeHeuristicsToGraphNodes(nodesById, edges)`
- `buildSparqlGraphModelFromAst(ast, options)`

### Update Materialization

- `buildSparqlUpdatePreviewConstructs(updateText)`
- `describeSparqlUpdateShape(updateText)`
- `parseSparqlInsertWhereUpdate(updateBody)`
- `parseSparqlDeleteWhereUpdate(updateBody)`
- `parseSparqlDeleteInsertWhereUpdate(updateBody)`
- `applySparqlUpdateToQuadStore(updateText, adapters, options)`
- `rdfJsQuadsToQuadRows(quads, options)`

## Input Contracts

- SPARQL text is accepted as strings and normalized with `String(value || '')`, except parser execution passes `String(value ?? '')`.
- Prefix inputs are plain prefix-to-namespace maps and are normalized by `namespace-registry`.
- IRI rewrite mappings must be `Map<string, string>` values keyed by full IRI.
- Query-pattern extraction accepts SPARQL.js AST-shaped objects or an explicitly injected SPARQL.js parser runtime.
- Update materialization accepts SPARQL UPDATE text plus explicit adapters for construct execution, RDF parsing, quad-row deletion, and quad-row insertion.

## Output Contracts

- Prologue functions return result objects with `ok`, value fields, and `warnings`.
- Lexical scanning returns sorted `iriRefs`, sorted `prefixedNames`, and optional token streams.
- Query/update classification returns stable enum strings or booleans.
- IRI rewrite returns rewritten SPARQL text plus a structured change log.
- Query-pattern extraction returns app-neutral graph models: `queryType`, `prefixes`, `nodes`, `edges`, and `whereTripleCount`.
- Update materialization returns `{ deleted, inserted, graphIri, operations }`.

## Error Model

- Recoverable prefix normalization and token expansion issues return warnings.
- Structural brace-read failures return `{ ok: false, error }`.
- Query classification returns `UNKNOWN` for empty or unsupported text.
- `parseSparqlQueryToAst` throws when the parser runtime is not supplied or the injected parser throws.
- `applySparqlUpdateToQuadStore` throws `TypeError` for missing required adapters and unsupported named-graph target options.
- `applySparqlUpdateToQuadStore` throws `Error` for unsupported UPDATE shapes such as `CLEAR`, `DROP`, `LOAD`, `CREATE`, `COPY`, `MOVE`, and `ADD`.

## Adapter Rule

Browser, CLI, CI, and agent adapters may:

- load SPARQL.js, Comunica, or parser runtimes;
- read query/update text from UI, files, stdin, or tool arguments;
- render returned graph models with Cytoscape or other visual libraries;
- execute generated CONSTRUCT queries against a local or remote query engine;
- parse construct output with `rdf-io`;
- persist quad rows through `indexeddb-data-management`;
- show warnings through `ui-feedback`.

Adapters must not:

- reimplement prefix/prologue parsing;
- reimplement lexical scanning for IRI rewrite;
- infer applied rewrite counts by comparing strings;
- bypass `applySparqlUpdateToQuadStore` for supported local quad-store update materialization;
- perform administrative graph-store mutations without a separate explicit safety flow.

## Headless Coverage

Jest coverage exercises:

- `BASE` extraction separated from prefix maps;
- sorted prefix declaration formatting;
- prologue/body splitting;
- lexical scanning that ignores comments and strings;
- comment stripping with hash fragments preserved;
- balanced brace reading with braces inside strings ignored;
- READ/UPDATE/UNKNOWN classification;
- rewrite token extraction excluding prefix declarations;
- preview row generation;
- rewrite of prefix declarations, IRI refs, and prefixed names;
- change-log-based applied count;
- SPARQL IRI token formatting;
- query-pattern graph model extraction from AST-shaped objects;
- explicit SPARQL.js parser runtime injection;
- missing parser runtime failure;
- SPARQL UPDATE preview construction;
- UPDATE materialization through injected quad-store adapters;
- named-graph insert override;
- RDF/JS quad-to-quad-row conversion;
- unsupported administrative UPDATE rejection.

## Maturity Assessment

Current maturity: Level 5 for the scoped query/update utility surface.

Rationale:

- public functions are deterministic unless explicit adapters are supplied;
- parser, query-engine, RDF parser, and quad-store dependencies are injected;
- namespace handling reuses the namespace registry rather than local prefix tables;
- browser-specific behavior is outside the package;
- active consumers use the package for SPARQL visualization, SPARQL IRI rewrite, and Axiolotl local quad-store UPDATE materialization;
- unsupported administrative and remote mutation paths are explicitly out of scope rather than silently accepted.
