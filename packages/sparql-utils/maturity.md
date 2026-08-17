# Reuse Maturity Ratings

## Capability Family

- **Capability family:** SPARQL query pattern extraction and SPARQL update pattern implementation
- **Date updated:** 2026-08-15

## Rating Table

|ID|Function or package|Current level|Target level|Evidence|Blockers|Next action|Owner|Date updated|
|:---|:---|:---:|:---:|:---|:---|:---|:---|:---|
|MAT-001|SPARQL prologue utilities|5|5|`extractSparqlPrologueDeclarations`, `splitSparqlPrologueFromBody`, `formatSparqlPrefixDeclarations`, and `prependSparqlPrologue` are promoted in browser shared code and `monorepo-staging/packages/sparql-utils/src`; Jest covers BASE separation, prefix sorting, and prologue/body splitting.|None for this milestone.|Use in future query editors rather than reintroducing prefix parsers.|Codex|2026-08-10|
|MAT-002|SPARQL lexical scanner utilities|5|5|`stripSparqlLineComments`, `scanSparqlLexicalTokens`, and `readBalancedSparqlBraceBlock` are promoted; Jest covers comments, strings, hash fragments, IRI refs, prefixed names, and nested brace blocks.|None for this milestone.|Prefer parser-backed implementations later only if a broader SPARQL AST milestone requires it.|Codex|2026-08-10|
|MAT-003|SPARQL operation classification|5|5|`classifySparqlOperationFamily` and `isSparqlUpdateOperation` are promoted; Jest covers READ, UPDATE, and UNKNOWN after prologue/comment handling.|None for this milestone.|Use these helpers for app branching instead of ad hoc keyword checks.|Codex|2026-08-10|
|MAT-004|SPARQL IRI rewrite utilities|5|5|`extractSparqlRewriteTokens`, `buildSparqlRewritePreviewRows`, `rewriteSparqlIris`, `formatSparqlIriToken`, and `countAppliedSparqlIriRewrites` are promoted; IRI Swapper uses the package and manual validation confirmed preview/apply/download behavior.|None for this milestone.|Keep rewrite result change logs as the authoritative applied-change count.|Codex|2026-08-10|
|MAT-005|SPARQL query pattern extraction|5|5|`parseSparqlQueryToAst`, `extractSelectedVariableKeysFromSparqlAst`, `extractWhereTriplesFromSparqlAst`, `buildSparqlGraphModelFromAst`, and related AST term helpers are promoted. The 18.9 headless audit confirms explicit SPARQL.js runtime injection, no DOM/storage/download side effects, and Jest coverage for parser injection, missing parser failure, selected variables, recursive WHERE triples, stable term keys, labels, and graph model categories.|Visualization rendering remains app-local by design.|Use this package for future query-pattern visualizers; keep DOM/canvas rendering separate.|Codex|2026-08-15|
|MAT-006|SPARQL update pattern implementation|5|5|`buildSparqlUpdatePreviewConstructs`, `describeSparqlUpdateShape`, `parseSparqlInsertWhereUpdate`, `parseSparqlDeleteWhereUpdate`, `parseSparqlDeleteInsertWhereUpdate`, `applySparqlUpdateToQuadStore`, and `rdfJsQuadsToQuadRows` are promoted. The 18.9 headless audit confirms update side effects are isolated to injected adapters. Jest covers INSERT DATA, DELETE/INSERT WHERE preview construction, injected quad-store materialization, named-graph insert override, RDF/JS quad-row conversion, and unsupported administrative UPDATE rejection. Axiolotl rewires local UPDATE commit to `applySparqlUpdateToQuadStore` and deletes the no-op `applyUpdateWithComunica` path.|Administrative SPARQL UPDATE operations and remote endpoint mutation remain out of scope.|Use this package for local quad-store UPDATE materialization; handle remote/admin UPDATE in a later explicit capability if needed.|Codex|2026-08-15|

## Promotion Checklist

- [x] Function names are action-oriented and SPARQL-domain-specific.
- [x] Inputs and outputs are explicit and documented with JSDoc.
- [x] Core logic is pure and has no DOM, storage, download, or logging side effects.
- [x] Error and warning behavior is predictable.
- [x] Representative Jest fixtures cover common and edge-case text forms.
- [x] Package source exists under `monorepo-staging/packages/sparql-utils/src`.
- [x] Package tests exist under `monorepo-staging/packages/sparql-utils/__tests__`.
- [x] Browser shared copies are present in current consumer apps.

## Closeout Notes

- SPARQL update pattern implementation includes supported local quad-store materialization through injected adapters.
- Comunica engine construction and IndexedDB store objects remain app adapters; the promoted package owns reusable UPDATE orchestration and quad-row conversion.
- Remote endpoint mutation and administrative UPDATE operations are intentionally deferred to later capability families.
- The package reuses namespace-registry prefix maps for SPARQL prefix formatting. `BASE` remains SPARQL-specific and is not a namespace registry prefix.
- The 18.9 headless audit is recorded in `headless-api-audit.md`; SPARQL.js parser access is now explicit through caller-supplied runtime options.
