# Tabular Ontology Maker IndexedDB Migration Plan

## Scope

- **Source app:** Tabular Ontology Maker (`D:\GitHub\tabular-ontology-maker`)
- **Capability family:** IndexedDB and app data management
- **Status:** Initial TOM rewiring complete for shared IndexedDB project storage. Folder-sync UI remains deferred.
- **Target package:** `@ontoeagle/indexeddb-data-management`

This plan moves TOM from a single app-local session database to the shared project portfolio model while preserving existing user sessions long enough for export or migration.

## Current Legacy Storage

|Legacy DB|Legacy store|Legacy purpose|Observed shape|Primary callers|
|:---|:---|:---|:---|:---|
|`TabularOntologyDB`|`rdfStore`|Saved generated RDF output.|Auto-increment records containing serialized RDF output and timestamps.|`saveRDFtoIndexedDB()`, `loadLatestFromIndexedDB()`|
|`TabularOntologyDB`|`workspaceStore`|Saved TOM workspace snapshot.|Auto-increment records containing table state, predicate registry, axiom state, and timestamps.|`buildWorkspaceSnapshot()`, `applyWorkspaceSnapshot()`, `loadLatestFromIndexedDB()`|
|`TabularOntologyDB`|`ontologySettingsStore`|Single ontology/project settings object.|Singleton key `ontologySettings` with settings payload and timestamp.|`settingsLoad()`, `saveOntologySettings()`, settings modal|

Important current behavior to preserve:

- TOM feels like a single active ontology project.
- On load, TOM restores the latest workspace snapshot when present.
- If no workspace snapshot is available, TOM can fall back to the latest saved RDF record.
- Ontology metadata, prefixes, imports, and related settings are part of the user's project state.
- The UI/grid state is central to TOM and should not be treated as a generic storage concern.

## Target Storage Model

|TOM concept|Target record/store|Target role|
|:---|:---|:---|
|Single active TOM project|`ProjectRecord` in `projects`|Default project initially; named project later|
|Uploaded tabular source|`ArtifactRecord` in `artifacts`|`artifactKind: 'ontology-table'`, `role: 'source'`|
|Normalized working table/session|`ArtifactRecord` in `artifacts`|`artifactKind: 'ontology-table'`, `role: 'staged'`|
|Generated ontology RDF|`ArtifactRecord` in `artifacts`|`artifactKind: 'ontology-rdf'`, `role: 'generated'` or `transformed`|
|Generated RDF graph rows, when materialized|`GraphRecord` plus `QuadRow` records|`role: 'generated'`|
|Ontology metadata profile|`SettingRecord` in `settings`|Scope `project:<projectId>`, key `okea:OntologyMetadataProfile`; value is a canonical full-IRI JSON-LD-compatible ontology metadata record|
|Save/export/generation event|`RunRecord` in `runs`|`runKind: 'ontology-generation'` or `export`|

TOM should initially remain a single-project app. The shared package should provide the storage substrate; TOM should continue to own the ontology table model, grid rendering, settings modal, and RDF generation UI.

## RDF Composition State

### As-Is

- TOM's editable table/grid remains the primary in-memory working model for ontology content.
- TOM ontology metadata settings are now stored in the shared project settings store as JSON-LD-compatible data using full IRI keys.
- TOM export currently still composes RDF from app-owned in-memory table/settings state, then passes the resulting RDF dataset/serialization path through shared RDF and format utilities.
- TOM does not yet consistently materialize the table rows plus ontology metadata into shared `quadRows` before export.
- Generated RDF is saved as a project artifact. Optional graph-row materialization is documented, but not the required export source yet.

This means TOM is aligned with the shared storage/settings model, but the RDF composition pipeline is not yet fully canonicalized around `quadRows`.

### To-Be

TOM should use one canonical RDF composition path:

1. Read TOM table rows from the Glide-backed table model.
2. Read ontology metadata from the project-scoped `okea:OntologyMetadataProfile` setting.
3. Normalize both into one RDF dataset represented as canonical RDF/quad rows.
4. Serialize that RDF dataset through shared `rdf-io` into Turtle, TriG, N-Triples, N-Quads, JSON-LD, RDF/XML, or other supported formats.
5. Save the serialized output as an `ontology-rdf` generated artifact.
6. Optionally materialize the same dataset into `GraphRecord` plus `QuadRow` records for downstream search/query/reuse.

The target flow is:

`TOM table rows + ontology metadata record -> canonical RDF dataset/quadRows -> shared serializer -> generated ontology artifact`

### Intended Path

1. Keep the current TOM UI adapter in place so the settings modal and table continue to work.
2. Promote or add TOM-focused pure functions that build RDF terms/quads from table rows without touching DOM or IndexedDB.
3. Add ontology metadata writer functions in the shared `ontology-metadata` package that append ontology-level triples/quads to an existing RDF dataset.
4. Replace TOM's remaining app-local RDF composition branch with a single call sequence:
   `readTomTableRows() -> buildTomOntologyQuads() -> appendOntologyMetadataQuads() -> serializeRdfDatasetWithAdapters()`.
5. Add Jest fixtures proving that the old TOM expected outputs are preserved, or documenting exact intentional differences.
6. Only after manual validation, make generated RDF export depend on the canonical dataset path instead of TOM's legacy composition path.

This is intentionally separate from the already-completed settings migration. The settings migration fixes durable ontology metadata storage; the next RDF composition pass fixes how TOM turns table content plus metadata into serializable RDF.

## File System Access Rollout Guidance

TOM should migrate to shared IndexedDB project storage first, then add File System Access as an optional folder-backed artifact store. TOM is the recommended first FSA pilot because its dominant workflow is a single ontology project with source table artifacts and generated ontology artifacts.

Recommended TOM source-of-truth policy:

- When no project folder is granted, IndexedDB stores the project index, working snapshot, settings, artifact payloads, and generated RDF.
- When a project folder is granted, the folder is authoritative for durable artifact bytes such as source CSV/TSV/XLSX files and generated ontology RDF files.
- IndexedDB remains authoritative for the TOM project index, settings, latest workspace state, derived metadata, sync status, and folder handle registry.
- TOM workspace snapshots remain app-owned staged artifacts. They should not be treated as the same thing as an ontology source file.

Recommended folder-backed artifacts:

|Folder file|Artifact kind|Role|Handling|
|:---|:---|:---|:---|
|Source CSV/TSV/XLSX|`ontology-table`|`source`|Register after review; loading into TOM table is explicit user action unless TOM opens the project from that artifact.|
|Normalized TOM workspace snapshot|`tom-workspace-snapshot`|`staged`|May be written by TOM as app state; not expected to be edited manually.|
|Generated Turtle/JSON-LD/RDF/XML|`ontology-rdf`|`generated` or `transformed`|Written by TOM generation/export; remains a separate artifact from the table source.|
|Namespace/profile JSON-LD|namespace/profile artifact or project setting|`setting`|Use shared setting records and ontology-backed JSON-LD keys.|

Folder scan behavior:

1. On startup, project open, or user-triggered refresh, scan the selected TOM project folder.
2. Files not present in the manifest become `discovered` scan results.
3. Show a "new files found" review panel for discovered source tables and RDF files.
4. Register approved files as artifacts; do not immediately overwrite the active TOM table unless the user selects that action.
5. If a registered source table changes in the folder, mark it `folder-newer` and mark generated RDF artifacts derived from it as `stale-derived-output`.
6. Do not automatically regenerate RDF after a source table changes. The user must rerun ontology generation.
7. If generated RDF changes in the folder, mark the artifact `folder-newer`; materializing graph rows is an explicit reload/parse action.

Conflict handling:

- If TOM changed the staged workspace in IndexedDB and the corresponding folder artifact also changed since the last sync, mark `conflict`.
- Do not silently choose newest for true two-sided changes.
- Offer user actions: use folder version, use IndexedDB version, keep both, export IndexedDB copy, or ignore.
- For simple one-sided changes, newest modified timestamp can determine `folder-newer` or `indexeddb-newer`.

## Migration Mapping

|Legacy data|Target conversion|Target write|
|:---|:---|:---|
|Latest `workspaceStore` snapshot|Normalize as TOM-owned project snapshot payload|`artifactStore.storeProjectArtifact()` with `artifactKind: 'tom-workspace-snapshot'`, `role: 'staged'`|
|All `workspaceStore` snapshots, if retained|Store as historical staged artifacts or run payloads|Prefer latest-only for initial migration unless user requests history|
|Latest `rdfStore` record|Store serialized RDF as artifact payload|`artifactKind: 'ontology-rdf'`, `role: 'generated'`|
|Generated RDF parsed into triples/quads|Optional materialization through `rdf-io` then `storeGraphQuadRows()`|Only after parse success; do not block restoring TOM UI|
|`ontologySettingsStore.ontologySettings`|Normalize to canonical ontology metadata record|`settingsStore.storeSettingRecord()` with key `okea:OntologyMetadataProfile`|

## Migration Workflow

1. On TOM startup, open the shared project portfolio database and ensure the default project exists.
2. Inspect `TabularOntologyDB` with `inspectLegacyIndexedDbDatabase()`.
3. If no legacy stores contain rows, use shared project storage silently.
4. If legacy rows are present, show a migration/export panel before replacing the old restore path.
5. Read `rdfStore`, `workspaceStore`, and `ontologySettingsStore`.
6. Prefer the latest valid workspace snapshot as the primary migrated artifact.
7. Preserve latest generated RDF as a separate generated ontology artifact.
8. Preserve ontology settings as project-scoped settings.
9. Validate the migrated project by restoring the snapshot into TOM's existing UI state.
10. Delete `TabularOntologyDB` only after explicit user confirmation.

## Required App Changes

|File|Change|
|:---|:---|
|`docs/app/tom-core.js`|Remove direct `indexedDB.open('TabularOntologyDB')` persistence once the migration path is validated. Use shared project/artifact/settings stores instead.|
|`docs/app/tom-core.js`|Keep TOM-specific pure functions such as workspace snapshot normalization and UI application in TOM unless/until they prove useful across apps.|
|`docs/app/tom-core.js`|Replace `settingsLoad()`/`saveOntologySettings()` storage internals with `readSettingValue()`/`writeSettingValue()` or full setting records.|
|`docs/app/tom-core.js`|Replace `saveRDFtoIndexedDB()` with a TOM-named save operation that writes project artifacts and optional graph rows through shared package stores.|
|Tests|Add memory-adapter or mock IndexedDB tests for TOM snapshot persistence, settings persistence, generated RDF artifact persistence, and legacy migration.|

## Function Naming Targets

App-local names should describe TOM operations; shared package calls should use canonical names.

|Current local name|Target shared function or app-level replacement|
|:---|:---|
|`ensureDb`|`openProjectPortfolioDatabase()` plus `createProjectPortfolioStores()`|
|`settingsLoad`|`settingsStore.readSettingValue('ontologySettings', defaultValue)`|
|`saveOntologySettings`|`settingsStore.writeSettingValue('ontologySettings', settings)`|
|`hasPriorSavedSession`|Migration-specific legacy inspection plus shared artifact listing|
|`saveRDFtoIndexedDB`|App-level `storeTomWorkspaceProjectState()` using artifact/settings/graph stores|
|`loadLatestFromIndexedDB`|App-level `restoreLatestTomProjectState()` using artifact/settings stores|
|`getLatestSavedRecord`|Shared artifact/run listing with explicit sort and filtering|

## Validation Plan

Minimum Jest coverage before rewiring:

- A legacy TOM settings row becomes a project-scoped `SettingRecord`.
- A legacy workspace snapshot becomes a staged TOM workspace artifact.
- A legacy RDF record becomes a generated ontology RDF artifact with media type and extension preserved.
- Latest snapshot selection is deterministic when multiple snapshots exist.
- Invalid or partial legacy snapshots produce warnings and do not overwrite valid project data.
- Restoring migrated settings preserves ontology IRI, prefixes, imports, and metadata.
- Generated RDF can optionally be parsed and materialized as graph rows without changing the canonical serialized artifact.
- Folder-backed source files can be discovered without mutating the active TOM table.
- A changed source table marks generated RDF as stale rather than regenerating it automatically.
- FSA conflict scenarios produce reviewable sync statuses and do not overwrite either side silently.

Manual browser validation before old DB deletion:

- Load a browser with existing TOM saved session data.
- Migrate into the default project.
- Reload TOM and confirm the table/grid state is restored.
- Open ontology settings and confirm metadata, prefixes, and imports survived.
- Generate RDF and confirm export output is unchanged or documented where different.
- Save again and confirm no new writes go to `TabularOntologyDB`.
- Export the project archive and verify `project-manifest.json`.
- Grant a TOM project folder, drop a CSV or RDF file into it, refresh, and confirm the file appears in the "new files found" review flow before registration.
- Edit a registered source CSV outside TOM and confirm TOM marks downstream generated RDF stale without rerunning generation.

## Risks And Open Decisions

- TOM's workspace snapshot is UI-rich and app-specific. It should not be promoted prematurely as a generic project snapshot unless another app needs the same shape.
- Storing every historical workspace snapshot may create clutter. Initial migration should preserve the latest valid snapshot plus latest generated RDF. Historical snapshot preservation can be added as an advanced import option.
- Generated RDF should remain a serialized ontology artifact even if also materialized into `quadRows`. This avoids making RDF parser success a prerequisite for restoring TOM's working table.
- TOM-specific artifact kinds should be added to the package vocabulary before migration: `ontology-table`, `tom-workspace-snapshot`, and `ontology-rdf`.
- Folder-backed TOM support requires a shared folder scan/reconcile layer before rollout. Low-level FSA read/write/list exists, but automatic project manifest reconciliation is not complete yet.

## Success Criteria

- TOM starts from shared project storage after migration.
- Existing user sessions can be migrated or exported before old data is deleted.
- Ontology settings are stored as scoped project settings.
- Generated ontology RDF is stored as a project artifact and can be downloaded through shared file/export utilities.
- Folder-backed source and generated artifacts can be scanned, reviewed, registered, and synced without silently overwriting TOM workspace state.
- App-local persistence code is removed after tests and manual validation prove the shared stores cover the old inputs and outputs.

## Implementation Notes

Completed in TOM:

- TOM opens `OntologyWorkbenchProjects` and ensures the shared default cross-app project exists before storing project data.
- Ontology settings now read/write/delete through the shared project-scoped settings store.
- Current workspace saves now store a staged `tom-workspace-snapshot` artifact, a generated `ontology-rdf` artifact, and a migration/save `RunRecord`.
- The old app action `saveRDFtoIndexedDB()` was replaced with `storeTomWorkspaceProjectState()` in TOM's JS API and button wiring.
- Legacy `TabularOntologyDB` session rows are copied forward into shared project storage on first restore when no shared TOM session exists.
- Legacy database deletion is intentionally not automatic; it still requires explicit user confirmation after manual validation.
- RDF artifact MIME type and extension assignment now uses the shared format registry rather than TOM-local switch tables.
- TOM's service worker precache manifest now includes the piecemeal shared `indexeddb-data-management`, `tabular-io`, `browser-file-io`, `format-registry`, and `rdf-io` modules required by the migrated app.
- TOM Jest coverage now includes shared settings persistence, project artifact session persistence, deterministic latest legacy session migration, and RDF format metadata preservation for N-Quads.

Deferred:

- Folder-backed File System Access project sync UI.
- Explicit "new files found" review panel for dropped folder files.
- User-confirmed deletion/export flow for the legacy `TabularOntologyDB`.
- Optional RDF materialization into graph rows from TOM-generated ontology artifacts.
