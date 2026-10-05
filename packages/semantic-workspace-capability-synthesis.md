# Semantic Workspace Capability Synthesis

**Synthesis date:** 2026-10-05  
**Status:** Architecture baseline derived from the existing capability inventories

## Purpose

This document synthesizes the existing ReasonLynx capability inventories into one artifact-, operation-, representation-, and view-oriented model.

It does **not** treat the named applications as hard integration boundaries. OntoEagle, CQ Ferret, TOM, Axiolotl, Visual Lynx, and the other tools are compositions of reusable semantic capabilities presented through different views. In a unified deployment, moving between them can be equivalent to changing views over the same project artifacts.

The synthesis answers four questions:

1. What semantic content exists in the workspace?
2. Which portable representations are available for that content?
3. Which operations can be performed on it?
4. Which view or views can present each operation?

## Evidence base

The detailed evidence remains in the existing inventories. Candidate IDs below refer to their rows and groups.

| Inventory | Principal evidence | Survey coverage |
|:---|:---|:---|
| [Browser File I/O](./browser-file-io/inventory.md) | File reads, binary reads, download side effects, file-input accept construction | OntoEagle, CQ Ferret, TOM, Axiolotl, Graph Analytics, Linked-Data Transformer, OCD, Ontology Tabulator, Myna, Table Nova, DocxHund |
| [Format Registry](./format-registry/inventory.md) | MIME/extension recognition and supported conversion declarations | OntoEagle, TOM, Axiolotl, Graph Analytics, Linked-Data Transformer, OCD, Ontology Tabulator, Myna, Table Nova |
| [RDF I/O](./rdf-io/inventory.md) | RDF parsing, RDF/JS quads, JSON-LD, Turtle-family formats, RDF/XML, serialization | OntoEagle, TOM, Axiolotl, Linked-Data Transformer, OCD, Ontology Tabulator, Myna, Table Nova |
| [Tabular I/O](./tabular-io/inventory.md) | CSV/TSV/XLSX parsing, serialization, query records, IRI mappings | CQ Ferret, TOM, Axiolotl, OCD, Ontology Tabulator, Myna, Table Nova |
| [Namespace Registry](./namespace-registry/inventory.md) | Canonical namespace maps, compaction, expansion, syntax prefix extraction | OntoEagle, TOM, Axiolotl, Linked-Data Transformer, Visual Lynx, OCD, Ontology Tabulator, Myna, Table Nova, DocxHund |
| [Ontology Utilities](./ontology-utils/inventory.md) | IRI/blank-node validation, RDF term constraints, ontology/datatype utilities, identifier generation | OntoEagle, TOM, Axiolotl, Linked-Data Transformer, OCD, Ontology Tabulator, Myna, Table Nova |
| [Ontology Metadata](./ontology-metadata/inventory.md) | Metadata read/write, import declarations, ontology IRI provisioning, generation metadata | OntoEagle, TOM, Table Nova, OCD, OKEA |
| [SPARQL Utilities](./sparql-utils/inventory.md) | Prologues, parsing, IRI rewriting, execution, update preview, query artifacts | Axiolotl, Myna, SPARQL Pattern Visualizer, OCD, CQ/query-adjacent tools |
| [Report Export](./report-export/inventory.md) | Report models, YAML/HTML/CSV representations, print behavior | OCD, Ontology Tabulator, OntoEagle, Axiolotl |
| [IndexedDB Data Management](./indexeddb-data-management/inventory.md) | Project data, graphs/quads, settings, queries, runs, CQ graphs, diagrams | OntoEagle, CQ Ferret, TOM, Axiolotl, OCD, Myna, Table Nova, Mermaid |
| [Cytoscape Visualization](./cytoscape-visualization/inventory.md) | RDF-to-graph projection and renderer-neutral graph state | Visual Lynx, with reuse targets in SPARQL visualization and Axiolotl |
| [UI Feedback](./ui-feedback/inventory.md) | Status, toast, logging, theme, and workspace-state presentation | All surveyed local views plus Mermaid |
| [Normalization Utilities](./normalization-utils/inventory.md) | Shared normalization primitives | Cross-cutting package evidence |

The inventories are implementation-family surveys, not a complete product-capability catalog. They provide strong evidence for the common mechanisms but incomplete evidence for Knowledge Graph Modeler, Slim Bundle Builder, NLP Quality Assurance, and some newer Graph Analyst/DocxHund behavior. Those gaps are identified below rather than filled by assumption.

## Design invariants

- JSON-LD is a universal semantic interchange representation across the tool suite.
- RDF/JS quads are the canonical in-memory and materialized graph boundary where statement-level operations are required.
- A source file and its decoded semantic content are related representations of an artifact; neither must erase the other.
- CSV, TSV, XLSX, Turtle, TriG, N-Triples, N-Quads, RDF/XML, SPARQL, Mermaid, JSON-LD, HTML, and other declared formats are representations—not application ownership markers.
- Artifact identity, project membership, and provenance survive representation changes and view changes.
- Operations declare accepted semantic inputs and produced semantic outputs independently of the view that presents them.
- Views may maintain disposable render state, indexes, and caches, but not private authoritative copies of project artifacts.
- Namespace and MIME decisions come from the promoted registries. A view must not introduce aliases for well-known namespaces or private format names where registered terms exist.

## Unified model

```text
Project
  └── Artifact
        ├── semantic kind and identity
        ├── zero or more representations
        ├── provenance and derivation links
        └── zero or more available operations
              └── operation execution (Run)
                    ├── input artifact IDs
                    ├── parameters and selected mode
                    ├── output artifact IDs
                    └── view provider used

View provider
  ├── presents one or more operations
  ├── edits shared artifacts or creates derived artifacts
  └── may be switched without moving the artifact
```

### Artifact

An artifact identifies semantic content: an ontology, RDF dataset, competency-question set, term list, table, query, diagram, report, document, mapping, or related information-content entity.

### Representation

A representation describes how the artifact can currently be read or written. One artifact may have several representations at once. For example, a competency-question set may have authoritative JSON-LD, materialized RDF/JS quads, and a generated CSV table.

### Operation

An operation is a user-meaningful verb over semantic content. Examples include “append terms,” “flatten ontology,” “convert table to RDF,” “query graph,” “annotate passage,” “rewrite IRIs,” and “inspect ontology compliance.”

### View provider

A view provider is a UI capable of presenting an operation. “TOM” is therefore the current provider for ontology-table editing operations, not the owner or destination of the term-list data.

## Registry contracts

The current `APP_CAPABILITY_MANIFESTS` is a useful transition mechanism, but `accepts` and `produces` alone are insufficient. The target architecture should use the following registries.

### Representation registry

```js
{
  representationId: 'application/ld+json',
  mediaType: 'application/ld+json',
  extensions: ['jsonld', 'json'],
  semanticFamilies: ['rdf', 'jsonld'],
  decodeCapability: 'rdf.parse',
  encodeCapability: 'rdf.serialize',
  portable: true
}
```

This registry is primarily a synthesis of `format-registry`, `browser-file-io`, `rdf-io`, and `tabular-io`.

### Operation registry

```js
{
  operationId: 'ontology-table.append-terms',
  label: 'Append terms to ontology table',
  accepts: [{ artifactKind: 'term-list' }],
  requires: [{ capability: 'term-list.read' }],
  parameters: [{ name: 'duplicatePolicy', values: ['skip', 'merge', 'add'] }],
  produces: [{ artifactKind: 'ontology-table', relationship: 'updates-or-derives' }],
  modes: ['append'],
  preservesInput: true
}
```

### View-provider registry

```js
{
  viewId: 'ontology-table-editor',
  label: 'Ontology table',
  route: './tabular-ontology-maker/',
  presentsOperations: [
    'ontology-table.append-terms',
    'ontology-table.replace-from-terms',
    'ontology.generate-rdf'
  ]
}
```

### Execution contract

```js
{
  operationId,
  projectId,
  inputArtifactIds,
  targetArtifactId,
  mode,
  parameters,
  preferredViewId
}
```

The execution result records a `Run` and returns updated or created artifact IDs. The operation implementation must not depend on a producer application’s private UI state.

## Representation synthesis

| Representation family | Canonical boundary | Recognized forms | Inventory evidence | Workspace behavior |
|:---|:---|:---|:---|:---|
| RDF graph | RDF/JS quads plus graph identity | JSON-LD, Turtle, TriG, N-Triples, N-Quads, RDF/XML, N3 | RDF-001–RDF-036; FMT RDF groups | Preserve uploaded bytes when useful; decode to quads; expose all supported serializers through one representation menu |
| Ontology | RDF artifact plus ontology metadata profile | Any supported RDF serialization | OMD-001–OMD-009; RDF-005–RDF-014, RDF-037 | Ontology identity and metadata stay with the artifact across tabular, graph, query, and diagnostic views |
| Tabular data | Canonical rows, headers, and schema metadata | CSV, TSV, XLS/XLSX | TAB-001–TAB-018; FMT-003/FMT-019 | Preserve workbook/file representation; operations choose a semantic interpretation instead of assigning ownership to an app |
| Term list | Versioned term-list record set | JSON-LD baseline; JSON/CSV projections | CQ vocabulary candidates IDX-016/017 and TAB-004; TOM table candidates | Can be edited, merged into an ontology table, used for lookup, or serialized without changing owner |
| Query | Query text, language, identifiers, metadata | SPARQL text, JSON-LD, CSV query records | IDX-027; TAB-008; SPARQL-044/045/048 | Can be appended to a CQ, executed, visualized, rewritten, or included in a playbook |
| Mapping | Canonical mapping rows with conflict policy | CSV, TSV, XLSX, JSON-LD | TAB-007, TAB-013–016; SPARQL rewrite evidence | Used by RDF and SPARQL transformations; stored independently of individual runs |
| Diagram/model | Diagram source plus optional semantic model | Mermaid, JSON-LD/RDF, renderer state | Mermaid IDX-032/033; visualization inventory | Diagram source is durable; renderer layout is a representation or disposable view state |
| Report | Canonical report document/model | JSON-LD metadata, HTML, YAML, CSV, print | REP-001–REP-017 | Report is a first-class artifact; download/print are representation actions |
| Document | Original binary plus semantic document model | DOCX, document RDF/JSON-LD, annotations | BFI-027/028; current DocxHund storage | Preserve DOCX; derived document model and annotations remain linked artifacts |
| Visualization state | Renderer-neutral graph state where reusable | JSON/JSON-LD plus SVG/PNG exports where supported | CYTO-001/002 | Semantic graph remains source; transient pan/zoom need not become an artifact unless explicitly saved |

## Operation synthesis

### Universal ingress and egress

| Operation | Inputs | Outputs/effects | Evidence |
|:---|:---|:---|:---|
| Add local file | Browser `File`/`Blob` | Preserved source artifact plus detected representations | BFI-002/003/010/014/018/020/023–027 |
| Recognize representation | File name, MIME, optional content sample | Ranked representation candidates and warnings | Format registry groups; RDF/tabular detection candidates |
| Decode RDF | RDF text/binary representation | RDF/JS quads, prefixes, warnings | RDF-001–RDF-008, RDF-012–RDF-016, RDF-020/024/027–029 |
| Decode table | CSV/TSV text or workbook bytes | Canonical rows, headers, warnings | TAB-003/006/013/015/017 |
| Encode/download representation | Artifact plus selected representation | Download descriptor and browser download | RDF serializer groups, TAB serializer groups, BFI-001/003 group |
| Store without interpreting | Any supported file | Source artifact only | Required fallback; browser-file and artifact-store composition |

The workspace should present these operations once. Individual views should not retain separate generic read/download implementations after their adapters are verified.

### Semantic operations and current view providers

| Operation family | Representative operations | Current view provider(s) | Evidence status |
|:---|:---|:---|:---|
| Semantic lookup and selection | Search ontology terms; select terms; build seed/slim inputs | OntoEagle, Slim Bundle Builder | Direct OntoEagle inventory evidence; Slim workflow partially evidenced through browser/UI inventories |
| Competency-question authoring | Create/edit CQs; associate people, sources, diagrams, and queries | CQ Ferret | Direct tabular/storage/browser evidence plus current shared-workspace implementation |
| Vocabulary extraction | Extract and edit terms from CQ/document/ontology content | CQ Ferret term view; OntoEagle vocabulary surfaces; DocxHund future operation | CQ direct inventory evidence; other provider coverage varies |
| Ontology-to-table projection | Flatten ontology into editable/exportable rows | Ontology Tabulator | Direct RDF, browser, namespace, report-export evidence |
| Ontology-table editing | Append/replace/merge terms; edit classes/properties/individuals | Tabular Ontology Maker | Direct tabular, RDF, ontology metadata, storage evidence |
| Ontology generation | Generate ontology RDF from table/model/schema | TOM, Table Nova, Knowledge Graph Modeler | Direct TOM/Table Nova evidence; Modeler requires targeted inventory |
| Table-to-RDF transformation | Map rows/columns and generate instance RDF/ontology draft | Table Nova, TOM | Direct format/tabular/RDF/metadata evidence |
| Document-to-RDF and annotation | Parse DOCX; construct document RDF; annotate information entities | DocxHund | Browser evidence plus current DocxHund implementation; newer operations need inventory refresh |
| RDF-to-RDF transformation | Parse, convert serialization, transform graph content | Linked-Data Transformer | Direct format/RDF/namespace/browser evidence |
| IRI rewriting | Preview/apply RDF or SPARQL IRI mappings | Myna IRI Swapper | Direct tabular/RDF/SPARQL/namespace evidence |
| Graph storage/query/inference | Load graphs; query; save queries; infer; check workspace | Axiolotl | Strong direct storage, RDF, SPARQL, namespace evidence |
| SPARQL visualization | Parse query AST and project patterns to graph | SPARQL Pattern Visualizer | Strong SPARQL inventory evidence; view-state persistence remains separate |
| RDF visualization | Project RDF to node-edge graph and render | Visual Lynx | Direct Cytoscape/RDF/namespace evidence |
| Graph analytics | Shortest paths, communities, related analyses | Graph Analytics | File/RDF input evidence; analytics algorithms need targeted inventory |
| Query-playbook authoring | Author decision trees of SPARQL execution | Graph Analyst Playbook | Browser export evidence; operation model requires targeted inventory |
| Diagram/model authoring | Model nodes/edges; edit Mermaid; generate semantic outputs | Knowledge Graph Modeler, Mermaid Diagram Builder | Mermaid storage/UI evidence; Modeler requires targeted inventory and origin decision |
| Ontology diagnostics | Inspect compliance; compute measures; propose curation status | Ontology Compliance Diagnostic | Strong RDF, SPARQL, report, tabular, storage evidence |
| Annotation quality assurance | Spelling, grammar, definition-form analysis and correction proposals | NLP Quality Assurance | Current storage checklist evidence; capability inventory refresh required |

## View coverage matrix

Legend:

- **Strong:** directly represented across multiple existing inventory families.
- **Partial:** some mechanisms are inventoried, but the user-meaningful operation needs consolidation or refresh.
- **Gap:** not sufficiently represented in the existing inventory set.

| View composition | Existing inventory coverage | Principal reusable capability families | Coverage |
|:---|:---|:---|:---:|
| OntoEagle Semantic Lookup | File, format, RDF, namespace, metadata, storage, UI, report/table export | RDF decode, ontology projection, search index, selection artifacts | Strong |
| Ontology Tabulator | File, RDF, namespace, tabular export, print/report | RDF decode, ontology-to-table projection, table representation export | Strong |
| Visual Lynx | RDF/namespace behavior and dedicated visualization inventory | RDF decode, graph projection, renderer-neutral state | Strong |
| CQ Ferret | File, tabular, storage, shared workspace bridge | CQ graph editing, term extraction, query/person/source association | Strong |
| Graph Analyst Playbook | Browser JSON export and adjacent SPARQL evidence | Playbook model, query references, execution decision tree | Partial |
| Graph Analytics | File/RDF recognition plus Axiolotl graph-store adjacency | Graph selection, path/community algorithms, result artifacts | Partial |
| Tabular Ontology Maker | File, format, RDF, table, namespace, metadata, storage, UI | Table editing, ontology generation, import/merge | Strong |
| Knowledge Graph Modeler | Indirect RDF/diagram/model requirements | Graph model editing, RDF/seed/Mermaid generation | Gap |
| Mermaid Diagram Builder | Project/artifact storage and UI concepts | Diagram authoring, Mermaid serialization, render/export | Partial |
| Table Nova | File, format, RDF, table, namespace, datatype, metadata, storage, UI | Table decoding, mapping, RDF/ontology generation | Strong |
| DocxHund | Binary file I/O and namespace evidence plus newer project-store implementation | DOCX decode, document model, RDF annotation, KB lookup | Partial |
| Linked-Data Transformer | File, format, RDF, namespace, UI | RDF parse/serialize/transform | Strong |
| Axiolotl | File, format, RDF, table/query records, namespace, SPARQL, storage, UI | Graph store, query, inference, saved-query artifacts | Strong |
| SPARQL Pattern Visualizer | SPARQL parsing/AST and UI evidence | Query decode, graph projection, Mermaid/visual outputs | Strong |
| Slim Bundle Builder | OntoEagle-adjacent file/UI evidence | Term selection, seed building, ontology slimming | Partial |
| Ontology Compliance Diagnostic | File, format, RDF, table, namespace, ontology utilities, SPARQL, reports, storage, UI | Diagnostics, measures, reporting, curation proposals | Strong |
| NLP Quality Assurance | Current shared storage implementation, limited original inventory coverage | NLP checks, definition analysis, correction proposals | Gap |
| Myna IRI Swapper | File, format, RDF, table, namespace, SPARQL, storage, UI | Mapping ingest, RDF/SPARQL rewrite, preview/export | Strong |

## Workspace user experience derived from the synthesis

### Manage Workspace owns durable content

The workspace interface should provide:

- project selection and lifecycle;
- a single add-files flow;
- artifact, dataset, graph, query, diagram, report, and document visibility;
- representation download/export;
- rename, move, duplicate, archive, and delete;
- provenance and operation history;
- operation discovery for selected artifacts.

It should not reproduce every historical app button.

### Adding data is interpretation-neutral first

```text
Add files
  1. Preserve source file as an artifact.
  2. Detect one or more possible representations.
  3. Show available semantic operations.
  4. Ask the user which operation to run when intent is ambiguous.
  5. Open a suitable view provider for the chosen operation.
```

For a CSV file, possible operations might include:

- import competency questions;
- edit as an ontology table;
- map table rows to RDF;
- load an IRI mapping;
- retain as an uninterpreted tabular artifact.

The file is not a “CQ Ferret file” or a “TOM file.” The selected operation determines the semantic interpretation.

### Download is representation negotiation

“Download selected” should inspect the artifact’s existing and derivable representations. A competency-question artifact can offer JSON-LD and CSV from one download action. An RDF artifact can offer the registered RDF serializations. A report can offer HTML, YAML, CSV, or print when those encoders apply.

This makes separate “CQ Ferret JSON-LD download” and “CQ Ferret CSV download” cards redundant.

### Operations use verbs, not application destinations

Prefer:

- Edit as ontology table
- Append terms to current table
- Replace table from term list
- Query this graph
- Visualize relationships
- Inspect ontology compliance
- Rewrite IRIs

Avoid treating application names as data destinations. Navigation to TOM, Axiolotl, or Visual Lynx is selection of a view provider after the semantic operation has been chosen.

### Current-view controls remain contextual

The shared workspace does not need to absorb every editing control. A view retains controls that manipulate the operation currently being presented: table columns, inference settings, annotation types, graph layout, query execution options, and similar contextual state.

The boundary is:

| Shared workspace | Current view |
|:---|:---|
| What durable content exists? | How is the selected operation performed? |
| Which representations can be added or downloaded? | Which operation-specific parameters are editable? |
| Which operations are available for selected artifacts? | How are results previewed and interactively edited? |
| Which artifacts were inputs and outputs? | What transient selection/layout/editor state is active? |

## CQ term-list → ontology-table example

The current behavior—TOM can see the term list but cannot use it—demonstrates why `accepts` is not an operation contract.

```text
Input artifact: CQ Ferret extracted term list
Semantic kind: term-list
Portable representation: versioned JSON/JSON-LD term-list payload

Available operations:
  Preview terms
  Append terms to ontology table
  Replace ontology table from term list
  Compare with ontology table

Current view provider:
  ontology-table-editor (implemented today by TOM)
```

Each modifying operation must state:

- the target table artifact or “create new table”;
- append/replace/merge behavior;
- duplicate resolution;
- mapping from term fields to table columns;
- whether the result updates the target or creates a derived artifact;
- the input/output artifact IDs recorded in the run.

## Implications for current code

The recently introduced `workspaceActions` and `artifactLoadActions` are transitional adapters. They correctly establish that visibility does not equal loading, but they remain attached to application manifests and can duplicate universal download behavior.

They should evolve as follows:

| Transitional field | Target |
|:---|:---|
| `manifest.accepts` | Operation-registry input constraints plus view-provider declarations |
| `manifest.produces` | Operation-registry output declarations |
| `workspaceActions` import/export buttons | Universal ingress and representation-download services |
| `artifactLoadActions` | Semantic operation definitions independent of app identity |
| `appId` destination | `viewId` provider chosen for an operation |

Until that migration is implemented, app-manifest actions must not be multiplied across the modal. Only genuine semantic operations should appear; generic download/upload behavior belongs to the shared workspace.

## Evidence gaps requiring targeted inventory additions

No screenshot-by-screenshot audit is required. The following focused additions are sufficient:

1. **Knowledge Graph Modeler:** model schema, RDF/seed/Mermaid inputs and outputs, persistence, and deployment origin.
2. **Mermaid Diagram Builder:** diagram semantic model versus editor state, render/export representations, and current external-origin constraints.
3. **Graph Analyst Playbook:** decision-tree schema, query references, execution semantics, and import/export forms.
4. **Graph Analytics:** algorithm inputs, parameter models, result schemas, and visualization/report outputs.
5. **Slim Bundle Builder:** term-selection, seed, source ontology, and slim-output operation boundaries.
6. **NLP Quality Assurance:** source ontology contract, check/result schemas, proposed corrections, and revised-artifact behavior.
7. **DocxHund refresh:** DOCX/document-model/annotation operations added after the original file-I/O inventory.

These are capability-family additions. They should use the same inventory fields already established: input contract, output contract, error/warning model, side effects, environment assumptions, dependencies, callers, overlaps, fixtures, and maturity.

## Recommended implementation sequence

1. Promote the representation registry as the single combination of MIME, extension, parser, and serializer facts.
2. Define operation records and execution requests independently of applications.
3. Define view providers and routes separately from operations.
4. Replace app-specific modal import/export cards with universal add/download flows.
5. Make artifact selection resolve applicable operations, not merely compatible applications.
6. Implement the CQ term-list → ontology-table operations as the first append/replace/merge reference case.
7. Implement graph operations next: load/query/visualize/transform over the same RDF artifact.
8. Add the targeted inventory gaps above.
9. Retire transitional app-centric manifest fields only after every current action has an operation/view equivalent and contract tests pass.

## Necessary conformance tests

- Every registered representation has deterministic recognition behavior and at least one round-trip or parse fixture.
- Every operation rejects incompatible semantic inputs before opening a view.
- Every modifying operation declares append/replace/merge/update/derive behavior.
- Every execution records input and output artifact IDs.
- Every view provider can be changed without moving or duplicating authoritative artifacts.
- Universal download lists representations, not producing applications.
- Universal upload can store an uninterpreted source when the user declines all semantic interpretations.
- A producer-specific private UI snapshot is never required to consume the artifact’s principal semantic content.

