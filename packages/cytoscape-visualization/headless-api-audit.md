# Headless API Audit

## Capability Family

- **Capability family:** RDF/SPARQL visualization in Cytoscape
- **Audit step:** 18.12
- **Date updated:** 2026-08-15

## Audit Conclusion

The `cytoscape-visualization` package exposes a stable, headless API for read-only graph projection and renderer adapter preparation. It accepts RDF/JS quads or SPARQL graph models and returns renderer-neutral `GraphState`, Cytoscape element JSON, stylesheet descriptors, layout option descriptors, filter view models, inspector view models, and interaction-state updates.

The package does not parse RDF, parse SPARQL text, read files, query IndexedDB, mutate the DOM, instantiate Cytoscape, register browser event listeners, or write downloads. Those operations belong to browser adapters and upstream packages.

## Stable Public API Groups

| API group | Representative exports | Boundary category | Side effects | Headless status |
| --- | --- | --- | --- | --- |
| Stable graph IDs | `createGraphTermId`, `createGraphEdgeId` | Pure core | None | Stable |
| Graph state | `createDefaultGraphUiState`, `createGraphState` | Pure core | None | Stable |
| Ontology classification | `classifyOntologyNode`, `isAxiomSupportNode`, `isRenderedPredicate` | Pure semantic projection | None | Stable |
| RDF projection | `createRdfGraphProjectionPolicy`, `projectRdfToGraphState`, `shouldProjectRdfTermToGraph`, `classifyNodeKind` | Pure projection | None | Stable |
| SPARQL projection | `projectSparqlGraphModelToGraphState`, `classifySparqlGraphNodeKind`, `classifySparqlGraphEdgeKind` | Pure projection | None | Stable |
| Label/property indexes | `buildLabelIndex`, `buildNodePropertyIndex`, `buildInspectorViewModel` | Pure view-model construction | None | Stable |
| Cytoscape element projection | `projectGraphStateToCytoscapeElements`, `buildEdgeRoutingIndex`, `estimateNodeVisualDimensions` | Pure renderer adapter data | None | Stable |
| Cytoscape styling | `CYTOSCAPE_VISUAL_STYLE`, `createDefaultCytoscapeStylesheet` | Pure renderer adapter data | None | Stable |
| Layout descriptors | `CYTOSCAPE_LAYOUT_PRESETS`, `createCytoscapeLayoutOptions`, `getCytoscapeLayoutPreset`, `listCytoscapeLayoutOptions` | Pure renderer adapter data | None | Stable |
| Filtering/visibility | `buildGraphFilterOptionIndex`, `buildGraphFilterPanelViewModel`, `calculateVisibleGraphElementIds`, `selectGraphElementIds`, `updateGraphVisibilityFilters` | Pure view-model and reducer functions | None | Stable |
| Interaction state | `clearGraphElementSelection`, `createGraphElementCopyPayload`, `hideSelectedGraphElements`, `pinGraphNodePosition`, `restoreHiddenGraphElements`, `setGraphInspectorTarget`, `updateGraphElementSelection` | Pure reducer and copy-payload helpers | None | Stable |
| Drag helpers | `getFirstDegreeNeighborNodeIds`, `calculateNeighborNudgePositions` | Pure geometry helpers | None | Stable |

## Input Contract

- RDF visualization starts from RDF/JS quads supplied by `rdf-io` or an app adapter.
- SPARQL visualization starts from the SPARQL graph model supplied by `sparql-utils`.
- Namespace semantics must be expressed through full IRIs from the namespace registry, not local duplicated constants.
- Focus-node filtering accepts a full IRI string.
- Projection options are explicit booleans and small policy objects, for example blank-node, axiom-support, literal-node, `rdf:type` edge, and focus behavior.
- Live Cytoscape objects, DOM nodes, files, URLs, IndexedDB records, and browser events are not valid core inputs.

## Output Contract

- `GraphState` is the canonical read-only semantic visualization state.
- Cytoscape exports are plain element/style/layout JSON that a renderer adapter may pass to Cytoscape.
- Inspector, filter, selection, hidden-state, copy, and drag helpers return plain data or updated immutable-ish state objects.
- Source RDF terms, source quads, graph identifiers, and SPARQL graph-model identifiers remain attached where useful for inspector and copy behavior.
- No function renders, downloads, logs, saves, or mutates source RDF/SPARQL data.

## Side-Effect Boundary Rules

- The package may project, classify, index, filter, size, route, and style graph data.
- The package must not instantiate `cytoscape()`, touch `window` or `document`, register `addEventListener`, read files, parse RDF/SPARQL text, query storage, or emit user notifications.
- Browser pages may instantiate Cytoscape, wire DOM controls, apply layouts, register selection/drag handlers, copy text to clipboard, and render inspector panels as adapters over returned package data.
- RDF parsing remains in `rdf-io`.
- SPARQL parsing and graph-model extraction remain in `sparql-utils`.
- Editing RDF, editing SPARQL, RDF-to-SPARQL abstraction, and observed schema/pattern generation remain deferred to the RDF/SPARQL authoring-app plan.

## Error And Diagnostic Model

The current public functions are deterministic projection helpers and reducers. They should avoid throwing for ordinary graph content such as unknown node kinds, unknown predicates, blank nodes, language-tagged literals, typed literals, named graphs, self-loops, parallel edges, or SPARQL path predicates.

Programmer/configuration errors may throw only when an input contract is materially violated. Future renderer adapters should convert Cytoscape runtime failures into structured diagnostics outside this package.

## Headless Coverage

The package has Jest coverage for:

- Stable RDF term IDs and edge IDs.
- RDF projection of ontology classes, labels, literals, object-property edges, datatype-property literal nodes, named graphs, blank nodes, and duplicate terms.
- Projection-time exclusion of blank nodes and axiom-support nodes without loss of source quads.
- Ontology node classification precedence and OWL restriction/axiom-support handling.
- Label precedence, repeated annotations, language-tagged literals, typed literals, and grouped inspector rows.
- Cytoscape element JSON with RDF terms, semantic kinds, visual dimensions, predicate labels, parallel edge routing, and self-loops.
- Shared Cytoscape stylesheet descriptors for ontology graph categories, directed edges, hover, and selected states.
- Layout preset registry and deterministic layout option generation.
- Filter option indexes, visibility calculations, reset/show-all filter patches, and visible/hidden counts.
- Selection, hiding/restoring, pinned positions, inspector target state, copy payloads, and neighbor-drag calculations.
- SPARQL graph model projection for SELECT variables, class/type heuristics, datatype-property edges, and property-path edges.

## Remaining Work

This audit closes the 18.12 headless API step for read-only RDF/SPARQL visualization. Remaining work belongs to later adapter/product passes:

- Browser app adapter audit: confirm Visual Lynx and SPARQL Pattern Visualizer call this package rather than local projection/style/layout copies.
- Performance tuning: measure parse, projection, Cytoscape construction, and layout time separately for large ontologies.
- Visual polish: continue layout and label-overlap tuning without changing the semantic projection contract.
- Optional future renderer adapters: PNG/SVG export, headless screenshot generation, or alternate renderers should consume the same `GraphState`.

## Maturity Rating

- **Headless projection API maturity:** Level 5 for the read-only RDF/SPARQL projection and renderer-data boundary.
- **Browser renderer maturity:** Level 4 because manual visual tuning and performance work remain iterative.
- **Authoring/editing maturity:** Out of scope for this visualization package.

