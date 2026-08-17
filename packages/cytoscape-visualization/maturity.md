# Maturity Assessment

- **Capability family:** Visualization of RDF in Cytoscape
- **Current maturity:** Level 5 for the read-only RDF/SPARQL headless projection API; Level 4 for browser renderer tuning; authoring/editing capabilities are explicitly deferred.

|Layer|Maturity|Reason|
|:---|:---:|:---|
|D3 baseline behavior|3|Usable baseline exists in Visual Lynx, but it is renderer-specific.|
|GraphState ID helpers|4|Pure, deterministic, tested.|
|Ontology classification|4|Pure, deterministic, tested for `rdf:type` metadata policy, precedence, unknown resources, OWL restriction/axiom support blank nodes, and anonymous `owl:Class` blank nodes that should not render as ordinary named classes.|
|Label and property indexes|4|Pure, deterministic, tested for label precedence, repeated annotations, language-tagged literals, typed literals, and grouped inspector rows.|
|RDF-to-GraphState projection|4|Pure, deterministic, tested for named nodes, literals, blank nodes, duplicate IDs, named graphs, projection-time exclusion of blank-node/axiom-support structures, Phase 2 ontology classification, and Phase 3 labels/properties. Source quads remain attached to GraphState even when nodes/edges are excluded from the Cytoscape projection.|
|Cytoscape element projection|4|Pure and tested for visible nodes, rendered predicate edges, RDF term preservation, predicate-label edge labels, parallel edges, self-loops, literal-node mode, and debug `rdf:type` edges.|
|Visual styling parity|4|Shared stylesheet is data-driven by node/edge kind and tested for semantic node categories, directed readable edge labels, datatype edge styling, hover selectors, and selected states.|
|Layout and edge deconfliction|3|Layout preset registry, deterministic edge routing metadata, and dampened neighbor-drag helpers are implemented and tested. Browser controls expose overview/wide/readable/compact/grid/hierarchy relayout, fit, and optional neighbor nudging. Screenshot comparison and real performance benchmarks remain manual deliverables.|
|Filtering and visibility|4|Filter option indexes, visibility calculation, filter state updates, filter panel view model, and single/Ctrl/Shift selection helpers are implemented and tested. Browser page exposes blank-node, axiom-support, kind, predicate, subject, object, reset, show-all, and visible/hidden count controls.|
|Selection, dragging, hiding, and inspector|4|Selection reducers, clear-selection, hide selected, restore hidden, pinned node positions, inspector target state, copy payloads, and neighbor-drag helpers are implemented and tested. Browser page wires node/edge selection, modifier-aware selection state, hiding/restoring, drag position pinning, inspector rows, and copy buttons.|
|SPARQL visualization reuse|4|`projectSparqlGraphModelToGraphState` projects read-only `sparql-utils` graph models into the shared GraphState contract. Tests cover SELECT variables, class/type heuristics, datatype-property edges, and property-path edges. SPV now uses shared Cytoscape projection, styling, and layout helpers instead of local element/style functions.|
|Headless API boundary|5|`headless-api-audit.md` documents the public projection, GraphState, Cytoscape element/style/layout descriptor, filter, inspector, selection, and drag-helper surfaces. Source scan found no DOM, storage, file picker, download, network, logging, or live Cytoscape side effects in shared package source.|
|Browser Cytoscape app|3|Parallel page exists for manual comparison and exposes Phase 2 projection controls, Phase 3 grouped inspector rows, Phase 5 hover styling, Phase 6 layout controls, Phase 7 filter controls, and Phase 8 selection/hide/restore/copy interactions. RDF editing, SPARQL editing, RDF-to-SPARQL abstraction, and observed-pattern generation are intentionally deferred to the authoring-app plan.|

## Scope Boundary

Visualization remains read-only with respect to semantic source data. The package may preserve source RDF terms, source quads, SPARQL graph-model terms, selected IDs, hidden IDs, layout state, and inspector targets, but it should not own RDF mutation, SPARQL mutation, or observed-schema derivation.

Deferred capabilities are tracked in `monorepo-staging/rdf-sparql-authoring-app.md`.

## Completion Note

The portfolio checklist items "Visualization of RDF in Cytoscape" and "Visualization of SPARQL in Cytoscape" are complete for the current milestone scope:

1. RDF datasets project into shared `GraphState` and Cytoscape element JSON.
2. SPARQL graph models from `sparql-utils` project into the same `GraphState` and renderer contract.
3. Shared styles, layout presets, filtering, selection, dragging, hiding, inspector, copy payload, and projection-fidelity helpers are covered by Jest.
4. Visual Lynx has a parallel Cytoscape RDF page for manual comparison.
5. SPARQL Pattern Visualizer uses the shared Cytoscape projection, styling, and layout helpers.

Remaining visualization tuning, such as layout performance, node overlap, and visual polish, should be treated as iterative improvement rather than a blocker for milestone completion.

## Headless Boundary Note

Step 18.12 is complete for read-only RDF/SPARQL visualization. The shared package returns data: `GraphState`, Cytoscape element JSON, stylesheet descriptors, layout descriptors, filter view models, inspector view models, copy payloads, and updated UI state. Browser adapters own file/text input, RDF/SPARQL parsing orchestration, live Cytoscape construction, DOM events, clipboard access, status rendering, and screenshots.

## Performance Note

Manual testing with the merged Common Core Ontologies Turtle file produced about 2,624 nodes and 3,194 edges, but Cytoscape rendering took roughly 2.5 minutes. D3 reportedly handled comparable input in about 10-15 seconds. This is not acceptable for the target experience. Likely causes to investigate in a later phase include `cose` layout cost, label-sized node measurement, edge label rendering, full graph rendering without focus/windowing, and repeated destroy/recreate cycles.

Phase 6 added layout presets so manual testing can compare `overview`, `wide`, `readable`, `compact`, `grid`, and `hierarchy`. `overview` and `readable` now use stronger repulsion, longer ideal edges, lower gravity, and component spacing because hub-heavy graphs were still collapsing into a narrow vertical band despite available horizontal canvas space. The next performance checkpoint should record parse time, projection time, Cytoscape construction time, and layout time separately; otherwise the bottleneck will remain ambiguous.
