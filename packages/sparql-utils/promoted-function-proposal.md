# SPARQL Utils Promoted Function Proposal

## Scope

This document proposes the first promoted package for the SPARQL-related utility capability family. It does not change `inventory.md`.

The first package boundary is intentionally narrow:

- SPARQL prologue extraction, splitting, formatting, and prepending.
- SPARQL lexical scanning where comments, strings, and IRI references must be respected.
- SPARQL read/update operation classification.
- SPARQL IRI rewrite token extraction, preview rows, output rewriting, and change counting.
- SPARQL UPDATE materialization against an injected quad-store adapter for supported DELETE/INSERT template shapes.

The first package does not promote:

- Comunica execution adapters.
- Arbitrary SPARQL UPDATE execution against remote endpoints.
- Administrative SPARQL UPDATE operations such as CLEAR, DROP, LOAD, CREATE, COPY, MOVE, and ADD.
- SPARQL.js AST-to-graph visualization models.
- App-specific query result rendering.
- Diagnostic polarity grading.
- Query artifact IndexedDB storage.

Those should be follow-on adapter packages or later capability-family work.

## Deep Comparison Summary

| Capability | Strongest source | Naming comparison | Input domain | Output range | Error/warning model | Logging/side effects | Promotion decision |
|:---|:---|:---|:---|:---|:---|:---|:---|
| Prologue extraction | shared namespace-registry + IRI Swapper + Axiolotl | Existing names mix `Prefixes` and `Prologue`; `BASE` is not a prefix | SPARQL query/update text | Prefix map, base IRI, prologue text, body text, warnings | Warning-returning result object | None | Promote as `extractSparqlPrologueDeclarations` |
| Prefix formatting/prepending | shared namespace-registry + Axiolotl | Axiolotl stores `PREFIX ...` strings; shared code uses prefix maps | Prefix map and query body | SPARQL text | Warning-returning result object | None | Promote as `formatSparqlPrefixDeclarations` and `prependSparqlPrologue` |
| Prologue/body split | Axiolotl | Existing `splitSparqlPrologue` is clear but should state output range | SPARQL text | `{prologueText, bodyText}` | Result object, no throw | None | Promote as `splitSparqlPrologueFromBody` |
| Comment stripping | Axiolotl + IRI Swapper scanners | Existing names are adequate but too local | SPARQL text | SPARQL text | Pure string return | None | Promote as `stripSparqlLineComments` |
| Lexical token scan | IRI Swapper | `scanSparql` is too broad for a promoted API | SPARQL text | IRI refs, prefixed names, optional token stream | Result object | None | Promote as `scanSparqlLexicalTokens` |
| Brace block read | Axiolotl | `readBraceBlock` lacks domain | SPARQL text and offset | Block content and end offset | `ok:false` error object | None | Promote as `readBalancedSparqlBraceBlock` |
| Query kind detection | Axiolotl | `getQueryKind` is underspecified | SPARQL text | `'READ'|'UPDATE'|'UNKNOWN'` | Pure enum return | None | Promote as `classifySparqlOperationFamily` |
| Update predicate | Axiolotl | `isUpdateQuery` is acceptable but too generic | SPARQL text | Boolean | Pure boolean | None | Promote as `isSparqlUpdateOperation` |
| IRI token extraction | IRI Swapper | Existing name is close; output should say rewrite tokens | SPARQL text and prefix map | Token rows with expanded IRIs | Result object with warnings for unexpanded prefixed names | None | Promote as `extractSparqlRewriteTokens` |
| Rewrite preview rows | IRI Swapper | Existing name is clear but output names were UI-specific | Run-like object and mapping | Table-ready rows and counts | Result object | None | Promote as `buildSparqlRewritePreviewRows` |
| IRI rewrite | IRI Swapper | Existing `rewriteSparqlQuery` is too broad | SPARQL text, prefixes, IRI map | Rewritten SPARQL and change log | Result object | None | Promote as `rewriteSparqlIris` |
| Applied change count | IRI Swapper | Existing implementation inferred from output text | Rewrite result | Count | Pure numeric return | None | Promote as `countAppliedSparqlIriRewrites` using change log |
| IRI token formatting | IRI Swapper + namespace-registry CURIE helpers | Existing `chooseQNameOrIri` is local/private | IRI and active prefixes | SPARQL token | Pure string return | None | Promote as `formatSparqlIriToken` |
| SPARQL UPDATE quad-store materialization | Axiolotl + OCD Comunica adapters | Existing Axiolotl commit path was UI-local and split N-Triples strings; OCD has mature Comunica stream/error patterns | UPDATE text plus injected construct/query/parser/quad-store adapters | Insert/delete counts, target graph, operation log | Throws stable adapter/unsupported-shape errors | Side effects isolated to injected quad-store callbacks | Promote as `applySparqlUpdateToQuadStore` |

## Canonical Package Structure

Implemented in OntoEagle:

```text
docs/app/shared/sparql-utils/
  index.js
  prologue.js
  lexical-scan.js
  query-kind.js
  iri-rewrite.js
  query-patterns.js
  update-patterns.js
  update-materialization.js
monorepo-staging/packages/sparql-utils/src/
  index.js
  prologue.js
  lexical-scan.js
  query-kind.js
  iri-rewrite.js
  query-patterns.js
  update-patterns.js
  update-materialization.js
tests/
  sparql-utils.test.js
monorepo-staging/packages/sparql-utils/__tests__/
  sparql-utils.test.js
```

## Promoted Functions

### `extractSparqlPrologueDeclarations(queryText)`

Extracts leading SPARQL `PREFIX` and `BASE` declarations and returns:

```js
{
  ok: true,
  prefixes,
  baseIri,
  prologueText,
  bodyText,
  warnings
}
```

Design decision: `BASE` stays separate from namespace prefixes. Prefix maps reuse the namespace registry normalization rules. SPARQL formatting is a serialization concern, not a second namespace registry.

### `formatSparqlPrefixDeclarations(prefixes)`

Formats a prefix map into sorted SPARQL `PREFIX` declarations.

### `prependSparqlPrologue(queryText, prefixes, options)`

Prepends optional `BASE` and sorted `PREFIX` declarations to SPARQL text.

### `splitSparqlPrologueFromBody(queryText)`

Splits leading prologue lines from the remaining query/update body.

### `stripSparqlLineComments(queryText)`

Removes SPARQL line comments outside strings and IRI references.

### `scanSparqlLexicalTokens(queryText, options)`

Extracts IRI refs and prefixed names while ignoring comments and strings.

### `readBalancedSparqlBraceBlock(queryText, startOffset)`

Reads a balanced SPARQL `{...}` block while ignoring braces inside strings, comments, and IRI references.

### `classifySparqlOperationFamily(queryText)`

Returns `'READ'`, `'UPDATE'`, or `'UNKNOWN'` after removing comments and leading prologue declarations.

### `isSparqlUpdateOperation(queryText)`

Boolean predicate over `classifySparqlOperationFamily`.

### `extractSparqlRewriteTokens(queryText, prefixes)`

Extracts body IRI references and prefixed names as rewrite candidates.

### `buildSparqlRewritePreviewRows(run, mapping)`

Builds app-neutral preview rows for IRI rewrite workflows.

### `rewriteSparqlIris(queryText, prefixes, mapping, options)`

Rewrites SPARQL `PREFIX`, `BASE`, IRI refs, and prefixed names according to an IRI map. Returns rewritten text and an explicit change log.

### `formatSparqlIriToken(iri, prefixes, options)`

Formats an IRI as a SPARQL prefixed name when active prefixes support it, otherwise as `<IRI>`.

### `countAppliedSparqlIriRewrites(rewriteResult)`

Counts applied changes from the rewrite change log.

### `applySparqlUpdateToQuadStore(updateText, adapters, options)`

Applies supported SPARQL UPDATE shapes to a quad store by materializing generated CONSTRUCT previews:

- Runs delete previews through `adapters.runConstructQuery`.
- Parses construct output through `adapters.parseConstructResult`.
- Deletes exact rows through `adapters.deleteQuadRows`.
- Runs insert previews, parses RDF/JS quads, and inserts rows through `adapters.insertQuadRows`.

This function owns the reusable orchestration and row conversion. It does not own Comunica, IndexedDB, DOM, or logging. Those remain adapters.

### `rdfJsQuadsToQuadRows(quads, options)`

Converts RDF/JS quads to the shared quad-row-like shape used by project portfolio stores and Axiolotl's active workspace adapter.

## Error, Warning, And Logging Model

- Pure promoted functions must not log.
- Recoverable issues return warnings.
- Structural failures return `ok:false` only where the caller requested a structural read, such as `readBalancedSparqlBraceBlock`.
- Text classification returns `'UNKNOWN'` rather than throwing.
- Rewrite functions return a change log instead of requiring callers to infer changes by searching output text.
- UPDATE materialization throws when required adapters are missing or when the UPDATE shape is unsupported. This prevents silent no-op update execution.

## Namespace And Prefix Decision

Ontology/RDF prefixes and SPARQL prefixes must share the same canonical namespace registry. SPARQL utilities should format namespace-registry prefix maps as `PREFIX p: <iri>` declarations, but should not define a parallel prefix list.

`BASE` remains SPARQL-specific because it controls relative IRI resolution. It is not a namespace prefix and should not be stored in the namespace registry as one.

## Jest Coverage Added

Added `tests/sparql-utils.test.js` covering:

- `BASE` extraction separated from prefix maps.
- Sorted prefix declaration formatting.
- Prologue/body splitting.
- Lexical scanning that ignores comments and strings.
- Comment stripping with hash fragments preserved.
- Balanced brace reading with braces inside strings ignored.
- READ/UPDATE/UNKNOWN classification.
- Rewrite token extraction excluding prefix declarations.
- Preview row generation.
- Rewrite of prefix declarations, IRI refs, and prefixed names.
- Change-log-based applied count.
- SPARQL IRI token formatting.
- SPARQL UPDATE materialization through injected quad-store adapters.
- RDF/JS quad-to-quad-row conversion preserving literal values, language, datatype, and graph.

## Conditional App Adoption Plan

### IRI Swapper

Replace `sparql-iri-swapper-core.js` local helpers:

- `parsePrefixesAndBase` -> `extractSparqlPrologueDeclarations`
- `extractSparqlIriTokens` -> `extractSparqlRewriteTokens`
- `buildSparqlIriPreviewRows` -> `buildSparqlRewritePreviewRows`
- `rewriteSparqlQuery` -> `rewriteSparqlIris`
- `countSparqlAppliedChanges` -> `countAppliedSparqlIriRewrites`
- private `scanSparql`, `rewriteBody`, `chooseQNameOrIri` -> deleted after rewiring

Expected app change: output-run metadata can use the rewrite result's `changes` array instead of inferring applied changes from output text.

### Axiolotl

Replace:

- `splitSparqlPrologue` -> `splitSparqlPrologueFromBody`
- `stripSparqlComments` -> `stripSparqlLineComments`
- `readBraceBlock` -> `readBalancedSparqlBraceBlock`
- `getQueryKind` -> `classifySparqlOperationFamily`
- `isUpdateQuery` -> `isSparqlUpdateOperation`
- `buildQuery` and `commonSPARQLPrefixes` -> namespace-registry prefix map plus `prependSparqlPrologue` or `formatSparqlPrefixDeclarations`
- UI-local `commitUpdateByMaterialization` internals -> `applySparqlUpdateToQuadStore` with Axiolotl adapters for `runConstructPreview`, `parseRdfTextWithAdapters`, `deleteExactTriples`, and `stashGraphToIndexedDB`
- no-op `applyUpdateWithComunica` -> deleted

Keep for later adapter pass:

- `queryAllNamedGraphs`
- `queryFromNamedGraph`
- `runQueryOnLocalDataset`
- `runQueryOnEndpoint`
- `runConstructPreview`
- Remote endpoint update execution

Expected app change: query operation branching and supported local UPDATE materialization become package-driven. IndexedDB workspace and Comunica execution objects remain app adapters.

### OCM

Keep diagnostic polarity functions app-local:

- `getSelectStatusFromPolarity`
- `getAskStatusFromPolarity`

Consider later promotion for:

- `createComunicaEngine`
- `getComunicaEngine`
- `collectBindingsStream`
- `runSelect`
- `runAsk`

Expected app change: none in the first text-utils rollout unless OCM adds editable/query-rewrite UI. Execution adapters should be compared against Axiolotl in a later pass.

### SPARQL Pattern Visualizer

Keep visualization model local for now:

- `buildGraphModel`
- `classifyEdge`
- `termLabel`
- rendering/UI functions

Consider later SPARQL.js adapter promotion:

- `parseSparqlToAst`
- `extractReturnedVariableKeys`
- `flattenWhereTriples`
- `termKey`

Expected app change: none in the first rollout. Do not merge graph visualization into low-level SPARQL text utilities.

### TOM, Table Nova, Visual Lynx, Ontology Tabulator

No active app-local SPARQL utility implementations were found during inventory. No rewiring is required unless these apps add query editing, query artifact storage, or SPARQL-based extraction later.

## Follow-On Work

1. Rewire IRI Swapper first because it has the direct SPARQL rewrite workflow.
2. Rewire Axiolotl's text-level helpers second, leaving Comunica execution intact.
3. Add adapter proposal for Comunica execution after text utilities are adopted.
4. Add adapter proposal for SPARQL.js parsing after deciding what belongs to SPARQL utilities versus visualization utilities.
5. Delete local duplicates immediately after each app is rewired and manually validated.
