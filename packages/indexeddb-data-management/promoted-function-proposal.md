# Promoted Function Proposal

## Capability Family

- **Capability family:** IndexedDB and app data management
- **Proposal date:** 2026-07-29
- **Package:** `@ontoeagle/indexeddb-data-management`
- **Status:** Initial promoted package candidate with Jest coverage.

## Deep Comparison Summary

|Concern|Current variation|Decision for promoted package|
|:---|:---|:---|
|Naming convention|Apps use `openDb`, `ensureDb`, `initIndexedDB`, `saveRun`, `putRun`, `saveRDFtoIndexedDB`, and Mermaid-specific project names.|Use action-oriented names: `openIndexedDbStore`, `createProjectStore`, `storeRunRecord`, `storeProjectArtifact`, `upsertQuadRows`, `setDatasetEnabled`.|
|Input domain|Current functions often use implicit globals, DOM state, hard-coded DB names, or app-specific payloads.|Require explicit record objects and injected adapters. App-specific payloads stay opaque under `payload` or artifact storage.|
|Output range|Some functions return booleans, some return DB handles, some mutate UI and return nothing.|Return normalized records, arrays, counts, booleans, or explicit `null` for not found. Avoid UI mutation returns.|
|Error handling|Mixed: swallowed localStorage errors, alerts/toasts, console warnings, rejected IDB requests, TypeErrors.|Package throws `StorageError` with stable `code`; validation failures use `VALIDATION_ERROR`; app layers decide toast/log behavior.|
|Logging|Several apps log from storage functions; Axiolotl dispatches DOM events from storage.|No logging in core package. Callers can wrap with logging or event callbacks.|
|Side effects|Storage, DOM, localStorage, parsing, serialization, and UI refresh are frequently mixed.|Pure helpers are side-effect free. IndexedDB helpers perform only storage effects. Store factories depend on injected adapters.|
|RDF graph model|Axiolotl uses triples/quads with empty-string default graph; other apps often store RDF as strings or documents.|Canonical quad row uses `graph: null` for default graph. Named graphs remain explicit strings.|
|Record vocabulary|Current app records use local keys such as `label`, `createdAt`, `updatedAt`, `mediaType`, and `value`.|Use JSON-LD with full IRI keys at storage/import-export boundaries. Prefer BFO/CCO for ontological typing and DCTERMS/SKOS/RDFS for metadata where they cover the meaning; use `okea:` only for uncovered knowledge-engineering/project terms. DTO aliases remain migration inputs only.|
|Project model|Mermaid has explicit projects and diagrams; TOM has one implicit ontology project; others store run history.|Canonical model supports cross-app project portfolios and project-scoped artifacts, datasets, runs, and quad rows. App-local caches can remain app-local, but user project records must use the shared portfolio boundary.|
|Deletion model|Axiolotl has granular deletion; Mermaid has project/diagram deletion; IRI/Table Nova have run deletion.|Expose exact record deletion and filtered clearing. Destructive app confirmation remains in the app layer.|
|Vendor dependencies|Axiolotl uses `idb`; others use native IndexedDB wrappers; Mermaid uses native IDB/FSA.|Core package has no vendor dependency. Native IndexedDB adapters are small and injectable.|
|Testability|Mermaid has the strongest storage tests; most ontology apps lack IDB tests.|Use adapter injection and memory adapter for deterministic Jest; separately test native IDB wrappers with mocks.|

## Promoted Function Set

### Error and ID Core

```js
new StorageError(message, { code, cause, details })
createStableRecordId(prefix, parts, options)
createTimestampRecordId(prefix, options)
```

These replace app-local `makeRunId`, `stableDatasetId`, and ad hoc id normalization where deterministic ids or user-action run ids are needed.

### Record Normalization

```js
normalizeProjectRecord(record, options)
normalizeArtifactRecord(record, options)
normalizeDatasetRecord(record, options)
normalizeRunRecord(record, options)
normalizeQuadRow(row)
```

These functions provide the shared data model. They are pure, fixture-friendly, and usable in Node, workers, and browser app code.

### JSON-LD Record Conversion

```js
PROJECT_RECORD_JSONLD_CONTEXT
createRecordJsonLdVocabulary()
readJsonLdRecordValue(record, keys, fallback)
convertProjectRecordToJsonLd(record, options)
convertArtifactRecordToJsonLd(record, options)
convertDatasetRecordToJsonLd(record, options)
convertRunRecordToJsonLd(record, options)
convertSettingRecordToJsonLd(record, options)
convertWorkspaceInclusionRecordToJsonLd(record, options)
convertGraphRecordToJsonLd(record, options)
```

These functions make the promoted storage/interchange shape explicit. They map JS migration fields to existing vocabulary terms where possible: IDs to `@id` and `dcterms:identifier`, `label` to `dcterms:title` or `rdfs:label`, `createdAt` to `dcterms:created`, `updatedAt` to `dcterms:modified`, `mediaType` to `dcterms:format`, and setting values to `rdf:value`.

Project-management-specific gaps use `okea:` from the Ontology of Knowledge Engineering Artifacts. Generic artifacts and datasets should be typed as CCO information content entities unless a more specific OKEA class already exists, operation runs should be typed as CCO computer program executions, and metadata should use DCTERMS/SKOS/RDFS. Provisional OKEA terms such as `okea:Project`, `okea:WorkspaceInclusion`, `okea:inputArtifact`, `okea:outputArtifact`, or `okea:storageBackend` should be added to that ontology only where no existing vocabulary term is a good fit.

The current IndexedDB schema still uses keyPaths such as `projectId` and `artifactId`. Directly storing pure JSON-LD records therefore needs a separate schema migration to out-of-line keys or JSON-LD-compatible key paths. Until then, app code can normalize DTO input and use `convert*RecordToJsonLd()` for previews, manifests, exports, and migration validation.

### IndexedDB Boundary

```js
resolveIdbRequest(request)
waitForIdbTransaction(transaction)
openIndexedDbStore(schema, options)
runObjectStoreTransaction(db, storeNames, mode, operation)
deleteIndexedDbDatabase(name, options)
```

These replace repeated low-level `requestToPromise`, `transactionToPromise`, `txDone`, `openDb`, `ensureDb`, and `initIndexedDB` variants.

### Store Factories

```js
createMemoryRecordAdapter(entries)
createIndexedDbRecordAdapter(db, storeName, options)
createProjectPortfolioSchema(options)
openProjectPortfolioDatabase(options)
createProjectPortfolioStores(db, options)
ensureProjectPortfolioProject(stores, record)
createProjectStore(adapter, options)
createArtifactStore(adapter, options)
createDatasetStore(adapter, options)
createSettingsStore(adapter, options)
createRunRecordStore(adapter, options)
createQuadRowStore(adapter)
```

These are intentionally adapter-driven. Apps can back them with IndexedDB object stores now and later with File System Access or OPFS backends.

`openProjectPortfolioDatabase` is the shared cross-app portfolio entrypoint. Apps should use it for `projects`, `artifacts`, `runs`, and project-scoped settings so one user project can contain an OntoEagle ontology catalog artifact, TOM workspace artifact, Axiolotl graph/query artifact, Mermaid diagram artifact, and downstream reports. App-specific caches such as OntoEagle's extracted document cache may stay in app-local databases when they are derived or implementation-specific.

### File System Access Backend

```js
detectFileSystemAccessSupport()
selectProjectFolder(options)
initializeProjectFolderAccess(handleStore, options)
requestProjectFolderPermission(handleRecord)

createProjectFolderHandleStore(adapter, options)
storeProjectFolderHandleRecord(record)
readProjectFolderHandleRecord(handleId)
listProjectFolderHandleRecords(filter)
updateProjectFolderHandleRecord(handleId, patch)
deleteProjectFolderHandleRecord(handleId)

sanitizeProjectFileName(name)
splitProjectRelativePath(path)
createProjectFileLockKey(path)
guardWritableProjectPath(path, options)

listProjectFolderEntries(folderStore, path, options)
readProjectFileBytes(folderStore, path, options)
readProjectFileText(folderStore, path, options)
writeProjectFileBytes(folderStore, path, bytes, options)
writeProjectFileText(folderStore, path, text, options)
createProjectDirectory(folderStore, path, options)
renameProjectFileEntry(folderStore, fromPath, toName, options)
deleteProjectFileEntry(folderStore, path, options)

writeProjectManifestToFolder(folderStore, manifest, options)
writeProjectArtifactToFolder(folderStore, artifact, payload, options)
readProjectManifestFromFolder(folderStore, options)
createProjectFolderManifest(projectExport, options)
createProjectArtifactFolderPath(artifact, options)
scanProjectFolder(folderStore, options)
reconcileProjectFolderScan(input)
createArtifactRecordFromProjectFolderFile(projectId, folderEntry, options)
markDerivedProjectArtifactsStale(artifacts, changedArtifactIds)
```

These have been promoted from Mermaid's File System Access implementation into app-neutral package functions. IndexedDB remains the default browser persistence and the handle registry; FSA is an optional local-folder backend for durable project files. Folder scans are intentionally read-only and produce reviewable discovered/conflict/stale statuses before app code mutates IndexedDB records or materialized graph/table caches.

## Why This Is Not a Frankenstein Function

The package does not create one generic `saveAnything()` function. It separates stable concepts:

- Projects organize durable user work across apps.
- Artifacts represent source, loaded, staged, transformed, query, diagram, report, mapping, and export data.
- Datasets represent enabled/disabled loaded data sources.
- Runs represent previous operations and resumable history.
- Quad rows represent RDF graph storage.
- IndexedDB helpers handle browser storage mechanics only.

This avoids coupling OntoEagle preload behavior, Axiolotl graph storage, TOM workspace snapshots, IRI/Table Nova run history, OCM reports, and Mermaid projects into one ambiguous API.

## App Adoption Plan

### OntoEagle

- Replace `idbInit`, `idbPutDocuments`, `idbGetEnabledDocuments`, `idbPutDatasetMeta`, `idbSetDatasetEnabled`, and `idbDeleteDataset` with `openIndexedDbStore`, `createDatasetStore`, and a dataset-document adapter.
- Keep RDF parsing in `rdf-io`; call storage only with normalized docs/dataset records.
- Convert built-in graph and user imports into `DatasetRecord` with `source: 'builtin' | 'user'`.
- Move localStorage snapshot behavior behind an explicit companion cache adapter or remove it if IndexedDB becomes source of truth.
- CQ Ferret should not expose global `initIndexedDB`; once vendor code is isolated, JSON-LD node persistence should use an app adapter over shared stores.

### Tabular Ontology Maker

- Treat the current singleton ontology as a default `ProjectRecord`.
- Replace `ensureDb`, `settingsLoad`, `saveOntologySettings`, and `clearOntologySettings` with project/settings store adapters.
- Replace `buildWorkspaceSnapshot` persistence with `storeProjectArtifact` for workspace snapshots and RDF exports.
- Keep grid/DOM extraction in TOM; pass normalized project/artifact records into the shared package.

### Axiolotl

- Replace local settings, saved query, and quad-store wrappers piecemeal.
- Normalize all stored triples/quads through `normalizeQuadRow`; migrate empty-string default graph to `graph: null` at the package boundary.
- Replace saved query persistence with `storeProjectArtifact` using query artifact kinds.
- Move DOM events out of storage functions; dispatch events after shared calls complete.
- Keep SPARQL execution and parser/runtime dependencies outside this package.

### Ontology Curation Manager / OCD

- Replace `requestToPromise`, `transactionToPromise`, and `openDatabase` with the shared IndexedDB adapter.
- Replace `saveRun`, `listRuns`, `getRun`, `deleteRun`, and `getLastRunId` with `createRunRecordStore`.
- Keep diagnostic report validation in OCD, but persist it as a `RunRecord` plus optional report artifact.

### IRI Swapper

- Replace duplicated RDF and SPARQL run-history functions with one shared `createRunRecordStore` backed by the same app adapter.
- Store input/output files or query text as artifacts; store each transformation as a `RunRecord`.
- Keep RDF/SPARQL parsing and serialization in the relevant packages.

### Table Nova

- Replace `openTableNovaDb`, `tx`, `putRun`, `listRuns`, `deleteRun`, and `getRunDataset` with shared IndexedDB helpers plus `createRunRecordStore` and `createArtifactStore`.
- Store generated quads with `createQuadRowStore` or as an RDF dataset artifact depending on query needs.
- Keep tabular/RDF conversion outside this package.

### Mermaid

- Use as reference architecture for project/artifact CRUD and backend boundaries.
- If adopted later, map diagrams to `ArtifactRecord` with `artifactKind: 'mermaid-diagram'`.
- Keep Mermaid-specific editor state and File System Access logic in adapter layers.

### Visual Lynx, SPARQL Pattern Visualizer, Ontology Tabulator

- No immediate duplicate IndexedDB code to delete based on this survey.
- When persistence is added, start with `ProjectRecord`, `ArtifactRecord`, or `RunRecord` rather than app-local `openDb` helpers.

## Jest Coverage Added

The new suite covers:

- Stable and timestamp id generation.
- Project, artifact, dataset, run, and quad record normalization.
- Validation failures as `StorageError`.
- Project CRUD over an injected adapter.
- Artifact filtering and payload omission.
- Dataset enablement and enabled-only listing.
- Run sorting, limit, filtering, and latest-run tracking.
- Quad upsert/list/count/delete with default and named graphs.
- IndexedDB request, transaction, open/upgrade, and blocked delete wrappers.

## Remaining Work Before App Rollout

- Plan the IndexedDB schema migration required for storing JSON-LD records with full IRI keys directly rather than DTO records with `projectId`/`artifactId` keyPaths.
- Add fixtures for OntoEagle built-in/user datasets and Axiolotl named/default graph migrations.
- Decide whether project deletion cascades, blocks, or archives artifacts per app.
- Add app-specific migration notes before deleting local duplicates.
- Add manifest-last batch write and recovery/audit helpers for multi-file folder saves.
- Pilot folder-backed storage in TOM first, then Axiolotl.
