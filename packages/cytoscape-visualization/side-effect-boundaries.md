# Side-Effect Boundaries

- **Boundary date:** 2026-08-15

## Pure

- `createGraphTermId`
- `createGraphEdgeId`
- `createDefaultGraphUiState`
- `createGraphState`
- `classifyNodeKind`
- `projectRdfToGraphState`
- `projectSparqlGraphModelToGraphState`
- `buildLabelIndex`
- `buildNodePropertyIndex`
- `buildInspectorViewModel`
- `projectGraphStateToCytoscapeElements`
- `createDefaultCytoscapeStylesheet`
- `createCytoscapeLayoutOptions`
- `calculateVisibleGraphElementIds`
- `updateGraphVisibilityFilters`
- `updateGraphElementSelection`
- `hideSelectedGraphElements`
- `restoreHiddenGraphElements`
- `pinGraphNodePosition`
- `calculateNeighborNudgePositions`

## Browser Adapter

- Visual Lynx and SPARQL Pattern Visualizer page controllers read files or textareas, call parser packages, create Cytoscape instances, register events, run layouts, copy text, and render inspector/status controls.
- Browser adapters may pass plain element/style/layout JSON from this package into Cytoscape, but they must not infer RDF or SPARQL semantics from the live canvas.

## Explicit Boundary

Cytoscape canvas state is never read to infer RDF state. User actions must update graph/RDF state first, then reconcile Cytoscape.

The shared package source must remain free of DOM, storage, file picker, download, network, logging, and live Cytoscape side effects. RDF parsing belongs to `rdf-io`; SPARQL parsing and graph-model extraction belong to `sparql-utils`.
