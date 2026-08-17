# Function Inventory

## Capability Family

- **Capability family:** Visualization of RDF in Cytoscape
- **Survey date:** 2026-08-12
- **Survey owner:** Codex
- **Apps surveyed:** Visual Lynx primary implementation; SPARQL Pattern Visualizer and Axiolotl noted for later SPARQL/Cytoscape reuse.
- **Apps with no relevant implementation:** Most repositories do not currently implement RDF visualization in Cytoscape.

## Inventory Table

|ID|App|File|Function|Purpose|Inputs|Outputs|Sync/async|Dependencies|Known callers|Side effects|Browser assumptions|DOM assumptions|Storage assumptions|Supported formats|Tests|Docs|Equivalent candidates|Maturity|Location notes|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---:|:---|
|CYTO-001|Visual Lynx|`docs/app/jsonld-visualizer-loader.js` / D3 stack|D3 RDF graph loader/render path|Existing RDF visualization baseline.|RDF/JSON-LD input after loader conversion.|D3-rendered graph.|Async.|D3, RDF parser adapters.|Visual Lynx `index.html`.|DOM/SVG mutation.|Browser DOM.|Reads textarea and SVG state.|None.|RDF via existing parser stack.|Existing core tests partially cover D3 graph projection.|Some comments.|CYTO-002.|3|Baseline for visual parity; not edited in this cycle.|
|CYTO-002|Visual Lynx parallel page|`docs/app/shared/cytoscape-visualization/*`|`projectRdfToGraphState`, `projectGraphStateToCytoscapeElements`|Renderer-independent graph state and Cytoscape projection.|RDF/JS quads.|GraphState and Cytoscape element JSON.|Sync.|Namespace registry only for pure helpers.|New `visual-lynx-cytoscape.html` controller.|None in pure helpers.|None in pure helpers.|None in pure helpers.|None.|RDF/JS quads from shared rdf-io.|New Jest tests.|This package docs and `visualization.md`.|CYTO-001.|4|Phase 1 implementation.|

## Candidate Groups

|Group ID|Candidate IDs|Shared behavior|Known differences|Likely package boundary|Notes|
|:---|:---|:---|:---|:---|:---|
|GRP-001|CYTO-001, CYTO-002|RDF graph input becomes visual node/edge graph.|D3 path couples projection/rendering more tightly; Cytoscape path separates graph state from renderer.|`cytoscape-visualization` pure graph-state and projection helpers.|Build parallel page for apples-to-apples comparison before replacing D3.|

## Survey Notes

- This cycle intentionally starts with Visual Lynx rather than pretending every repo has RDF visualization to inventory.
- Cytoscape is already available locally under `docs/app/shared/vendor/cytoscape.min.js`.
- Phase 1 is transient graph state, not a persisted semantic data model.
