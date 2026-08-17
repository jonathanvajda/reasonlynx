# Reuse Maturity Ratings

## Capability Family

- **Capability family:** IndexedDB and app data management
- **Date updated:** 2026-08-15

## Maturity Scale

|Level|Name|Meaning|
|:---:|:---|:---|
|0|Local only|App-specific, unclear contract, or tightly coupled to DOM/storage.|
|1|Candidate|Useful behavior exists, but it is under-tested, underspecified, or partially coupled.|
|2|Characterized|Current behavior is documented with representative fixtures and comparison notes.|
|3|Reusable|Function is pure or mostly pure, named by action, has clear JSDoc, and has focused tests.|
|4|Package ready|Function is environment-neutral, has predictable error handling, and separates adapters from core logic.|
|5|Canonical|Shared package is adopted by all intended consumers and local duplicates have been deleted.|

## Rating Table

|ID|Function or package|Current level|Target level|Evidence|Blockers|Next action|Owner|Date updated|
|:---|:---|:---:|:---:|:---|:---|:---|:---|:---|
|MAT-001|OntoEagle dataset cache functions (`idb*`, `importUserOntologyFile`, `loadOntologyWorkspace`)|2|4|Clear domain value; already distinguishes built-in and user datasets; used by several OntoEagle screens.|Adapter is vendor-located at `docs/app/shared/vendor/indexeddb.min.js`, while some callers/service-worker references still point at `./indexeddb.min.js`; storage contracts are implicit; localStorage companion cache mixed with IDB truth; `idbGetAllDocuments` contains unreachable dead-code comments after an early return.|Rehome adapter into the promoted package structure, make DB/schema/store names explicit options, add fixtures for built-in preload, user dataset, enabled filtering, and deletion.|TBD|2026-07-28|
|MAT-002|OntoEagle CQ Ferret `initIndexedDB/readFromIndexedDB/save/delete`|1|3|Stores JSON-LD nodes and autosaves complex CQ artifacts.|Tightly coupled to DOM and vendor `GDCManager`; delete uses key suffix heuristic; save flow is not a clean storage adapter.|Separate JSON-LD node store from CQ form/view model and vendor graph-diff manager.|TBD|2026-07-28|
|MAT-003|OntoEagle vocab extractor node store helpers|2|4|Small CRUD helpers over JSON-LD nodes; row/node mapping has useful validation.|UMD/global exposure; DB config implicit defaults; no tests found.|Extract `jsonld-node-store` adapter and pure row/node mapping tests.|TBD|2026-07-28|
|MAT-004|TOM settings and workspace snapshot functions|3|4|Snapshot normalization has Jest coverage through feature utils; single-project model is clear.|DB functions and DOM/grid state are still mixed; RDF fallback and workspace snapshot stored in separate stores without shared run metadata.|Split pure snapshot model from `IndexedDBProjectStore` adapter.|TBD|2026-07-28|
|MAT-005|Axiolotl settings/query/quad store|2|4|Most complete graph store, query artifacts, workspace stats, and granular deletion.|Inconsistent error behavior; DOM events emitted from storage layer; hard reset has a likely stale `closeAllKnownDbHandles` reference; no storage tests.|Characterize graph row schema and deletion behavior; move events to adapter callbacks.|TBD|2026-07-28|
|MAT-006|OCM saved runs store|3|4|Clean small module, explicit JSDoc, validation, appState last pointer, DB close discipline.|Run payload is app-specific; no generic project/artifact schema; browser-only adapter not fixture-tested in this repo.|Use as candidate for generic run-store contract; add mock IndexedDB tests.|TBD|2026-07-28|
|MAT-007|IRI Swapper RDF/SPARQL run stores|1|3|Two near-identical run history implementations with clear CRUD shape.|Duplicated local code; no validation; no tests; app-specific run ids.|Replace with generic transformation run store after contract definition.|TBD|2026-07-28|
|MAT-008|Table Nova run store|3|4|Small ESM module with JSDoc, explicit run shape, metadata list, transaction helper.|DB handle passed manually; run shape is graph/dataset-specific; no discovered storage fixtures.|Use as candidate for `storeTransformationRun` and graph artifact storage tests.|TBD|2026-07-28|
|MAT-009|Mermaid IndexedDB project/diagram backend|4|4|Explicit project/diagram CRUD backend with mock IndexedDB tests and project concept separation.|Domain is Mermaid diagrams; ID shape differs from RDF/project artifacts.|Use as reference architecture, not direct copy.|TBD|2026-07-28|
|MAT-010|Mermaid File System Access storage and registry|4|4|Structured `StorageError`, lock strategy, handle registry, migration tests.|Browser FSA only; not all OntoEagle apps need folder-backed projects immediately.|Treat as optional `file-system-project-store` adapter after core IDB model.|TBD|2026-07-28|
|MAT-011|Cross-app File System Access project-folder backend|4|5|Shared package now includes app-neutral folder path planning, manifest read/write, artifact writes, recursive scan, manifest/IndexedDB reconciliation, discovered file staging, conflict statuses, and stale-derived-output helpers with Jest coverage.|No ontology app has completed the folder-backed pilot yet; manifest-last batch writes and recovery/audit records are still partial.|Pilot TOM first, then Axiolotl; add manifest-last batch write/recovery before rating canonical.|TBD|2026-08-01|
|MAT-012|IndexedDB/project/graph/settings headless side-effect boundary|5|5|Headless API audit documents pure model functions, injected store abstractions, IndexedDB adapters, FSA adapters, download/archive adapters, error codes, and Jest coverage. Source scan found no DOM, localStorage, fetch, or console coupling in shared package source.|Cross-app adoption remains Level 4 until every app removes local duplicates after browser validation, but the package-side boundary is stable.|Use this package as the canonical storage/model boundary for future app rewiring and deletion passes.|TBD|2026-08-15|

## Promotion Checklist Status

- [x] Function names describe the action, not the source app or one current use case.
- [x] Inputs and outputs are explicit and documented.
- [x] Core logic is pure or mostly pure.
- [x] DOM, storage, file, download, and vendor side effects are behind adapters.
- [x] Error and warning behavior is predictable.
- [x] Representative fixtures exist.
- [x] Jest tests cover happy paths, edge cases, and known invalid inputs.
- [x] Browser, worker, and Node assumptions are documented.
- [x] Dependency and vendor provenance is documented.

## Notes

- Axiolotl and OntoEagle should be demanding pilots because they exercise graph storage and dataset preload/user dataset distinctions.
- Mermaid should influence maturity expectations for this cycle. A promoted project/artifact package should have tested create, list, rename/update, delete, nested-artifact listing, cascade/delete behavior, and backend-boundary tests before being rated package-ready.
- Mermaid should not inflate the maturity rating of ontology-specific stores. It provides a strong project-management benchmark, while RDF datasets, quads, preload/user dataset distinctions, and ontology workspace hydration still need fixtures from OntoEagle and Axiolotl.
- Pilot migration plans now exist for Axiolotl and TOM. These plans keep legacy discovery/export/migration non-destructive while targeting a clean shared storage architecture after user validation.
- File System Access promotion planning now has a package implementation for the shared project-folder layer. Cross-app folder storage is not canonical until TOM and Axiolotl pilots validate the package against real app workflows and old local persistence is removed.
- The shared package is canonical for the data-management side-effect boundary. App migrations can still remain below Level 5 until local duplicates are deleted and browser validation is complete.
- 18.11 documents the stable public API groups in `headless-api-audit.md`. IndexedDB, File System Access, download/archive, crypto, and Web Locks are accepted adapter boundaries; DOM, localStorage, fetch, app logging, RDF parsing, and tabular parsing are out of scope for this package.
