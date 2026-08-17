# Headless API Audit

## Capability Family

- **Capability family:** IndexedDB/project/graph/settings data management
- **Audit step:** 18.11
- **Date updated:** 2026-08-15

## Audit Conclusion

The `indexeddb-data-management` package exposes a stable headless programmatic API for project, artifact, dataset, run, setting, graph, quad-row, manifest, and migration records. It also exposes explicit browser storage adapters for IndexedDB, File System Access, Web Locks, Blob downloads, and ZIP archive generation.

This is the correct boundary for this capability family. The package is not purely deterministic end to end because storage is the capability being managed. The headless contract is therefore the data model, validation, normalization, JSON-LD projection, store interface, graph row model, manifest model, reconciliation logic, and injectable adapter surface. Browser UI code must consume those APIs; it must not reimplement record models, graph row normalization, FSA path safety, or storage error handling locally.

## Stable Public API Groups

| API group | Representative exports | Boundary category | Side effects | Headless status |
| --- | --- | --- | --- | --- |
| Storage errors | `StorageError`, `createValidationError`, `toStorageError` | Pure core | None | Stable |
| ID generation | `createStableRecordId`, `createTimestampRecordId` | Pure/nondeterministic core | `createTimestampRecordId` uses injected or default clock | Stable, test-injectable |
| Record normalization | `normalizeProjectRecord`, `normalizeArtifactRecord`, `normalizeDatasetRecord`, `normalizeRunRecord`, `normalizeSettingRecord`, `normalizeGraphRecord`, `normalizeQuadRow` | Pure core | None except injected/default timestamps | Stable |
| JSON-LD projection | `convert*RecordToJsonLd`, `readJsonLdRecordValue`, `createRecordJsonLdVocabulary` | Pure semantic model | None | Stable |
| Generic stores | `createMemoryRecordAdapter`, `createProjectStore`, `createArtifactStore`, `createDatasetStore`, `createSettingsStore`, `createRunRecordStore`, `createGraphStore`, `createQuadRowStore` | Store abstraction | Adapter-defined | Stable |
| IndexedDB adapter | `openIndexedDbStore`, `createIndexedDbRecordAdapter`, `openProjectPortfolioDatabase`, `createProjectPortfolioStores`, `ensureProjectPortfolioProject`, `inspectIndexedDbDatabase`, `deleteIndexedDbDatabase` | Browser storage adapter | IndexedDB open/upgrade/read/write/delete | Stable adapter |
| Graph workspace operations | `createActiveWorkspaceGraphPlan`, `readActiveWorkspaceGraphPlan`, `storeGraphQuadRows`, `replaceGraphQuadRows`, `clearGraphQuadRows`, `deleteGraphRecordWithQuadRows` | Store service over injected stores | Adapter-defined writes | Stable |
| RDF/JS quad-row conversion | `convertRdfJsQuadsToQuadRows`, `convertQuadRowsToRdfJsQuads`, `createRdfJsStoreFromQuadRows` | Pure adapter conversion | None; caller injects RDF/JS factory/store constructor | Stable |
| Project manifests | `createProjectExportManifest`, `normalizeProjectImportManifest`, `PROJECT_ARCHIVE_MANIFEST_FILE`, `PROJECT_MANIFEST_KIND`, `PROJECT_MANIFEST_SCHEMA_VERSION` | Pure core | None | Stable |
| Project artifact export | `resolveArtifactDownloadFormat`, `createArtifactDownloadFileName`, `createArtifactDownloadBlob`, `downloadProjectArtifact`, `createProjectArchiveBlob`, `downloadProjectArchive` | Artifact/download adapter | `Blob`, `JSZip`, and injected download function | Stable adapter |
| FSA path safety | `sanitizeProjectFileName`, `splitProjectRelativePath`, `guardWritableProjectPath`, `createProjectFileLockKey`, `runWithProjectFileLock` | Pure core plus optional Web Locks adapter | Optional `navigator.locks` | Stable |
| File System Access | `detectFileSystemAccessSupport`, `selectProjectFolder`, `readProjectFolderPermission`, `requestProjectFolderPermission`, `createProjectFolderStore`, `initializeProjectFolderAccess`, `createProjectFolderHandleStore` | Browser folder adapter | Folder picker, permission, file read/write/list/rename/remove | Stable adapter |
| Folder synchronization | `createProjectFolderManifest`, `writeProjectManifestToFolder`, `readProjectManifestFromFolder`, `writeProjectArtifactToFolder`, `scanProjectFolder`, `reconcileProjectFolderScan`, `createArtifactRecordFromProjectFolderFile`, `markDerivedProjectArtifactsStale` | Pure reconciliation plus FSA store adapter | Adapter-defined file reads/writes | Stable |
| Legacy migration | `inspectLegacyIndexedDbDatabase`, `readLegacyObjectStoreRows`, `convertLegacyTripleRowsToQuadRows`, `convertLegacySettingsToSettingRecords`, `createLegacyMigrationReport` | Detection/conversion plus IndexedDB adapter | Non-destructive IndexedDB reads | Stable adapter |

## Side-Effect Boundary Rules

- Core functions may normalize records, generate stable ids, build manifests, convert records to JSON-LD, convert quad rows, compute graph plans, sanitize paths, and reconcile folder scans.
- Core functions must not read DOM state, mutate DOM, emit toasts, log to the console, fetch remote files, parse RDF/tabular payloads, serialize RDF/tabular payloads, or trigger downloads.
- IndexedDB functions may open, upgrade, inspect, read, write, and delete databases only through explicit adapter exports and injectable `indexedDBRef` arguments.
- FSA functions may select folders, request permission, and read/write folder contents only through explicit adapter exports and injectable `windowRef`/handle arguments.
- Download/archive functions may use `Blob`, `JSZip`, and browser download behavior only through explicit adapter exports and injectable constructors/functions.
- RDF parsing/serialization remains in `rdf-io`; tabular parsing/serialization remains in `tabular-io`; file read/download primitives remain in `browser-file-io`.
- App UIs are responsible for DOM rendering, user prompts, toasts, and policy choices such as whether to delete a legacy database after migration.

## Error Model

The package uses `StorageError` for stable unrecoverable storage and configuration failures. Expected operational failures are represented with stable codes where functions already return result objects, for example File System Access support detection and folder-picker cancellation.

Representative stable codes include:

- `VALIDATION_ERROR`
- `INDEXEDDB_UNAVAILABLE`
- `INVALID_IDB_SCHEMA`
- `IDB_OPEN_FAILED`
- `IDB_OPEN_BLOCKED`
- `IDB_TRANSACTION_FAILED`
- `IDB_TRANSACTION_ABORTED`
- `FILE_SYSTEM_ACCESS_UNAVAILABLE`
- `PROJECT_FOLDER_PICK_CANCELLED`
- `PROJECT_FOLDER_GESTURE_REQUIRED`
- `PROJECT_FOLDER_PERMISSION_DENIED`
- `PROJECT_FILE_TARGET_EXISTS`
- `PROJECT_FILE_SOURCE_NOT_FOUND`
- `PROJECT_FILE_PATH_COLLISION`
- `CRYPTO_UNAVAILABLE`
- `BLOB_UNAVAILABLE`
- `JSZIP_UNAVAILABLE`
- `DOWNLOAD_FUNCTION_REQUIRED`

## Headless Coverage

The package has Jest coverage for:

- Stable and timestamp-based record ids.
- Project, artifact, dataset, run, setting, workspace inclusion, graph, and quad-row normalization.
- Full-IRI JSON-LD record conversion.
- Memory-backed project/artifact/dataset/run/settings/graph/quad stores.
- IndexedDB schema open/upgrade helpers against a mocked IndexedDB implementation.
- Project portfolio store creation and default project initialization.
- Graph workspace planning and quad-row replacement/clear/delete operations.
- RDF/JS quad row conversion for default graph and named graph cases.
- Legacy database inspection, legacy object-store reads, legacy triple conversion, legacy settings conversion, and migration report creation.
- Project manifest creation/normalization.
- Artifact download file naming, artifact Blob creation, project ZIP archive creation, and injected download calls.
- File System Access support detection, picker cancellation, permission lifecycle, folder read/write/list/mkdir/rename/remove behavior, reserved path protection, folder handle registry, folder manifest sync, discovered file reconciliation, artifact staging, and stale derived output marking.

## Remaining Work

This audit closes the 18.11 side-effect boundary step. The remaining work is adoption and validation, not API discovery:

- Complete browser rewiring audits so app UIs call this package rather than local storage helpers.
- Remove remaining local storage duplicates only after each app has been manually validated against real saved sessions.
- Add future CLI/agent adapters for project manifest validation and migration reporting if automation requires them.
- Keep legacy database deletion user-confirmed until TOM, Axiolotl, and Mermaid migrations have been validated with real user data.

## Maturity Rating

- **Side-effect boundary maturity:** Level 5 for documented package API boundaries and test coverage.
- **Cross-app adoption maturity:** Level 4 until all target apps have completed browser rewiring, legacy migration validation, and duplicate deletion.

