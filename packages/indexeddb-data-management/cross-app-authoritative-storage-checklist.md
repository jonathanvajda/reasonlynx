# Cross-App Authoritative Storage Checklist

**Audit date:** 2026-09-30  
**Target database:** `OntologyWorkbenchProjects`

This checklist distinguishes three things that earlier rollout notes sometimes grouped together:

1. loading the shared storage package;
2. recording a shared run or snapshot;
3. using the shared project portfolio as the authoritative store for user work.

Only the third condition completes the migration. A run record that contains a copy of app-local state is useful provenance, but it is not authoritative shared storage.

## Normative interoperability contract

The following five conditions are the core data-plane contract. They remain necessary. Together with capability discovery and lifecycle behavior in the next section, they are sufficient for an app to publish and consume project artifacts without app-pair-specific integration code.

### 1. Shared origin

Apps that directly share browser storage must run under the same browser origin, for example `https://reasonlynx.com/...`. IndexedDB is origin-scoped: importing a header script from another domain does not grant access to that domain's IndexedDB.

An app on another origin must use an explicit portable export/import or synchronization protocol. It cannot claim direct shared-workspace interoperability merely because it uses the same JavaScript package or database name.

### 2. Shared authoritative database

Every app opens the canonical project portfolio through `openProjectPortfolioDatabase()`. It must not create a private database for ordinary project artifacts or editable project state.

A private database or store is acceptable only for a documented disposable cache, derived index, operational queue, or non-project application state. The app must be able to delete and rebuild a cache without losing user work.

### 3. Shared active project

Every app obtains and changes the same active project selection through the workspace shell contract. It must not silently fall back to an app-specific or hard-coded default project after the user has selected another project.

The app must respond to a project change without mixing records from different projects, and newly created artifacts and runs must carry the selected `projectId`.

### 4. Canonical artifact envelope

Every published artifact uses the shared `ArtifactRecord` contract. At minimum it includes:

```js
{
  artifactId,
  projectId,
  artifactKind,
  role,
  label,
  mediaType,
  extension,
  createdAt,
  updatedAt,
  source,
  storageRef,
  provenance,
  summary
}
```

`source`, `storageRef`, `provenance`, and `summary` may be structured objects or references to normalized shared records. They must not be app-private metadata that other consumers cannot resolve. Provenance includes source artifact IDs and the producing operation/run where applicable. Large graph content may be held in shared `graphs` and `quadRows`; it need not be duplicated inside the envelope.

### 5. Portable payload

The artifact payload is held in a shared location and uses an established interchange representation:

- RDF and ontologies: RDF/JS quads plus a recognized RDF serialization when a file representation is needed;
- tabular data: canonical rows plus CSV, TSV, or XLSX metadata;
- term lists: the shared term-list structure and declared media type;
- queries: SPARQL text;
- diagrams: Mermaid text or another declared format;
- reports and mappings: a registered artifact kind, media type, schema/version, and portable serialized form.

A consumer may use producer-specific metadata as an enhancement, but it must not need to interpret the producer's private UI state to use the artifact's principal content.

### Interoperability decision rule

An app is interoperable only if it satisfies all five core conditions **and**:

- advertises accepted and produced artifact kinds in its capability manifest;
- can discover and open compatible artifacts from the active project;
- records input/output artifact relationships for transformations; and
- implements shared rename/delete/project-change behavior without leaving authoritative orphan records.

This is why “uses the shared package” or “writes a shared run” is not, by itself, a completion criterion.

## Visibility, loading, and management responsibilities

Artifact visibility is not a load instruction. An `accepts: ['term-list']` declaration means only that an app has a potentially compatible destination. It does not answer whether the user wants to append, replace, merge, compare, reference, or merely preview the artifact.

The shared capability contract therefore has two distinct action layers:

- `workspaceActions`: importing a local file into the current app/workspace or exporting app data, with an explicit mode and resulting/source artifact kind;
- `artifactLoadActions`: applying an existing project artifact to a named destination inside the current app, with an explicit `append`, `replace`, `merge`, `reference`, or `open` mode.

The shared **Manage Workspace** interface owns project selection, durable artifact visibility, file ingress/egress, rename/delete/download, and presentation of declared actions. The app remains responsible for interpreting content and applying a selected action to its named app destination. Apps should not retain parallel file-management buttons once their equivalent workspace actions are implemented and verified.

Rules:

- [ ] Never make an artifact row actionable merely because its kind appears in `accepts`.
- [ ] Show the intended verb and destination, such as “Append terms to ontology table,” not a generic “Open.”
- [ ] If multiple valid destinations or modes exist, require the user to choose one.
- [ ] Dispatch the artifact ID and declared action; the receiving app resolves the payload from shared storage.
- [ ] Preserve the source artifact. Loading changes app state or creates a derived artifact; it does not silently consume/delete the source.
- [ ] Keep old app-local import/export controls until their workspace actions pass browser tests, then remove the duplicates.
- [ ] Treat “compatible but no load action implemented” as incomplete integration and say so in the UI.

## Completion criteria for every app

An app is complete only when all applicable conditions below are checked for that app.

- [ ] Its capability manifest declares accepted input kinds, produced output kinds, and whether it can create or edit artifacts.
- [ ] It obtains the active project from the shared workspace shell; it does not hard-code the default project.
- [ ] It reacts to project changes without a page reload.
- [ ] It discovers compatible artifacts in the active project and can open one selected in the workspace manager.
- [ ] User-controlled inputs are artifacts or datasets in `OntologyWorkbenchProjects`, not durable records in an app-owned database.
- [ ] Editable work-in-progress is authoritative in the shared database.
- [ ] Meaningful outputs are stored as artifacts. They are not present only inside a run payload.
- [ ] RDF intended for querying is materialized through shared `graphs` and `quadRows` with links to its artifact and project.
- [ ] Runs identify their input and output artifact IDs and record the producing app and operation.
- [ ] App-owned IndexedDB stores are either removed or explicitly documented and tested as disposable caches.
- [ ] Existing user records can be detected, migrated, counted, verified, and—only after confirmation—deleted from the legacy store.
- [ ] Tests cover reload, project switching, cross-app discovery, rename/delete, migration, and cache rebuilding where applicable.

The checklist uses **Done**, **Partial**, **Missing**, and **Audit** for current code-proven status. “Partial” is deliberately not treated as complete.

## Shared platform work

- [x] **Done:** Shared records exist for projects, artifacts, datasets, graphs, quad rows, workspace inclusions, runs, and settings.
- [x] **Done:** The shared header can display and manage projects and artifacts.
- [x] **Done:** Capability manifests are centrally registered for the locally hosted apps.
- [ ] **Missing:** Make active-project selection a shared API and event contract used by every app, rather than app constants or parallel selectors.
- [ ] **Missing:** Normalize the artifact-kind vocabulary and publish compatibility rules from one registry.
- [ ] **Missing:** Add a standard `open artifact` handler and shared artifact picker API.
- [ ] **Missing:** Add a migration dashboard showing legacy source counts, migrated counts, failures, verification results, and confirmed cleanup.
- [ ] **Missing:** Add a cache registry that identifies owner, rebuild procedure, schema version, and safe-delete behavior for every app-local cache.
- [ ] **Missing:** Add contract tests that pass representative artifacts through producer → workspace → consumer paths.
- [ ] **Missing:** Require same-origin hosting, or define an explicit synchronization protocol, for apps expected to share browser IndexedDB.

## OntoEagle Semantic Lookup

**Expected shared records:** ontology/dataset source artifacts, dataset inclusions, search settings, selected-term or term-list artifacts, bundle handoff artifacts, and search/import runs. Search documents and indexes may remain disposable caches.

- [x] **Done:** A capability manifest is registered.
- [x] **Done:** Search settings have a shared-storage path.
- [~] **Partial:** Imported dataset/document activity is reflected in shared records, but `OntoEagleDB.datasets` and `OntoEagleDB.documents` remain active working stores.
- [ ] **Missing:** Make source dataset and document metadata authoritative in `OntologyWorkbenchProjects`.
- [ ] **Missing:** Classify `OntoEagleDB.index` and any derived document representation as rebuildable caches, with an explicit rebuild command and tests.
- [ ] **Missing:** Replace the hard-coded default project with the shell’s active project.
- [ ] **Missing:** Discover/open compatible ontology, vocabulary, seed, and bundle artifacts.
- [ ] **Missing:** Detect and migrate legacy datasets/settings; compare counts and fingerprints; obtain confirmation before removing durable legacy records.
- [ ] **Missing:** Test reload, project switching, cache deletion/rebuild, and cross-app term-list discovery.

## Ontology Tabulator

**Expected shared records:** source ontology artifacts and flattened ontology-table/term-list artifacts, with an import/transformation run linking them.

- [x] **Done:** A capability manifest is registered.
- [x] **Done:** No app-owned durable database was found in the focused audit.
- [ ] **Missing:** Open compatible ontology artifacts from the active project as well as local files.
- [ ] **Missing:** Save imported ontologies and flattened tables as shared artifacts.
- [ ] **Missing:** Record source → flattened-table derivation in a run.
- [ ] **Missing:** Adopt active-project and open-artifact events.
- [ ] **Missing:** Test OntoEagle/TOM ontology input and TOM-compatible table output discovery.

## Visual Lynx

**Expected shared records:** source RDF/graph artifacts, saved visualization/workspace state when requested, and optional image/report exports.

- [x] **Done:** A capability manifest is registered.
- [x] **Done:** No app-owned durable database was found in the focused audit.
- [ ] **Missing:** Discover RDF artifacts and shared graphs in the active project.
- [ ] **Missing:** Open `graphs`/`quadRows` without requiring a duplicate file upload.
- [ ] **Missing:** Save reusable visualization state and exports as artifacts rather than implicit browser state.
- [ ] **Missing:** Adopt active-project and open-artifact events.
- [ ] **Missing:** Test Table Nova, Linked-Data Transformer, DocxHund, and Axiolotl graph handoffs.

## Competency Question Ferret

**Expected shared records:** CQ workspace/graph artifacts, competency questions, term lists, linked people/data-source/diagram/query artifacts, and authoring runs.

- [x] **Done:** A capability manifest is registered.
- [x] **Done:** The project-scoped `competency-question-set` artifact is authoritative for CQ reads, writes, and deletes.
- [x] **Done:** Vocabulary extraction/tabulation and POSTagger graph updates use the shared artifact rather than `CQDatabase.CQStore`.
- [x] **Done:** Extracted vocabulary is published as a portable `term-list` artifact discoverable by TOM.
- [x] **Done:** CQ Ferret reads the shell's active project and reloads on `sitehdr:project-changed`.
- [x] **Done:** Saved Axiolotl `sparql-query` artifacts can be looked up and appended to a CQ.
- [x] **Done:** CQ CSV import and JSON-LD/CSV export are declared workspace actions in Manage Workspace; the duplicate sidebar buttons have been removed.
- [x] **Done:** Existing SPARQL query artifacts declare the explicit destination action “Append to associated queries.”
- [x] **Done:** Directly typed CCO Person (`cco:ont00001262`) and Database (`cco:ont00000756`) instances can be looked up from materialized project quad rows.
- [~] **Partial:** Existing `CQDatabase.CQStore` rows are detected and copied non-destructively when the selected project has no CQ workspace; source/shared counts are available and the legacy database is retained.
- [ ] **Missing:** Add migration fingerprint/identifier verification and an explicit user-confirmed legacy-database deletion control.
- [ ] **Missing:** Add subclass-aware lookup for more general CCO Cyber information-system subclasses after the shared graph inference/type-expansion contract is available.
- [ ] **Missing:** Handle `sitehdr:open-artifact` for CQ sets, term lists, SPARQL queries, and compatible knowledge-base artifacts.
- [~] **Partial:** Unit coverage exists for TOM term-list payloads, Axiolotl query payloads, and direct-type knowledge lookup; browser tests for edit/delete after reload and project switching remain.

## Graph Analyst Playbook

**Expected shared records:** playbook/decision-tree artifacts, referenced SPARQL-query artifacts, graph/data-source references, and execution runs.

- [x] **Done:** A capability manifest is registered.
- [?] **Audit:** Confirm all current authoring state and export paths; no authoritative shared-store adapter was found.
- [ ] **Missing:** Persist editable playbooks as shared artifacts.
- [ ] **Missing:** Reference queries and data sources by artifact ID instead of embedding untracked copies where possible.
- [ ] **Missing:** Discover compatible SPARQL queries and graphs.
- [ ] **Missing:** Adopt active-project and open-artifact events.
- [ ] **Missing:** Test authoring reload, project isolation, and Axiolotl/SPARQL visualizer handoffs.

## Graph Analytics

**Expected shared records:** input graph references, analytics configuration, and result/report artifacts for paths, communities, and related analyses.

- [x] **Done:** A capability manifest is registered.
- [?] **Audit:** Confirm whether any browser persistence exists outside the shared adapter sweep.
- [ ] **Missing:** Discover shared graphs and RDF artifacts as inputs.
- [ ] **Missing:** Store reusable analysis parameters and results as artifacts with source graph references.
- [ ] **Missing:** Record execution runs and output artifact IDs.
- [ ] **Missing:** Adopt active-project and open-artifact events.
- [ ] **Missing:** Test Axiolotl/Table Nova → Graph Analytics → Visual Lynx handoffs.

## Tabular Ontology Maker (TOM)

**Expected shared records:** ontology-table/workspace artifacts, ontology settings, imported term lists/ontologies, generated ontology RDF, and generation runs.

- [x] **Done:** Shared settings, workspace snapshots, generated ontology artifacts, and runs are implemented.
- [x] **Done:** Shared-first reads with a legacy fallback/migration path are implemented.
- [~] **Partial:** `TabularOntologyDB` remains available as a legacy source; migration verification and confirmed cleanup are unfinished.
- [ ] **Missing:** Replace the hard-coded default project with the shell’s active project.
- [ ] **Missing:** Discover/open CQ term lists, ontology tables, and source ontology artifacts.
- [ ] **Pinned bridge:** Declare and implement separate “Append terms to current table” and “Replace table from term list” actions for CQ Ferret `term-list` artifacts. Visibility alone does not satisfy this item.
- [ ] **Missing:** React to project changes and remove any competing project-selection state.
- [ ] **Missing:** Report legacy/shared record counts, verify migrated payloads, and offer confirmed legacy deletion.
- [ ] **Missing:** Test CQ Ferret → TOM and Table Nova ontology → TOM round trips.

## Knowledge Graph Modeler

**Expected shared records:** diagram/model artifacts, RDF/ontology-seed outputs, Mermaid diagram outputs, and generation runs.

- [?] **Audit:** The linked app is hosted outside the current ReasonLynx origin; same-origin IndexedDB sharing cannot be assumed.
- [ ] **Missing:** Decide whether to host the app under the shared origin or implement an explicit export/import/synchronization bridge.
- [ ] **Missing:** Add or expose a capability manifest at the integration boundary.
- [ ] **Missing:** Discover compatible vocabulary, ontology, and graph artifacts.
- [ ] **Missing:** Store models and generated RDF/seeds/diagrams as shared artifacts with derivation links.
- [ ] **Missing:** Test Modeler outputs in TOM, Mermaid, Axiolotl, and Visual Lynx.

## Mermaid Diagram Builder

**Expected shared records:** editable Mermaid diagram artifacts, referenced model/query/playbook artifacts, render exports, and generation runs.

- [?] **Audit:** The linked app/deployment origin and its existing `MermaidIDE` database must be reconciled with shared-origin storage.
- [ ] **Missing:** Decide same-origin hosting versus an explicit synchronization bridge.
- [ ] **Missing:** Migrate Mermaid projects/diagrams into shared projects/artifacts; keep only a documented sync queue as app-local operational state.
- [ ] **Missing:** Discover compatible model, CQ, playbook, and SPARQL-visualization artifacts.
- [ ] **Missing:** Record rendered/exported outputs and their source diagram.
- [ ] **Missing:** Verify migration counts and confirm deletion of legacy project/diagram stores.

## Table Nova

**Expected shared records:** source table artifacts, mapping/transformation configuration, generated RDF artifacts, ontology-draft artifacts, materialized graphs/quads, and runs.

- [x] **Done:** Transformation runs are written to the shared database.
- [~] **Partial:** Quads and ontology output currently live mainly inside run payloads; a run is not a substitute for discoverable output artifacts.
- [ ] **Missing:** Save CSV/XLSX inputs as source artifacts and transformation settings as reusable state.
- [ ] **Missing:** Save instance RDF and ontology draft as distinct output artifacts.
- [ ] **Missing:** Materialize queryable RDF through shared `graphs` and `quadRows`.
- [ ] **Missing:** Replace the hard-coded default project and adopt open-artifact/project-change events.
- [ ] **Missing:** Test outputs discovered by TOM, Axiolotl, and Visual Lynx.

## DocxHund

**Expected shared records:** DOCX source artifacts, document-model RDF, ontology/knowledge-base datasets, annotations, shared graphs/quads, and parsing/annotation runs.

- [x] **Done:** Source documents, generated RDF, knowledge bases, graphs/quads, annotations, and runs use the shared project database.
- [x] **Done:** DocxHund can select and create projects internally.
- [~] **Partial:** Its internal project selector is not yet reconciled with the universal workspace shell.
- [ ] **Missing:** Initialize from and react to the header’s active project; avoid two competing project selectors.
- [ ] **Missing:** Discover/open compatible DOCX, ontology, and knowledge-graph artifacts selected in the workspace manager.
- [ ] **Missing:** Verify that annotation and generated RDF provenance consistently links source and output artifact IDs.
- [ ] **Missing:** Test project switching, reload, artifact deletion, and Axiolotl/Visual Lynx consumption.

## Linked-Data Transformer

**Expected shared records:** source RDF artifacts, transformation specification/mapping artifacts, transformed RDF artifacts, and runs.

- [x] **Done:** A capability manifest is registered.
- [x] **Done:** No app-owned durable database was found in the focused audit.
- [ ] **Missing:** Discover shared RDF inputs and reusable transformation specifications.
- [ ] **Missing:** Store transformed RDF as an output artifact and materialize graphs/quads when queryable.
- [ ] **Missing:** Record source, transformation, and output artifact IDs in runs.
- [ ] **Missing:** Adopt active-project and open-artifact events.
- [ ] **Missing:** Test outputs in Axiolotl and Visual Lynx.

## Axiolotl SPARQL Endpoint

**Expected shared records:** graphs/quads, source RDF artifacts, saved SPARQL queries, endpoint/inference settings, inferred output or inference-run records, and query runs.

- [x] **Done:** Graphs/quads, saved queries, and settings have authoritative shared-store implementations.
- [x] **Done:** Legacy databases are treated as migration sources rather than the primary backend.
- [~] **Partial:** Legacy migration lacks a complete user-visible count/verification/confirmed-cleanup flow.
- [ ] **Missing:** Replace the hard-coded default project and react to project changes.
- [ ] **Missing:** Discover/open RDF, ontology, and SPARQL-query artifacts from the workspace manager.
- [ ] **Missing:** Ensure inference/query outputs that need reuse become artifacts instead of only transient results.
- [ ] **Missing:** Verify legacy triple/query/settings counts and confirm cleanup.
- [ ] **Missing:** Test graph isolation across projects and producer → Axiolotl discovery.

## SPARQL Pattern Visualizer

**Expected shared records:** SPARQL-query source artifacts, visualization/model artifacts, Mermaid exports, and transformation runs.

- [x] **Done:** A capability manifest is registered.
- [x] **Done:** No app-owned durable database was found in the focused audit.
- [ ] **Missing:** Discover/open saved queries from Axiolotl, Myna, and Playbook.
- [ ] **Missing:** Save visualizations and Mermaid output as shared artifacts linked to the source query.
- [ ] **Missing:** Adopt active-project and open-artifact events.
- [ ] **Missing:** Test query → visualization → Mermaid handoff.

## Slim Bundle Builder

**Expected shared records:** selected-term/IRI bundle artifacts, seed files, ontology-slim outputs, source ontology references, and generation runs.

- [x] **Done:** A distinct app capability manifest is registered.
- [~] **Partial:** The builder still depends on OntoEagle-era storage/shopping-cart behavior.
- [ ] **Missing:** Make the selection cart/bundle a shared artifact instead of `localStorage` or `OntoEagleDB` state.
- [ ] **Missing:** Discover source ontologies, term lists, and existing seed/bundle artifacts.
- [ ] **Missing:** Save seed files and generated slims as typed output artifacts with provenance.
- [ ] **Missing:** Use the active project independently of OntoEagle’s legacy database.
- [ ] **Missing:** Migrate legacy bundle JSON, verify it, and confirm cleanup.
- [ ] **Missing:** Test OntoEagle → Bundle Builder → TOM/Axiolotl handoffs.

## Ontology Compliance Diagnostic

**Expected shared records:** source ontology artifacts, diagnostic report artifacts, proposed curation-status changes, optional updated ontology artifacts, and runs.

- [x] **Done:** Diagnostic runs and scoped settings use the shared database.
- [~] **Partial:** Report content is primarily a run payload rather than a first-class discoverable report artifact.
- [ ] **Missing:** Save/reference the inspected ontology as an input artifact.
- [ ] **Missing:** Save diagnostic reports and bulk curation proposals as typed output artifacts.
- [ ] **Missing:** Replace the hard-coded default project and adopt project/open-artifact events.
- [ ] **Missing:** If legacy `ocd-db` records exist, migrate/count/verify and confirm cleanup.
- [ ] **Missing:** Test TOM/other ontology → diagnostic → curated ontology workflows.

## NLP Quality Assurance

**Expected shared records:** source ontology references, NLP QA report artifacts, proposed annotation changes, optional revised ontology artifacts, and runs.

- [x] **Done:** NLP QA state/settings, report artifacts, and runs have shared-storage paths.
- [~] **Partial:** Input ontology artifact linking and cross-app discovery are incomplete.
- [ ] **Missing:** Link every report and proposal to its source ontology artifact.
- [ ] **Missing:** Store accepted corrections as a revised ontology artifact or an explicit patch artifact.
- [ ] **Missing:** Replace the hard-coded default project and adopt project/open-artifact events.
- [ ] **Missing:** Test ontology → QA report → corrected ontology handoff.

## Myna IRI Swapper for SPARQL and RDF

**Expected shared records:** RDF/SPARQL source artifacts, mapping-table artifacts, rewritten RDF/query artifacts, and runs.

- [x] **Done:** RDF and SPARQL run histories have shared-storage paths.
- [~] **Partial:** Inputs, mappings, and rewritten outputs are mainly embedded in run payloads rather than independently discoverable artifacts.
- [ ] **Missing:** Save/reuse mapping tables as shared artifacts.
- [ ] **Missing:** Save source and rewritten RDF/SPARQL as linked input/output artifacts.
- [ ] **Missing:** Materialize rewritten RDF through shared graphs/quads when requested.
- [ ] **Missing:** Replace the hard-coded default project and adopt project/open-artifact events.
- [ ] **Missing:** Migrate/count/verify any legacy run databases and confirm cleanup.
- [ ] **Missing:** Test Myna outputs in Axiolotl, SPARQL Pattern Visualizer, and Visual Lynx.

## Recommended implementation order

1. Finish the shared active-project, artifact-open, kind-registry, migration-report, and contract-test infrastructure once.
2. Complete the apps already closest to authoritative storage: Axiolotl, TOM, and DocxHund.
3. Migrate the two still-authoritative legacy databases: CQ Ferret and OntoEagle; explicitly retain only tested caches.
4. Promote run payloads to first-class artifacts in Table Nova, OCD, NLP QA, and Myna.
5. Wire the currently stateless import/view tools: Ontology Tabulator, Visual Lynx, Linked-Data Transformer, SPARQL Pattern Visualizer, Graph Analytics, and Graph Analyst Playbook.
6. Decouple Slim Bundle Builder from OntoEagle legacy storage.
7. Resolve hosting/origin and migration for Knowledge Graph Modeler and Mermaid Diagram Builder.
8. Run producer/consumer contract tests, then perform user-confirmed legacy cleanup.

This order tests interoperability by artifact contract rather than every pair of apps. Each producer must pass the shared artifact contract tests for the kinds it emits, and each consumer must pass them for the kinds it accepts. That reduces an app-pair matrix to producer and consumer conformance tests per artifact kind.
