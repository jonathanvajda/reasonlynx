# File System Access Promotion Plan

## Scope

- **Source reference app:** Mermaid (`D:\GitHub\mermaid`)
- **Capability family:** IndexedDB and app data management
- **Target package:** `@ontoeagle/indexeddb-data-management`
- **Status:** Shared package implementation in progress. No app rewiring yet.

The File System Access capability should let any app save durable project work to a user-designated local folder while preserving the same project/artifact/run/settings model used by IndexedDB.

## Conclusion

Mermaid's implementation is not just a stub. It has a real capability boundary and enough test evidence to promote several pieces:

- File/folder path sanitization.
- Storage errors with stable codes.
- Text/byte read/write helpers.
- Atomic-ish write behavior with temp files and `move()` fallback.
- Web Locks with a Promise-chain fallback.
- Folder permission lifecycle.
- File/folder list, rename, remove, and mkdir operations.
- An IndexedDB-backed registry for persisted `FileSystemDirectoryHandle` records.
- Migration from an older single-root handle model to per-project handles.

What should not be promoted unchanged:

- Mermaid branding constants.
- Mermaid-only `.mmd` layout assumptions.
- Mermaid-specific project/diagram routing.
- Root folder policy tied to `MermaidIDE`.
- UI concepts, prompts, reconnect banners, and modal flows.

## Current Mermaid FSA Capabilities

|Current module|Current functions/concepts|Promotion assessment|
|:---|:---|:---|
|`src/storage/storage.js`|`Storage.init`, `pickRoot`, `ensurePermission`, `isReady`, `hasRoot`, `rootName`, `readText`, `readBytes`, `writeText`, `writeBytes`, `rename`, `remove`, `mkdir`, `list`, `on`|Promote as generic project-folder access adapter, after removing Mermaid-specific constants and root-folder policy.|
|`src/storage/sanitize.js`|`sanitizeName`, `splitPath`, `lockKey`, `guardPublicPath`|Promote nearly directly. Rename for project-file context where needed.|
|`src/storage/StorageError.js`|`StorageError` with `code` and `detail`|Already conceptually matches the shared package error model. Use the package `StorageError` rather than duplicating.|
|`src/storage/handlesDb.js`|Opens `MermaidIDE.handles`; stores legacy handle, FSA projects, audit log.|Promote the pattern, not constants. The shared package needs configurable DB/store names.|
|`src/storage/fsaRegistry.js`|`init`, `list`, `get`, `add`, `update`, `remove`, `clear` for FSA project handle rows.|Promote as `createProjectFolderHandleStore()` or equivalent.|
|`src/storage/migration.js`|Migrates legacy root handle into per-project handle records.|Keep as Mermaid-specific migration example. Shared migration helpers can support the pattern but should not assume Mermaid folders.|
|`tests/storage/*.test.js`|Mock FSA and IDB tests for sanitize, storage, registry, audit, concurrency, migration.|Use as the baseline test corpus for promotion.|

## Recommended Shared Boundary

The shared package should expose two layers:

```text
FileSystemAccessAdapter
  low-level browser capability boundary

ProjectFolderStore
  project/artifact-oriented file layout over a selected folder
```

The low-level adapter owns browser handles. App code should not receive `FileSystemDirectoryHandle` or `FileSystemFileHandle` except in tests.

## Proposed Canonical API

### Feature and permission lifecycle

```js
detectFileSystemAccessSupport()
readProjectFolderPermission(handleRecord)
requestProjectFolderPermission(handleRecord)
selectProjectFolder(options)
initializeProjectFolderAccess(handleStore, options)
```

Notes:

- `detectFileSystemAccessSupport()` should return a structured result, not throw, because non-Chromium browsers need graceful fallback.
- `selectProjectFolder()` is the only function that calls `window.showDirectoryPicker`.
- Permission prompts must remain app/UI initiated. Storage functions can report `gesture_required`, `permission_denied`, and `not_ready`.

### Folder handle registry

```js
createProjectFolderHandleStore(adapter, options)
storeProjectFolderHandleRecord(record)
readProjectFolderHandleRecord(handleId)
listProjectFolderHandleRecords(filter)
updateProjectFolderHandleRecord(handleId, patch)
deleteProjectFolderHandleRecord(handleId)
```

Suggested record:

```js
{
  handleId: 'fsa:uuid',
  projectId: 'project:x',
  label: 'Client ontology folder',
  handle: FileSystemDirectoryHandle,
  rootPath: '',
  dataPath: 'ontology-workbench',
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z',
  metadata: {
    appIds: ['tom', 'axiolotl'],
    appMarker: 'ontology-workbench.v1'
  }
}
```

This registry must live in IndexedDB because browser file handles are not serializable to ordinary files.

### Project file operations

```js
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
```

These are the clean promotion candidates from Mermaid's `Storage` API. The names should be project/file oriented rather than generic `Storage.writeText`.

### Project/artifact export to folder

```js
writeProjectManifestToFolder(folderStore, manifest, options)
writeProjectArtifactToFolder(folderStore, artifact, payload, options)
writeProjectArchiveToFolder(folderStore, projectExport, options)
readProjectManifestFromFolder(folderStore, options)
readProjectArtifactsFromFolder(folderStore, manifest, options)
```

These are the important expansions beyond Mermaid. Ontology apps need a consistent on-disk layout for RDF, tabular, SPARQL, Mermaid, SHACL, reports, mappings, and project manifests.

## Recommended Folder Layout

Use a folder selected by the user, then keep app data under a visible subfolder:

```text
<chosen-folder>/
  ontology-workbench/
    project-manifest.json
    artifacts/
      source/
      staged/
      generated/
      transformed/
      reports/
      queries/
      diagrams/
      mappings/
    graphs/
      default.nq
      named/
    settings/
      project-settings.json
      namespace-profiles.json
    runs/
      run-history.json
    .app/
      version
      audit.log
      checksums.json
```

Rules:

- `project-manifest.json` is the portable truth for project export/import.
- Artifacts use the shared format registry and browser file IO utilities for extensions and MIME types.
- RDF graph rows may be stored as `.nq` or `.jsonl` depending query needs; serialized RDF artifacts remain separate from materialized graph cache files.
- `.app/` is reserved for implementation metadata and should not be writable through public artifact APIs.
- The package should support alternative `dataPath` values so apps can use app-branded folders while preserving the same internal layout.

## How This Expands Mermaid's Current Model

|Need|Why Mermaid is not enough by itself|Required expansion|
|:---|:---|:---|
|Multiple artifact kinds|Mermaid writes `.mmd`; ontology apps need RDF, CSV/TSV/XLSX, SPARQL, SHACL, R2RML, JSON-LD, reports, mapping tables, project zips.|Add artifact-kind-aware file path and extension resolution using `format-registry` and `browser-file-io`.|
|Project manifest|Mermaid project identity is routed through app concepts and FSA registry; cross-app projects need portable folder metadata.|Write/read `project-manifest.json` using the existing project manifest shape.|
|Cross-app contribution|Mermaid app owns diagrams; project folders should accept artifacts from TOM, Axiolotl, OntoEagle, IRI Swapper, Table Nova, OCD, and Mermaid.|Use app-neutral artifact directories and provenance fields.|
|Graph materialization|Mermaid has no RDF quad-store requirement.|Support graph export/import files and links from `GraphRecord` to on-disk materialization.|
|Settings and profiles|Mermaid stores autosave/theme separately; ontology apps need user profile, ontology profile, namespace profiles, and IRI reservations.|Persist profile/settings JSON under `settings/` and mirror essential pointers in IndexedDB.|
|Handle registry portability|FSA handles cannot be included in project ZIPs and may expire by browser permission policy.|Keep the folder-handle registry as local browser state; include only logical project metadata in the manifest.|
|Partial write recovery|Mermaid writes individual diagrams; ontology projects may write many files per save/export.|Add batch write planning, manifest-last commit, and recovery/audit records.|

## Recommended Batch Write Model

Multi-file project saves should use a manifest-last strategy:

```text
1. Build a write plan.
2. Write payload files to temp paths.
3. Move/copy temp files into final paths.
4. Write checksums.
5. Write project-manifest.json last.
6. Append audit entry.
```

Promotable function candidates:

```js
createProjectFolderWritePlan(project, artifacts, options)
writeProjectFolderFiles(folderStore, writePlan, options)
commitProjectFolderManifest(folderStore, manifest, options)
readProjectFolderRecoveryState(folderStore, options)
```

This avoids making project folders look complete when a browser crashes halfway through a multi-file save.

## Error Model

Use shared `StorageError` codes:

```text
fsa_unavailable
not_ready
no_root
gesture_required
permission_denied
bad_path
bad_name
empty_path
empty_segment
separator
traversal
forbidden_char
reserved
reserved_path
too_long
path_too_long
path_collision
source_not_found
target_exists
not_empty
move_unsupported
rename_orphan
bad_data_type
manifest_invalid
write_plan_failed
```

Apps should translate these into UI messages. The package should not call `alert`, `confirm`, `prompt`, toast APIs, or write directly to the DOM.

## Rollout Recommendation

1. Promote pure path utilities and FSA `StorageError` coverage first.
2. Promote handle registry with mock IndexedDB tests.
3. Promote low-level project file read/write/list/mkdir/rename/delete operations.
4. Promote manifest read/write and artifact-to-folder layout helpers.
5. Add one pilot app:
   - Mermaid if keeping its current FSA implementation aligned with the shared package.
   - TOM if testing ontology project folders.
   - Table Nova or IRI Swapper if testing transformed run output folders.
6. Only after one pilot passes, wire Axiolotl because graph materialization and query artifacts create the broadest test surface.

## App Adoption Targets

|App|FSA value|Initial folder-backed artifacts|
|:---|:---|:---|
|TOM|High|Ontology table snapshot, ontology settings, generated RDF, namespace profiles.|
|Axiolotl|High|RDF datasets/graphs, saved SPARQL queries, query results, inference overlays.|
|OntoEagle|Medium-high|User-added ontologies, IRI bundles, generated ontology slims, project catalog selections.|
|CQ Ferret|Medium|JSON-LD/RDF CQ artifacts, CSV imports/exports, Mermaid diagrams, queries.|
|IRI Swapper|High|Source RDF/SPARQL, mapping table, transformed output, run report.|
|Table Nova|High|Source tabular file, parsed records, generated RDF, naive ontology output.|
|OCD/OCM|Medium|Input ontology, diagnostic report, measurement report.|
|Mermaid|Already present|Mermaid diagrams and project folders; should be aligned to shared naming and manifest conventions.|
|Visual Lynx / Linked Data Transformer|Medium|RDF source, transformed RDF, Mermaid/D3 JSON outputs.|
|Ontology Tabulator|Medium|Ontology RDF source, tabular output.|
|SPARQL Pattern Visualizer|Low-medium|SPARQL query artifacts and visual outputs once persistence exists.|

## Test Requirements

Promoted FSA package tests should cover:

- Unsupported browser feature detection.
- Permission states: prompt, granted, denied, gesture-required.
- Path sanitization corpus, including Windows reserved names and traversal.
- Read/write text and bytes.
- Atomic write fallback when `move()` is unavailable.
- List sorting and hidden-file handling.
- Rename collision and missing source.
- Recursive and non-recursive delete behavior.
- Reserved `.app/` write rejection.
- Handle registry add/list/get/update/delete.
- Project manifest write/read round trip.
- Multi-file project write where manifest is committed last.
- Recovery behavior after a simulated partial write.

## Promotion Maturity

|Component|Current maturity|Target maturity|Rationale|
|:---|:---:|:---:|:---|
|Path sanitization|4|5|Mermaid has tests and pure functions; needs package naming and cross-app import.|
|Low-level FSA read/write/list/mutation|4|5|Implementation is strong but needs app-neutral constants and package integration.|
|Handle registry|4|5|Pattern is correct; needs generic record names and shared IndexedDB adapter.|
|Project folder manifest/artifact layout|4|5|Folder-backed path planning, manifest read/write, artifact writes, scans, reconciliation, discovered file staging, conflict statuses, and stale-output helpers are implemented with Jest coverage.|
|Batch project save/recovery|2|4|Manifest-last policy is documented; multi-file write planning, recovery state, and audit records still need implementation before app rollout depends on them.|
|Cross-app FSA adoption|1|5|No ontology app is wired yet.|

## Decision

Promote FSA as a backend adapter for the project/artifact package, not as a separate app feature.

```text
IndexedDB = default browser persistence and handle registry.
FSA = optional user-selected local-folder backend for durable project files.
Project/artifact/run/settings records = shared logical model across both.
```

This gives users a local folder workflow without forcing every app to invent its own file picker, path sanitizer, folder layout, permission recovery, or save/export rules.
