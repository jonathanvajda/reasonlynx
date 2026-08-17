# Naming Decisions

## Capability Family

- **Capability family:** IndexedDB and app data management
- **Decision date:** 2026-07-28

## Decision Table

|Decision ID|Old name(s)|Proposed canonical name|Accepted?|Reason|Rejected alternatives|Migration notes|
|:---|:---|:---|:---:|:---|:---|:---|
|NAME-001|`openDb`, `ensureDb`, `initIndexedDB`, `initTripleStore`, `openTableNovaDb`|`openIndexedDbStore(schema)`|Tentative|Action and boundary are clear; accepts schema rather than app constants.|`initDb`, `openDb`, `ensureDb`|App adapters can expose narrower names such as `openAxiolotlWorkspaceDb`.|
|NAME-002|`idbRequest`, `requestToPromise`|`resolveIdbRequest(request)`|Tentative|Names the action and input shape.|`promisifyRequest`, `requestToPromise`|Should live in low-level adapter only.|
|NAME-003|`idbTransactionDone`, `transactionToPromise`, `tx`|`waitForIdbTransaction(transaction)`|Tentative|Names lifecycle boundary clearly.|`txDone`, `finishTransaction`|A higher-level `runIdbTransaction` may supersede direct use.|
|NAME-004|`runInStore`, `tx`|`runObjectStoreTransaction(db, storeName, mode, operation)`|Tentative|Explicit store, mode, operation contract.|`withStore`, `transaction`|Should close DB only if function opened DB itself; clarify ownership.|
|NAME-005|`saveRun`, `putRun`|`storeRunRecord(run)`|Tentative|Generic run persistence without app-specific “diagnostic” or “transformation”.|`saveRun`, `putRun`|App adapters can expose `storeDiagnosticRun` or `storeTransformationRun`.|
|NAME-006|`listRuns`|`listRunRecords(options)`|Tentative|Allows limit, sort, project scope.|`getRuns`, `loadRuns`|Return metadata-only by default; full payload optional.|
|NAME-007|`getRun`, `getRunDataset`|`getRunRecord(runId)`|Tentative|Stable record retrieval action.|`loadRun`|For Table Nova, graph IRI may be a run id.|
|NAME-008|`deleteRun`, `clearAllRuns`|`deleteRunRecord(runId)`, `clearRunRecords(filter)`|Tentative|Single vs batch deletion is explicit.|`removeRun`, `wipeRuns`|`clearRunRecords` should require explicit scope/filter to avoid accidental full deletes.|
|NAME-009|`getSetting`, `saveSetting`, `setSetting`|`readSettingValue(key)`, `writeSettingValue(key, value)`|Accepted|Names the persistence action and output range. Avoids vague stateful `get/set` names while preserving key-value ergonomics.|`getAppSetting`, `setAppSetting`, `loadSetting`, `saveSetting`|Scope is supplied by the settings store factory, e.g. `app:axiolotl` or `project:default-workspace`.|
|NAME-010|`settingsLoad`, `saveOntologySettings`|`readSettingRecord(key)`, `storeSettingRecord(record)`, `listSettingRecords()`|Accepted|Separates value-only reads/writes from full normalized setting records.|`getProjectSettings`, `setProjectSettings`, `loadOntologySettings`, `saveOntologySettings`|TOM can still expose app-local adapters with domain names, but the shared package stores scoped setting records.|
|NAME-011|`buildWorkspaceSnapshot`, `normalizeWorkspaceSnapshot`|`createProjectSnapshot(state)`, `normalizeProjectSnapshot(snapshot)`|Tentative|Applies across TOM, Axiolotl, and future project resume.|`saveWorkspace`, `loadWorkspace`|Domain-specific snapshot builders can wrap generic project snapshots.|
|NAME-012|`idbPutDocuments`, `idbGetEnabledDocuments`|`storeDatasetDocuments(datasetId, docs)`, `listEnabledDatasetDocuments(projectId?)`|Tentative|Names dataset behavior rather than IDB implementation.|`saveDocs`, `loadDocs`|OntoEagle’s built-in/user distinction should be metadata, not separate APIs.|
|NAME-013|`storeTriplesInNamedGraph`|`upsertQuadRows(rows, options)`|Tentative|The store is quad-capable; “triples” is too narrow.|`storeTriples`, `saveGraph`|Support default graph as a graph term option.|
|NAME-014|`getAllTriples`, `getAllGraphNames`|`listQuadRows(filter)`, `listNamedGraphs()`|Tentative|Makes filter shape and graph distinction explicit.|`loadGraph`, `getTriples`|A `loadRdfDataset()` adapter can convert rows into RDF/JS dataset.|
|NAME-015|`deleteExactTriples`, `clearTriples`|`deleteQuadRows(rows)`, `clearQuadRows(filter)`|Tentative|Exact row deletion vs scoped clear is explicit.|`dropTriples`, `wipeGraph`|Require filter/confirmation at app adapter for destructive operations.|
|NAME-016|`saveSavedQuery`, `getAllSavedQueries`|`storeQueryArtifact(record)`, `listQueryArtifacts(filter)`|Tentative|Supports SPARQL/SQL/NoSQL query artifacts across Axiolotl and CQ Ferret.|`saveSavedQuery`, `listSavedQueries`|Use `artifactKind` and `queryLanguage`.|
|NAME-017|Mermaid `createProject`, `saveDiagram`, `deleteDiagram`|`createProject`, `storeProjectArtifact`, `deleteProjectArtifact`|Tentative|Project and artifact language generalizes diagrams, ontologies, reports, queries.|`saveDiagram` as canonical|Mermaid can keep diagram-specific app adapters.|
|NAME-018|Mermaid FSA `writeText`, `readText`, `list`|`writeProjectFile`, `readProjectFile`, `listProjectFiles`|Tentative|Names project file boundary and avoids leaking raw root handle.|`writeText`, `readText`|Only for file-system backend, not IndexedDB core.|
|NAME-019|New workspace graph store reader|`readActiveWorkspaceGraphPlan(stores, projectId)`|Accepted|The function reads stores and returns a plan, not a list of graphs. The name states both action and range.|`listActiveWorkspaceGraphs`|Pure plan construction remains `createActiveWorkspaceGraphPlan(records)`.|
|NAME-020|New graph deletion helper|`deleteGraphRecordWithQuadRows(stores, graphId)`|Accepted|Names the destructive scope exactly: graph metadata plus materialized quad rows.|`deleteGraphWithRows`, `clearGraph`, `wipeGraph`|App adapters should ask for confirmation before calling this.|
|NAME-021|New RDF/JS conversion helpers|`convertRdfJsQuadsToQuadRows(quads, options)`, `convertQuadRowsToRdfJsQuads(rows, DataFactory)`|Accepted|Names are action-oriented and specify both source and range. This avoids treating type-conversion utilities as constructors.|`rdfJsQuadsToQuadRows`, `quadRowsToRdfJsQuads`|`createRdfJsStoreFromQuadRows` remains a constructor-style name because it creates a Store instance.|
|NAME-022|New legacy database status helper|`inspectLegacyIndexedDbDatabase(name, options)`|Accepted|The function inspects IndexedDB status; it does not merely detect a boolean and it does not migrate.|`detectLegacyDatabase`|Use before presenting migration options to users.|
|NAME-023|New legacy row conversion helpers|`convertLegacyTripleRowsToQuadRows(rows, options)`, `convertLegacySettingsToSettingRecords(rows, options)`|Accepted|Avoids app-specific names and states source/range. Conversion is non-destructive; migration is a broader workflow.|`migrateAxiolotlTripleRows`, `migrateLegacySettings`|Axiolotl migration adapters can call these helpers while preserving app-specific labels in migration UI.|

## Notes

- Promoted names should avoid `idb` unless the function is truly a low-level IndexedDB adapter.
- Domain packages should not expose `DB_NAME`, `STORE_NAME`, or browser globals.
- App adapters may retain user-facing names such as “saved runs” or “active workspace” while calling canonical project/data-store functions.
