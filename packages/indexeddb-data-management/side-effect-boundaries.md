# Side-Effect Boundaries

## Capability Family

- **Capability family:** IndexedDB and app data management
- **Boundary date:** 2026-08-15

## Boundary Table

|ID|Function/group|Current category|Target category|Side effects|Reads from|Writes to|Adapter needed?|Worker-safe?|Node-safe?|Notes|
|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
|BOUND-001|ID generation (`stableDatasetId`, OCM/IRI `makeRunId`, Mermaid `projectIds`)|Pure core|Pure core|None.|Explicit strings/timestamps.|Return ids.|No|Yes|Yes|Should be deterministic where possible and collision-safe where needed.|
|BOUND-002|Record normalization (`normalizeWorkspaceSnapshot`, saved query row mapping, Table Nova metadata projection)|Mixed pure/app state|Pure core|Some current functions read grid/global state.|Objects/arrays.|Return normalized records.|Yes|Yes|Yes|Separate `createSnapshotFromAppState` from pure `normalizeProjectSnapshot`.|
|BOUND-003|IndexedDB open/upgrade (`ensureDb`, `openDatabase`, `initTripleStore`, Mermaid backend open)|Storage adapter|Storage adapter|Creates/upgrades DB and indexes.|Schema descriptor.|DB handle.|Yes|No|No|Shared adapter should accept schema and return explicit errors.|
|BOUND-004|Transaction helpers (`requestToPromise`, `idbTransactionDone`, `tx`, `runInStore`)|Storage adapter|Storage adapter|Attaches request/transaction callbacks.|IDBRequest/IDBTransaction.|Promise result.|Yes|No|No|Package can provide a small native IndexedDB promise layer or wrap `idb`.|
|BOUND-005|Settings storage|Storage + DOM events|Storage adapter plus app event adapter|Reads/writes IDB; Axiolotl dispatches DOM events.|Settings store.|Settings store and DOM events.|Yes|No|No|Move DOM notification to app layer callback.|
|BOUND-006|Dataset cache storage|Storage + RDF parse orchestration|Storage adapter plus domain service|Reads files/fetch, parses RDF, writes IDB/localStorage.|File/fetch/IDB/localStorage.|IDB docs/meta; localStorage snapshots.|Yes|No|No|Parsing belongs to RDF package; storage service should receive normalized records.|
|BOUND-007|Run history storage|Storage adapter|Storage adapter|Reads/writes/deletes runs.|Run records.|Runs store and appState pointer.|Yes|No|No|Generic run store should not know diagnostics, IRI mapping, or tabular conversion internals.|
|BOUND-008|RDF quad store|Storage adapter with RDF row normalization|Storage adapter plus RDF adapter|Writes row-indexed quads; dispatches events now.|RDF/JS terms or row objects.|Quad store.|Yes|No|No|A pure row normalizer can be worker/node-safe; IndexedDB adapter is browser-only.|
|BOUND-009|JSON-LD node store|Storage adapter plus domain mapping|Storage adapter and pure mapper|Reads/writes nodes; some functions rebuild vocabulary using POS tagger.|IndexedDB graph nodes.|IndexedDB graph nodes.|Yes|No|No|CQ/Vocab graph mapping should be pure; POS tagger is vendor adapter.|
|BOUND-010|Project/artifact CRUD|Storage adapter|Storage adapter plus pure project model|Creates/deletes projects and artifacts.|Project/artifact DTOs.|IDB project/artifact stores.|Yes|No|No|Mermaid is reference model.|
|BOUND-011|File System Access project storage|Browser adapter|Optional browser adapter|Folder picker, permission, atomic writes, folder scans, manifest sync, handle registry.|FSA handles/files.|FSA files and handle registry.|Yes|No|No|Implemented inside the package as an explicit optional browser adapter. It remains outside the pure core and is invoked only through FSA exports.|
|BOUND-012|DOM loaders/renderers (`refreshRunsDropdown`, `renderSavedQuerySidebar`, TOM reload UI)|DOM adapter|DOM adapter|Reads DOM, mutates controls, shows toasts.|Storage APIs and DOM.|DOM.|Yes|No|No|Must not be in shared storage core.|

## Side-Effect Rules for This Capability

- Pure core may define project, dataset, run, artifact, graph, and settings record shapes.
- Pure core may generate stable ids and normalize/validate records.
- IndexedDB adapters may open databases, run transactions, and convert IDB errors into structured storage results.
- DOM adapters may subscribe to storage results and dispatch UI events, but storage functions should not dispatch `CustomEvent` directly.
- RDF parsing/serialization remains in `rdf-io`; tabular parsing/serialization remains in `tabular-io`.
- File reading/download remains in `browser-file-io`.
- File System Access is implemented as an optional browser folder backend. It shares project/artifact manifest vocabulary with IndexedDB but remains adapter-bound.

## Refactor Plan

|Refactor ID|Problem|Target boundary|Affected functions|Required tests|Migration notes|
|:---|:---|:---|:---|:---|:---|
|REF-001|Repeated DB open/transaction boilerplate.|IndexedDB adapter.|TOM `ensureDb`, OCM `openDatabase/runInStore`, IRI `openDb`, Table Nova `openTableNovaDb`, Axiolotl `init*`.|Mock IndexedDB open/upgrade/error/transaction tests.|Use schema descriptor to prevent app constants from leaking.|
|REF-002|Run stores duplicated across OCM, IRI Swapper, Table Nova.|Run-store adapter plus run record model.|OCM `saveRun/listRuns`, IRI `putRun/listRuns`, Table Nova `putRun/listRuns`.|CRUD tests with sorting, limit, delete, last pointer.|App-specific payload schemas stay in app/domain packages.|
|REF-003|Axiolotl graph store mixes row normalization, storage, DOM events.|Quad-store adapter plus app event adapter.|Axiolotl `storeTriplesInNamedGraph`, `clearTriples`, `getAllTriples`.|Quad row fixtures: default graph, named graph, literal language/datatype, blank node.|Rename to quad terminology.|
|REF-004|OntoEagle dataset preload/user data orchestration mixes parse, storage, localStorage snapshot.|Dataset service plus adapters.|OntoEagle `importUserOntologyFile`, `loadOntologyWorkspace`, `ensureBuiltinDataset`.|Fixtures for built-in stale fingerprint, user import, enabled/disabled merge.|Keep built-in/user distinction as metadata.|
|REF-005|Project/artifact hierarchy absent from most apps.|Project-store and artifact-store models.|TOM, OntoEagle, Axiolotl, Table Nova, IRI Swapper, OCM.|Project with ontology/data/query/report/diagram artifacts; latest pointer; deletion cascade.|Mermaid is architecture reference.|
|REF-006|File/folder project storage was mature only in Mermaid.|Optional FSA backend.|Mermaid `storage.js`, `fsaRegistry.js`; shared `file-system-access.js`, `project-folder-sync.js`, `project-folder-handle-store.js`.|Permission, lock, write/read/list, migration, scan/reconcile, and stale-derived-output tests.|Shared package now has the backend; app UI adoption remains incremental.|

## Notes

- The clean package boundary is not “IndexedDB functions” alone. The reusable asset is a project data model plus storage adapters.
- Axiolotl likely needs a specialized quad store package adjacent to, not inside, a generic project store.
- 18.11 audit result: no shared source uses DOM, localStorage, fetch, or console logging. IndexedDB, File System Access, Blob/JSZip, crypto, and Web Locks dependencies are confined to named adapter functions with injectable runtimes where practical.
