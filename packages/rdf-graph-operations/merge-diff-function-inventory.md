# Onto-Merge and Onto-Diff Function Inventory

## Scope

This inventory compares reusable functions originating in:

- Onto-Merge: `D:/GitHub/onto-merge/docs/app/merge-ontology.js`
- Onto-Diff: `D:/GitHub/ontology-diff/src/diff-engine.js`

Browser event handlers, DOM renderers, downloads, status messages, and functions
copied from existing ReasonLynx packages are not promotion candidates. They are
listed only when necessary to explain a core/adaptor boundary.

The review compared candidates with the existing ReasonLynx packages for RDF
I/O, ontology metadata, ontology utilities, namespace management, report export,
browser file I/O, and storage. Promoted code reuses canonical full IRIs from the
namespace registry; it does not introduce local namespace aliases.

## Maturity rubric

| Level | Meaning |
| --- | --- |
| 0 | Local only: app-specific, unclear, or coupled to DOM/storage. |
| 1 | Candidate: potentially reusable but under-specified or partially coupled. |
| 2 | Characterized: representative behavior and limitations are documented or tested. |
| 3 | Reusable: pure or mostly pure, action-oriented name, JSDoc, and focused tests. |
| 4 | Package ready: runtime-neutral, predictable validation/errors, and adapter separation. |
| 5 | Canonical: adopted by every intended consumer and local duplicates removed. |

Level 5 is not available to newly extracted functions. Copying a function into
`packages/` does not make it canonical; Onto-Merge must adopt the package and
delete its local implementation before that rating is warranted.

## Onto-Merge candidates

| Source function | Capability | Novel/useful? | Source maturity | Disposition and gap |
| --- | --- | --- | ---: | --- |
| `createOntologySource` | Normalize parsed RDF into a merge-planning source | Yes, as a composition over existing RDF and ontology-metadata packages | 4 | Promoted as `createOntologyMergeSource`. The SDK version adds explicit validation and reuses `readOntologyMetadataRecordFromQuads`. |
| `getOntologyIriFromQuads` | Find the first `owl:Ontology` subject | No independent promotion | 3 | Already covered by `readOntologyMetadataRecordFromQuads` and `deriveOntologyImportTarget`; promoting it would duplicate ontology metadata behavior. |
| `findOntologyImports` | List direct `owl:imports` targets | No independent promotion | 3 | Already represented in the canonical ontology metadata record under the full `owl:imports` IRI. |
| `createImportDecisionRows` | Plan merge/import/ignore decisions for direct imports | Yes | 4 | Promoted as `createOntologyImportDecisionRows`, with explicit input validation, frozen results, and canonical action constants. |
| `buildMergedOntologyQuads` | Merge selected source quads and rewrite import/header behavior | Yes | 3 | Not promoted. It traverses only imports declared by root sources, does not define transitive/cyclic import behavior, and needs explicit ontology-header, named-graph, blank-node, and provenance policies. |
| `buildMergedPrefixMap` | Combine parser prefix maps for output | Potentially | 2 | Not promoted. Prefix collision precedence is silent, well-known aliases are locally re-declared, and output should use namespace-registry normalization and serializer-specific prefix selection. |
| `buildTurtleHeaderTemplate` | Generate editable ontology header Turtle | Potentially | 2 | Not promoted. It manually assembles RDF syntax, accepts an opaque annotation string, and bypasses ontology-metadata writers and RDF serializers. Define a metadata-record contract first. |
| `composeMergedOntologyText` | Join editable Turtle header and serialized body | Narrowly useful | 2 | Not promoted. Prefix removal is line-based and Turtle-specific; parsed datasets should be combined before serialization. |
| `createMergedOntologyFilename` | Derive a filename from an ontology IRI | Useful but not novel | 2 | Not promoted. Consolidate with browser-file-io/normalization filename policy instead of creating an ontology-specific filename sanitizer. |
| `dedupeQuads`, `quadKey`, `termKey` | RDF quad equality and deduplication | Yes, internally | 2 | Not promoted. Define equality for RDF/JS terms, RDF-star terms, literals, and graphs, then characterize against a standards-oriented fixture set. |

### Onto-Merge adapter-only functions

`loadSelectedOntologies`, `buildMergedFile`, `renderSources`,
`renderImportDecisions`, `refreshHeaderText`, `setStatus`, and the DOM helpers in
`main.js` remain browser-adapter behavior. MIME detection, parsing,
serialization, downloading, and HTML escaping already have shared package
homes and are not novel Onto-Merge SDK candidates.

## Onto-Diff candidates

| Source function | Capability | Novel/useful? | Source maturity | Gap before package promotion |
| --- | --- | --- | ---: | --- |
| `termToDisplay` | Render an RDF term for reports/tables | Yes | 2 | Add JSDoc and focused tests; define Variable, DefaultGraph, RDF-star, invalid-term, Unicode, and escaping behavior. Decide whether this belongs in RDF I/O or report projection. |
| `tripleKey` | Create a comparison key for a triple | Yes | 2 | Define graph-aware RDF/JS equality and collision guarantees; current behavior intentionally omits graph identity. |
| `compareTriples` | Compute unchanged, added, removed, and inferred modifications | Yes, high value | 2 | Blank-node subgraphs are mostly ignored, named graphs are rejected, modification detection is heuristic, and the public contract lacks JSDoc/structured diagnostics. Characterize false-positive and false-negative cases before promotion. |
| `projectOwlRestrictions` | Project selected blank-node OWL restrictions into comparable synthetic triples | Yes | 2 | Supports only a fixed facet subset and one anchor shape. Define supported OWL constructs, nested restrictions, lists, equivalent classes, multiple anchors, and stable projection identifiers. |
| `detectModifications` | Pair removals/additions as subject, predicate, or object changes | Yes | 2 | Heuristics require confidence/ambiguity diagnostics and fixtures for repeated annotations, symmetric structures, multi-valued properties, and coincidental signatures. |
| `createCombinedRows` | Project a diff into one tabular report | Yes, but presentation-oriented | 2 | Move behind a report/view adapter after the semantic diff contract stabilizes; current fields are coupled to the present table. |
| `createSideRows` | Project triples into display rows | Narrowly useful | 2 | Same report-adapter concern; reuse the future canonical RDF-term display formatter. |
| `createSparqlUpdate` | Generate a SPARQL Update reproducing the right graph | Yes, high value | 2 | Blank-node deletes may create broad variable matches, named graphs are unsupported, IRI/literal escaping needs standards fixtures, and safe refusal/diagnostic behavior is absent. |
| `uniqueTriples` | Deduplicate and normalize default-graph triples | Yes, internally | 2 | Generalize to quads or make default-graph scope explicit; replace rejection-only behavior with structured diagnostics. |
| `tripleToSparql`, `termToSparql`, `escapeLiteral` | Serialize diff terms into SPARQL patterns | Yes, internally | 2 | Prefer a SPARQL AST/serializer boundary or comprehensive SPARQL escaping tests before exposing these helpers. |

### Onto-Diff adapter-only functions

Drop-zone setup, file reading, Tabulator rendering, filters, file swapping,
downloads, and message updates in `src/app.js` are browser adapters. Report
HTML/YAML and browser downloads already reuse ReasonLynx packages and are not
novel Onto-Diff functions.

## Promoted Level-4 API

The following functions are now exported by
`@reasonlynx/rdf-graph-operations`:

```js
createOntologyMergeSource(input)
createOntologyImportDecisionRows(sources, actionsByIri)
ONTOLOGY_IMPORT_ACTIONS
```

They are runtime-neutral, deterministic for a given input order, use explicit
inputs and returned values, contain no browser/storage side effects, use full
IRIs through the namespace registry, and have focused package tests.

Their current rating is Level 4, not Level 5, because Onto-Merge has not yet
been rewired to consume the ReasonLynx package and delete the local functions.

## Recommended priorities for the maturity gaps

1. **Ontology merge execution:** specify recursive import closure, cycles,
   missing imports, ontology-header retention/replacement, graph scope,
   blank-node handling, and provenance; then promote the merge operation.
2. **Semantic RDF diff contract:** decide whether blank nodes are canonicalized,
   structurally compared, or explicitly excluded with diagnostics; add named
   graph support and ambiguity/confidence reporting.
3. **SPARQL Update generation:** introduce safe blank-node deletion policy and
   standards-based serialization fixtures before treating updates as executable
   artifacts rather than previews.
4. **Ontology header generation:** replace editable raw Turtle composition with
   a canonical ontology metadata record plus RDF serialization.
5. **Report projections:** promote combined/side table rows only after the
   semantic diff result shape is stable.

## Adoption required for Level 5

- Rewire Onto-Merge to import the two promoted functions from the shared SDK.
- Delete `createOntologySource`, `createImportDecisionRows`, and their private
  duplicate planning helpers from Onto-Merge.
- Keep adapter tests in Onto-Merge and package behavior tests in ReasonLynx.
- Verify both standalone Onto-Merge and the integrated ReasonLynx build.
