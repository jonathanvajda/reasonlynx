# Axiolotl IndexedDB Migration Plan

## Scope

- **Source app:** Axiolotl (`D:\GitHub\axiolotl`)
- **Capability family:** IndexedDB and app data management
- **Status:** Planning documentation only. No app code should be rewired from this file alone.
- **Target package:** `@ontoeagle/indexeddb-data-management`

This plan moves Axiolotl from app-local databases toward the shared project portfolio model while preserving the existing user data long enough for users to migrate or export it.

## Current Legacy Storage

|Legacy DB|Legacy store|Legacy purpose|Observed shape|Primary callers|
|:---|:---|:---|:---|:---|
|`inferenceDB`|`triples`|Active RDF graph workspace used by Comunica.|Rows keyed by subject, predicate, object, graph. Term metadata may include subject/object term types, language, datatype, and graph.|`indexeddb-triplestore.js`, `comunica-indexeddb-bridge.js`, `axiolotl-query.js`|
|`inferenceDB`|`savedQueries`|Saved SPARQL query artifacts.|Records keyed by `id`, with label/type/value/timestamps.|`indexeddb-triplestore.js`, query UI|
|`SPARQLSettings`|`Settings`|App and query settings.|Key-value rows keyed by `key`.|`indexeddb-triplestore.js`, query UI|

Important current behavior to preserve:

- The active query path loads IndexedDB triples into an RDF/JS-compatible in-memory store and gives that store to Comunica.
- The legacy default graph is represented as an empty string. The shared package canonicalizes default graph rows as `graph: null`.
- Axiolotl supports granular deletion: exact triples, graph clearing, active workspace clearing, saved query deletion, settings clearing, and hard reset.
- Saved queries are user-authored durable artifacts, not transient UI preferences.

## Target Storage Model

|Axiolotl concept|Target record/store|Target role|
|:---|:---|:---|
|Default or named graph metadata|`GraphRecord` in `graphs`|`source`, `loaded`, `inferred`, or `active` depending provenance|
|RDF statements|`QuadRow` in `quadRows`|Canonical query substrate|
|Saved SPARQL query|`ArtifactRecord` in `artifacts`|`artifactKind: 'sparql-query'`, `role: 'query'`|
|SPARQL update or generated query|`ArtifactRecord` in `artifacts`|`artifactKind: 'sparql-update'` or `sparql-query`, with provenance|
|Import operation|`RunRecord` in `runs`|`runKind: 'import'`|
|Inference operation|`RunRecord` in `runs`|`runKind: 'inference'`, with inferred graph/artifact refs|
|Construct/delete/update operation|`RunRecord` in `runs`|`runKind: 'sparql-operation'`|
|Global app settings|`SettingRecord` in `settings`|Scope `app:axiolotl`|
|Project-scoped settings|`SettingRecord` in `settings`|Scope `project:<projectId>`|

The lowest-risk path keeps Axiolotl's query architecture:

```text
shared quadRows -> RDF/JS quads -> N3.Store or rdfjsSource -> Comunica
```

This preserves the investment in Axiolotl's Comunica-backed triplestore behavior while replacing the local IndexedDB schema underneath it.

## File System Access Rollout Guidance

Axiolotl should migrate after TOM because its graph materialization and Comunica query path create a larger regression surface. FSA should be introduced as an optional durable artifact backend after the shared IndexedDB quad-store migration is validated.

Recommended Axiolotl source-of-truth policy:

- When no project folder is granted, IndexedDB stores graph metadata, quad rows, saved query artifacts, settings, and imported RDF artifact payloads.
- When a project folder is granted, the folder is authoritative for durable artifact bytes such as RDF source files, SPARQL query files, query result exports, and inference output files.
- IndexedDB remains authoritative for the active workspace index, graph records, quad rows used by Comunica, settings, run records, folder handle registry, and sync status.
- `quadRows` are the working/query cache. Folder RDF files are durable source artifacts. These two layers should not be collapsed.

Recommended folder-backed artifacts:

|Folder file|Artifact kind|Role|Handling|
|:---|:---|:---|:---|
|Turtle/JSON-LD/RDF/XML/N-Quads source|`rdf-file` or `rdf-dataset`|`source` or `loaded`|Register after review; parse/materialize into `quadRows` only by explicit import/reload action.|
|Named graph export|`rdf-dataset` or `quad-rows`|`export` or `transformed`|Written from explicit export operation; preserves graph identity in manifest/run provenance.|
|SPARQL query `.rq`|`sparql-query`|`query`|Register as saved query artifact; list from IndexedDB metadata for UI performance.|
|SPARQL update `.ru`|`sparql-update`|`query` or `operation`|Register as artifact; execution remains explicit.|
|Inference overlay output|`rdf-dataset`|`inferred` or `transformed`|Store as separate artifact and graph record; do not mix indistinguishably with uploaded source graph.|

Folder scan behavior:

1. On startup, project open, or user-triggered refresh, scan the selected Axiolotl project folder.
2. Files not present in the manifest become `discovered` scan results.
3. Show a "new files found" review panel for discovered RDF/query files.
4. Register approved files as artifacts; do not immediately load them into the active query workspace unless the user selects import/reload.
5. If a registered RDF file changes in the folder, mark it `folder-newer` and mark any graph materialization derived from it as stale.
6. Do not automatically replace `quadRows` after a folder RDF file changes. The user must explicitly reload/materialize the graph.
7. If a saved `.rq` query file changes in the folder, update the query artifact metadata and show it as `folder-newer`; applying it to the query editor is a UI action.

Conflict handling:

- If Axiolotl updated an artifact in IndexedDB and the corresponding folder file also changed since the last sync, mark `conflict`.
- Do not use newest timestamp to resolve true two-sided changes silently.
- Offer user actions: use folder version, use IndexedDB version, keep both, export IndexedDB copy, or ignore.
- For one-sided changes, newest modified timestamp can determine `folder-newer` or `indexeddb-newer`.

## Migration Mapping

|Legacy data|Shared conversion|Target write|
|:---|:---|:---|
|`inferenceDB.triples` rows|`convertLegacyTripleRowsToQuadRows(rows, { projectId, graphId })`|`replaceGraphQuadRows()` or `storeGraphQuadRows()` after creating `GraphRecord`|
|Legacy empty graph `''`|Normalize to `null`|Default graph quad rows|
|Legacy named graph strings|Preserve as `graph` value and corresponding `graphIri`|Named graph records and rows|
|`inferenceDB.savedQueries` rows|Normalize to project artifacts with `artifactKind: 'sparql-query'`|`artifactStore.storeProjectArtifact(record, payload)`|
|`SPARQLSettings.Settings` rows|`convertLegacySettingsToSettingRecords(rows, { scope })`|`settingsStore.storeSettingRecord(record)`|
|Current workspace status/counts|Recompute from `graphs` and `quadRows`|No direct migration; derived view|

## Migration Workflow

1. On app startup, open the shared project portfolio database and ensure the default project exists.
2. Inspect legacy databases with `inspectLegacyIndexedDbDatabase()`:
   - `inferenceDB`
   - `SPARQLSettings`
3. If no legacy stores contain rows, continue silently with shared storage only.
4. If legacy rows are present, show a migration/export panel before switching the user to the new active workspace.
5. Read legacy rows with `readLegacyObjectStoreRows()` and build a migration report with `createLegacyMigrationReport()`.
6. Let the user choose:
   - migrate into the current/default project,
   - export old data only,
   - defer migration for this session.
7. After migration, validate counts and representative query behavior before offering legacy deletion.
8. Delete legacy databases only after explicit user confirmation.

## Required App Changes

|File|Change|
|:---|:---|
|`public/app/indexeddb-triplestore.js`|Replace local DB open/store functions with shared project, graph, quad, artifact, and settings stores. Keep app-local UI-facing helpers only if their bodies delegate directly to canonical stores and use Axiolotl domain names.|
|`public/app/comunica-indexeddb-bridge.js`|Replace `getAllTriples()` and graph-field scans with `readActiveWorkspaceGraphPlan()`, `createRdfJsStoreFromQuadRows()`, `storeGraphQuadRows()`, `replaceGraphQuadRows()`, and graph deletion helpers.|
|`public/app/axiolotl-query.js`|Use shared stores for saved query artifacts and scoped settings. Keep DOM event wiring in this file, not in storage modules.|
|Tests|Add mock IndexedDB or memory-adapter tests for graph import, query artifact persistence, settings persistence, and legacy migration counts.|

## Function Naming Targets

App-local names may remain when they describe the Axiolotl domain, but promoted package calls should use the canonical names:

|Current local name|Target shared function|
|:---|:---|
|`initTripleStore`|`openProjectPortfolioDatabase()` plus `createProjectPortfolioStores()`|
|`getAllTriples`|`quadRowStore.listQuadRows({ projectId, graphId })` or active workspace helper|
|`storeTriplesInNamedGraph`|`storeGraphQuadRows()`|
|`clearTriples`|`clearGraphQuadRows()` for scoped graph data, or explicit project clear workflow|
|`deleteExactTriples`|Targeted `quadRowStore.deleteQuadRows(rows)` or a new `deleteMatchingQuadRows()` package function if exact deletion remains common|
|`saveSavedQuery`|`artifactStore.storeProjectArtifact()` with `artifactKind: 'sparql-query'`|
|`getAllSavedQueries`|`artifactStore.listProjectArtifacts(projectId, { artifactKind: 'sparql-query' })`|
|`saveSetting`|`settingsStore.writeSettingValue()`|
|`getSetting`|`settingsStore.readSettingValue()`|

## Validation Plan

Minimum Jest coverage before rewiring:

- Legacy triple rows with default graph `''` become quad rows with `graph: null`.
- Legacy named graph rows preserve graph IRI and term metadata.
- Multiple named graphs can be loaded into RDF/JS quads and queried through the existing Comunica path.
- Saved query rows become project artifacts with query text payloads intact.
- Settings rows become scoped setting records and can be read by key.
- Granular deletion behavior has package-level equivalents for:
  - exact row deletion,
  - named graph clearing,
  - whole active workspace clearing,
  - saved query deletion,
  - settings clearing.
- Migration report includes counts for migrated rows, skipped rows, warnings, and target project id.
- Folder-backed RDF files can be discovered without immediately mutating `quadRows`.
- Changed RDF source files mark derived graph materialization stale instead of replacing the active Comunica query cache.
- Saved SPARQL query files can be registered as project artifacts and listed from IndexedDB metadata.
- FSA conflict scenarios produce reviewable sync statuses and do not overwrite either side silently.

Performance observation to validate after rewiring:

- Early manual use suggested Axiolotl may run faster after replacing app-local `idb` wrapper usage and direct object-store code with the shared project storage path.
- Treat this as an implementation hypothesis until measured. The likely causes are fewer IndexedDB round trips, more predictable quad-row normalization, less wrapper overhead, and fewer stale compatibility branches in graph/workspace operations.
- Add a lightweight repeatable benchmark before claiming an optimization:
  - load N RDF quads into a named graph,
  - count all triples,
  - list graph names,
  - run one representative SELECT query,
  - run one representative CONSTRUCT query,
  - clear a named graph,
  - clear the active workspace.
- Record old local-store timings and shared project-store timings with the same fixture sizes. If outputs differ, document whether the difference is an intentional normalization change or a regression.

Manual browser validation before old DB deletion:

- Load existing local Axiolotl data.
- Run a SELECT query against the migrated active workspace.
- Run a CONSTRUCT query and export results.
- Add RDF into a named graph.
- Clear one named graph without clearing other graphs.
- Save, reload, rename/delete a saved SPARQL query.
- Export project archive and verify `project-manifest.json`.
- Grant an Axiolotl project folder, drop an RDF file and `.rq` file into it, refresh, and confirm both appear in the "new files found" review flow.
- Register a folder RDF file, then explicitly import/materialize it and confirm Comunica queries read from shared `quadRows`.
- Edit the folder RDF file outside Axiolotl and confirm the graph materialization is marked stale without silently replacing query rows.

## Risks And Open Decisions

- Exact triple deletion currently scans local rows and may rely on legacy row identity. If exact deletion remains a first-class Axiolotl operation, add a canonical `deleteMatchingQuadRows()` helper rather than reintroducing local scan logic.
- Axiolotl has app-level hard reset behavior. The shared package should expose precise deletion primitives; the app should own the destructive UI confirmation.
- Inference overlays should be stored as graph records with role `inferred`, not mixed indistinguishably into uploaded source graphs.
- Query artifacts should be project-scoped by default. App-global query snippets can be added later only if there is a real cross-project use case.
- Folder-backed Axiolotl support requires a shared folder scan/reconcile layer before rollout. Low-level FSA read/write/list exists, but automatic manifest reconciliation and graph-staleness propagation are not complete yet.

## Success Criteria

- Axiolotl can run existing Comunica queries from shared `quadRows`.
- New graph imports write only to shared project portfolio stores.
- Saved queries and settings no longer use app-local IndexedDB stores.
- Existing users can migrate or export old local data before deletion.
- Folder-backed RDF/query artifacts can be scanned, reviewed, registered, and synced without silently mutating active graph rows.
- Old local storage functions are removed after tests and manual validation prove they are unused.
