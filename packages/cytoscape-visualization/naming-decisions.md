# Naming Decisions

- Use `createGraphTermId` and `createGraphEdgeId` for stable IDs.
- Use `projectRdfToGraphState` for RDF/JS quads to renderer-independent state.
- Use `projectGraphStateToCytoscapeElements` for state-to-renderer element JSON.
- Use `createDefaultCytoscapeStylesheet` for Cytoscape-specific visual style arrays.
- Avoid `renderRdfGraph` for pure helpers because rendering is the impure adapter layer.
