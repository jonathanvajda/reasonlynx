# Project Data Management Strategy

## Objective

Create a shared storage architecture that can support:

- Project portfolios.
- Projects containing ontologies, loaded data, staged work, transformed data, reports, queries, diagrams, mappings, and settings.
- Multiple artifact formats: RDF, tabular, Mermaid, SPARQL, SHACL, R2RML, SQL, NoSQL query definitions, reports, and binary/source files.
- RDF datasets represented as quads, with triple-only views treated as default-graph projections.

## Recommended Concept Model

```text
Portfolio
  UserProfile
  UserSettings
  UserNamespaceProfiles
  UserIriReservationRegistry
  Project
    ProjectSettings
    AppProjectSettings
    Dataset
      SourceArtifact
      LoadedArtifact
      StagedArtifact
      TransformedArtifact
    GraphStore
      QuadRows
      NamedGraphs
    QueryArtifact
    DiagramArtifact
    ReportArtifact
    OperationRun
```

## Record Types

## JSON-LD Storage Vocabulary

Project portfolio data should move toward compact JSON-LD records instead of app-specific DTO keys at durable storage and import/export boundaries. Plain JS fields can remain accepted as migration inputs, but the shared vocabulary should reuse existing RDF terms wherever there is a good match.

Recommended mappings:

|Current DTO field|Canonical JSON-LD key|Reason|
|:---|:---|:---|
|`label`|`dcterms:title` for projects/artifacts/datasets/runs; `rdfs:label` for graph labels|Uses existing descriptive metadata terms instead of app-local naming.|
|`createdAt`|`dcterms:created` with `xsd:dateTime` typed value|Portable timestamp metadata.|
|`updatedAt`|`dcterms:modified` with `xsd:dateTime` typed value|Portable modification timestamp metadata.|
|`mediaType`|`dcterms:format`|Existing term for file/content format.|
|setting `value`|`rdf:value`|Existing RDF value-bearing property.|
|record identifiers|`@id` plus `dcterms:identifier` typed as `xsd:string`|`@id` is the JSON-LD node identity; `dcterms:identifier` preserves the stored/system identifier as data about the node.|
|record kind|`@type`|JSON-LD-native type.|

Use established vocabularies first: BFO/CCO for upper/domain ontological typing, DCTERMS for bibliographic/record metadata, and SKOS/RDFS for labels and notes. PROV and DCAT should not be preferred over BFO/CCO in this architecture. The Ontology of Knowledge Engineering Artifacts prefix `okea:` is reserved for concepts that are not already covered well by those vocabularies. New classes, datatype properties, and object properties should be curated into that ontology incrementally rather than minted in a package-private namespace.

Project convention: app data may use CCO `cco2:ont00001765` (`has text value`) as the generic text-literal predicate even when the subject is not an information bearing entity. This intentionally ignores CCO's narrow `rdfs:domain` axiom for this predicate in project data modeling. Do not replace it with `rdf:value`, PROV/DCAT terms, or a newly minted OKEA property without an explicit ontology/modeling decision.

```js
{
  "@context": {
    "cceo": "http://www.ontologyrepository.com/CommonCoreOntologies/",
    "cco2": "https://www.commoncoreontologies.org/",
    "dcterms": "http://purl.org/dc/terms/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "okea": "https://github.com/jonathanvajda/okea/"
  },
  "@id": "artifact:example",
  "@type": "cco2:ont00000958",
  "dcterms:identifier": {
    "@value": "artifact:example",
    "@type": "xsd:string"
  },
  "dcterms:title": "source ontology.ttl",
  "dcterms:format": "text/turtle",
  "okea:artifactKind": "ontology-rdf",
  "okea:role": "source"
}
```

Implementation note: current IndexedDB stores still use DTO keyPaths such as `projectId`, `artifactId`, `datasetId`, `runId`, `graphId`, and `settingId`. Pure JSON-LD storage requires either out-of-line keys or JSON-LD-compatible key paths. Until that migration is planned and tested, package functions should convert between accepted DTO input and canonical JSON-LD output.

### ProjectRecord

```js
{
  projectId: 'project:...',
  label: 'Ontology cleanup workspace',
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
  storageBackend: 'indexeddb', // indexeddb | fsa | opfs
  activeArtifactId: 'artifact:...',
  tags: [],
  metadata: {}
}
```

### ArtifactRecord

```js
{
  artifactId: 'artifact:...',
  projectId: 'project:...',
  artifactKind: 'ontology' // ontology | rdf-dataset | tabular-dataset | sparql-query | sql-query | shacl | r2rml | mermaid-diagram | report | mapping | export
  role: 'source',          // source | loaded | staged | transformed | report | setting
  label: 'uploaded ontology.ttl',
  mediaType: 'text/turtle',
  extension: 'ttl',
  createdAt: '...',
  updatedAt: '...',
  source: {
    origin: 'upload',      // builtin | upload | generated | imported-folder | remote
    fileName: 'ontology.ttl',
    fingerprint: 'sha256:...'
  },
  storageRef: {
    backend: 'indexeddb',
    storeName: 'artifacts',
    key: 'artifact:...'
  },
  provenance: {
    derivedFrom: ['artifact:source'],
    operationId: 'run:...'
  },
  summary: {
    rowCount: 0,
    quadCount: 0,
    namedGraphCount: 0
  }
}
```

### DatasetRecord

```js
{
  datasetId: 'dataset:...',
  projectId: 'project:...',
  source: 'builtin',       // builtin | user | generated
  enabled: true,
  label: 'OntoEagle built-in graph',
  schemaVersion: 1,
  fingerprint: 'sha256:...',
  documentCount: 0,
  ontologyCount: 0,
  updatedAt: 0
}
```

### QuadRow

```js
{
  subject: 'http://example.org/s',
  subjectType: 'NamedNode',
  predicate: 'http://example.org/p',
  predicateType: 'NamedNode',
  object: 'literal or iri',
  objectType: 'Literal',
  objectLang: '',
  objectDatatype: 'http://www.w3.org/2001/XMLSchema#string',
  graph: null              // null/default graph, or named graph IRI
}
```

Decision: use `null` or a formal default-graph sentinel at the canonical boundary. App adapters can migrate Axiolotl’s current empty-string default graph representation.

### RunRecord

```js
{
  runId: 'run:...',
  projectId: 'project:...',
  runKind: 'diagnostic',   // diagnostic | transformation | import | export | inference | query | generation
  label: 'IRI swap 2026-07-28',
  createdAt: '...',
  inputArtifactIds: [],
  outputArtifactIds: [],
  payload: {},
  uiState: null
}
```

### SettingRecord

Settings need to cover browser-wide preferences, user defaults, app-scoped defaults, project-scoped defaults, and artifact-scoped working preferences without creating one database schema per app.

```js
{
  settingId: 'user:local::theme',
  scope: 'user:local',        // user:local | app:<appId> | project:<projectId> | artifact:<artifactId>
  key: 'theme',
  value: 'light',
  appId: '',
  updatedAt: '2026-07-31T00:00:00.000Z',
  metadata: {}
}
```

Recommended shared settings:

|Scope|Key|Default|Purpose|
|:---|:---|:---|:---|
|`user:local`|`theme`|`light`|Browser/device preference for light/dark mode.|
|`user:local`|`language`|`en`|Browser/device language preference.|
|`user:profile`|`creator.name`|`''`|Default creator string for RDF metadata; maps to `dcterms:creator`.|
|`user:profile`|`creator.githubRepository`|`''`|Default GitHub repository for the creator/user.|
|`user:profile`|`contributors`|`[]`|Default contributor strings; maps to repeated `dcterms:contributor`.|
|`user:ontology-profile`|`baseIri`|`''`|Default base IRI used by ontology-generating apps.|
|`user:ontology-profile`|`iriSchema`|`''`|Default IRI construction policy, such as slug, UUID, numeric id, or curated id.|
|`user:ontology-profile`|`ontologyGithubRepository`|`''`|Default repository for generated or curated ontologies.|

Recommended app/project settings:

|Scope|Key|App examples|Purpose|
|:---|:---|:---|:---|
|`app:ontoeagle` or `project:<id>`|`searchOptions`|OntoEagle|Checked search options: exact/wildcard/type filters/include definition/citation/example/clarification.|
|`app:ontoeagle` or `project:<id>`|`namespaceSearchFilters`|OntoEagle|Saved user-defined namespace or prefix filters for search.|
|`app:axiolotl` or `project:<id>`|`sparqlEndpoint`|Axiolotl|Endpoint URL/auth/default query settings where applicable.|
|`app:axiolotl` or `project:<id>`|`sparqlPrefixAssertions`|Axiolotl|User-defined prefix assertions for SPARQL query editing.|
|`project:<id>`|`ontologyPrefixAssertions`|TOM|User-defined prefix assertions for generated ontology files.|
|`project:<id>`|`ontologySettings`|TOM|Ontology metadata, imports, base IRI, IRI schema, and TOM ontology-generation settings.|
|`app:iri-swapper` or `project:<id>`|`rdfPrefixAssertions`|IRI Swapper|User-defined prefixes for ontology/RDF rewrite jobs.|
|`app:iri-swapper` or `project:<id>`|`mappingPrefixAssertions`|IRI Swapper|User-defined prefixes for mapping-table interpretation.|
|`app:iri-swapper` or `project:<id>`|`sparqlPrefixAssertions`|IRI Swapper SPARQL page|User-defined prefixes for query rewrite jobs.|

Prefix assertions should be user-scoped or project-scoped data, not merged into the canonical namespace registry. The namespace registry defines stable known prefixes and IRIs; user prefix assertions define local working aliases. They may intentionally conflict across projects or artifacts.

Recommended `NamespaceAssertionProfile` artifact or setting shape:

```js
{
  profileId: 'namespace-profile:project-x:tom',
  scope: 'project:project-x',
  appId: 'tom',
  contextKind: 'ontology',       // ontology | sparql | mapping | search | rdf
  assertions: [
    {
      prefix: 'cco',
      namespaceIri: 'https://www.commoncoreontologies.org/',
      source: 'user',
      status: 'active',
      notes: ''
    },
    {
      prefix: 'ns1',
      namespaceIri: 'http://example.org/private/',
      source: 'user',
      status: 'active',
      notes: 'Project-local alias'
    }
  ],
  conflictPolicy: 'prefer-project', // prefer-project | prefer-artifact | prompt | preserve-all
  updatedAt: '2026-07-31T00:00:00.000Z'
}
```

For persistence, small namespace profiles can live as `SettingRecord` values. If users begin managing many named profiles, they should become `ArtifactRecord` values with `artifactKind: 'namespace-profile'`.

### IriReservationRecord

IRI reservation is durable user/project data and should be modeled separately from namespace prefix assertions. It is closer to a personal or project IRI registry.

```js
{
  reservationId: 'iri-reservation:sha256...',
  scope: 'user:local',           // user:local | project:<projectId>
  iri: 'http://example.org/ontology/ExampleClass',
  status: 'taken',               // available | reserved | taken
  deprecated: false,
  curatedIn: [
    'http://example.org/ontology'
  ],
  label: 'Example class',
  source: 'user',                // user | imported-ontology | generated | migrated
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z',
  metadata: {}
}
```

Open design decision: start IRI reservations as project/user artifacts or add a dedicated `iriReservations` store. A dedicated store is justified if TOM, OntoEagle Bundler, Axiolotl, and IRI Swapper all need fast lookup by IRI. Otherwise, storing a registry artifact is simpler for import/export.

Recommendation for the IndexedDB package:

```text
Phase 1: store IRI reservation registries as project/user artifacts.
Phase 2: add an indexed iriReservations store only after at least two apps need fast lookup/update by IRI.
```

## Package Split

```text
packages/indexeddb-data-management/
  src/
    core/
      project-record.js
      artifact-record.js
      dataset-record.js
      run-record.js
      quad-row.js
      id-generation.js
      validation-result.js
    indexeddb/
      open-indexed-db-store.js
      run-object-store-transaction.js
      request.js
      schema.js
    stores/
      project-store.js
      artifact-store.js
      dataset-store.js
      run-store.js
      settings-store.js
      iri-reservation-store.js
      quad-store.js
    browser/
      storage-events.js
      local-storage-key-value-store.js
    fsa/
      file-system-project-store.js
```

## Canonical Function Set

### Low-level IndexedDB adapter

```js
openIndexedDbStore(schema)
runObjectStoreTransaction(db, storeName, mode, operation)
resolveIdbRequest(request)
waitForIdbTransaction(transaction)
deleteIndexedDbDatabase(name)
```

### Project and artifact store

```js
createProject(record, options)
updateProject(projectId, patch)
listProjects(options)
getProject(projectId)
deleteProject(projectId, options)

storeProjectArtifact(record, payload, options)
getProjectArtifact(artifactId, options)
listProjectArtifacts(projectId, filter)
deleteProjectArtifact(artifactId, options)

storeProjectArtifactData(stores, record, payload)
resolveArtifactDownloadFormat(artifact)
createArtifactDownloadFileName(artifact)
createArtifactDownloadBlob(artifact)
downloadProjectArtifact(artifact, options)
createProjectArchiveBlob(project, artifacts, options)
downloadProjectArchive(project, artifacts, options)
```

### Dataset and graph store

```js
storeDatasetRecord(record)
listDatasetRecords(projectId, filter)
setDatasetEnabled(datasetId, enabled)
deleteDataset(datasetId)

storeWorkspaceInclusion(record)
getWorkspaceInclusion(inclusionId)
listWorkspaceInclusions(projectId, filter)
setWorkspaceInclusionEnabled(inclusionId, enabled)
deleteWorkspaceInclusion(inclusionId)

upsertQuadRows(projectId, rows, options)
listQuadRows(projectId, filter)
listNamedGraphs(projectId)
countQuadRows(projectId, filter)
deleteQuadRows(projectId, rows)
clearQuadRows(projectId, filter)

createActiveWorkspaceGraphPlan(projectId, inclusions, graphs, artifacts)
readActiveWorkspaceGraphPlan(stores, projectId)
storeGraphQuadRows(stores, graphRecord, rows, options)
replaceGraphQuadRows(stores, graphRecord, rows, options)
clearGraphQuadRows(stores, graphId, options)
deleteGraphRecordWithQuadRows(stores, graphId)

convertRdfJsQuadsToQuadRows(quads, options)
convertQuadRowsToRdfJsQuads(rows, DataFactory)
createRdfJsStoreFromQuadRows(rows, StoreConstructor, DataFactory)
```

### Run and settings store

```js
storeRunRecord(record)
listRunRecords(projectId, options)
getRunRecord(runId)
deleteRunRecord(runId)
getLastRunId(projectId, runKind)
setLastRunId(projectId, runKind, runId)

readSettingValue(key, fallbackValue)
writeSettingValue(key, value)
storeSettingRecord(record)
readSettingRecord(key)
deleteSettingRecord(key)
listSettingRecords()
normalizeSettingRecord(record)
createScopedSettingKey(scope, key)

inspectLegacyIndexedDbDatabase(name, options)
readLegacyObjectStoreRows(name, storeName, options)
convertLegacyTripleRowsToQuadRows(rows, options)
convertLegacySettingsToSettingRecords(rows, options)
createLegacyMigrationReport(input)
```

### User profile, namespace profile, and IRI reservation stores

```js
storeNamespaceAssertionProfile(record)
readNamespaceAssertionProfile(profileId)
listNamespaceAssertionProfiles(filter)
deleteNamespaceAssertionProfile(profileId)

storeIriReservation(record)
readIriReservation(iri, options)
listIriReservations(filter)
markIriReserved(iri, options)
markIriTaken(iri, options)
markIriDeprecated(iri, options)
deleteIriReservation(iri, options)
```

These functions are not implemented yet. They should be added only after the current project/settings store work is stable enough to avoid another partial bridge.

## Pilot Recommendation

1. **Simple pilot:** IRI Swapper run history.
   - Replace duplicated RDF/SPARQL `openDb/putRun/getRun/listRuns/deleteRun/clearAllRuns`.
   - Confirms the generic run store is ergonomic.

2. **Demanding pilot:** Axiolotl quad store.
   - Characterize default graph, named graph, query artifact, settings, deletion, and workspace status behavior.
   - Confirms the storage model can support RDF graph workloads.

3. **Dataset pilot:** OntoEagle.
   - Characterize built-in/user dataset preload, enabled datasets, metadata freshness, and search workspace hydration.
   - Confirms the project data model supports source/loaded dataset distinction.

4. **Project pilot:** TOM or Mermaid-informed new adapter.
   - TOM becomes a single default project with settings, imports, predicates, axioms, rows, and exported RDF.
   - Mermaid remains reference architecture for multi-project nested artifacts.

## Mermaid-Inspired Requirements

The promoted storage package should satisfy these Mermaid-derived requirements before project/artifact CRUD is considered mature:

- Project records can be created, listed, updated/renamed, selected, and deleted.
- Artifacts are scoped to projects and can be created, listed, loaded, updated/renamed, and deleted independently.
- Deleting a project has explicit artifact behavior: cascade delete, block when non-empty, or archive. The caller must choose; it should not be implicit.
- Storage backends are adapters. IndexedDB should be the first backend, but the same project/artifact contract should allow File System Access or OPFS later.
- Tests cover backend migration/open behavior, project CRUD, artifact CRUD, nested listing, delete behavior, and invalid input handling.

## Current Browser Persistence Inventory

This inventory is based on a focused sweep for `localStorage`, `sessionStorage`, `indexedDB`, `idb.openDB`, service-worker `caches.open`, and related browser persistence APIs across the app-authored files in the current repositories. Vendor and shared package copies were excluded.

|App|Persistence mechanism|Current store/key|Observed purpose|Recommended target|
|:---|:---|:---|:---|:---|
|OntoEagle|IndexedDB|`OntoEagleDB.settings`|Legacy active search/settings record.|Shared `settings` store, scope `app:ontoeagle` or `project:<id>`, key `searchOptions`.|
|OntoEagle|IndexedDB|`OntoEagleDB.datasets`|Built-in/user ontology dataset metadata and enabled state.|Shared `datasets` plus `workspaceInclusions`; built-ins remain reference datasets.|
|OntoEagle|IndexedDB|`OntoEagleDB.documents`|Extracted ontology documents for search/catalog use.|Dataset cache or materialized project/reference artifact data; not user profile settings.|
|OntoEagle|IndexedDB|`OntoEagleDB.index`|Search/index acceleration data.|App-local cache; show only in advanced/debug navigation.|
|OntoEagle|localStorage|`ont-theme`|Light/dark theme preference.|Shared `settings`, scope `user:local`, key `theme`, default `light`.|
|OntoEagle Bundler|localStorage|`onto.bundles.jsonld`|Current IRI bundle/shopping-cart JSON-LD document.|Project artifact `artifactKind: 'iri-bundle'`, role `staged`; optionally also a run output.|
|OntoEagle service worker|Cache Storage|`CACHE_SHELL`, `CACHE_DATA`|Offline shell and data fetch caches.|App-local/browser cache; not durable project data.|
|TOM|IndexedDB|`TabularOntologyDB.rdfStore`|Saved generated RDF output.|Project artifact `artifactKind: 'ontology-rdf'`, role `generated` or `export`.|
|TOM|IndexedDB|`TabularOntologyDB.workspaceStore`|Saved TOM working table/workspace snapshot.|Project artifact `artifactKind: 'tom-workspace-snapshot'` or `ontology-table`, role `staged`.|
|TOM|IndexedDB|`TabularOntologyDB.ontologySettingsStore`|Singleton ontology settings object.|Shared `settings`, scope `project:<id>`, key `ontologySettings`.|
|TOM service worker|Cache Storage|Precache/runtime/JSON caches|Offline app shell and fetched JSON lookup/cache data.|App-local/browser cache; reference lookup data should be reference catalog data if durable.|
|Axiolotl|IndexedDB via `idb`|`inferenceDB.triples`|Active RDF triple/quad rows for local querying.|Shared `graphs` plus `quadRows`; default graph normalized to `null`.|
|Axiolotl|IndexedDB via `idb`|`inferenceDB.savedQueries`|Saved SPARQL query records.|Project artifacts with `artifactKind: 'sparql-query'`, role `query`.|
|Axiolotl|IndexedDB via `idb`|`SPARQLSettings.Settings`|SPARQL endpoint/auth/query settings.|Shared `settings`, scope `app:axiolotl` or `project:<id>`.|
|Axiolotl|localStorage|`activePrefixes`|User-selected active prefix assertions for query editing.|Namespace assertion profile, scope `app:axiolotl` or `project:<id>`, context `sparql`.|
|Axiolotl|localStorage|clear-all behavior|Hard reset currently clears all localStorage.|Migration must avoid clearing unrelated shared/user settings without explicit confirmation.|
|OCM/OCD|IndexedDB|`ocd-db.runs`|Saved diagnostic runs.|Shared `runs` plus report artifacts.|
|OCM/OCD|IndexedDB|`ocd-db.appState`|`last` run pointer.|Shared `runs` last pointer or scoped `settings` key.|
|OCM/OCD|localStorage|`ocd-theme`|Theme preference.|Shared `settings`, scope `user:local`, key `theme`, default `light`.|
|IRI Swapper RDF page|IndexedDB|`myna-iri-mapper-db.runs`|RDF/ontology IRI replacement run history.|Shared `runs` and artifacts for source RDF, mapping table, rewritten RDF output.|
|IRI Swapper SPARQL page|IndexedDB|SPARQL page DB `runs`|SPARQL IRI replacement run history.|Shared `runs` and artifacts for source query, mapping table, rewritten query output.|
|IRI Swapper RDF/SPARQL pages|In-memory parsed data, no persistent prefix store found|Native prefixes extracted from RDF/SPARQL inputs.|Project/app namespace assertion profiles if user-defined prefixes become durable. Native parsed prefixes remain artifact metadata.|
|Table Nova|IndexedDB|`table-nova.runs`|Stored tabular-to-RDF runs keyed by graph IRI, including quads, schema, ontology Turtle, samples.|Shared `runs`, `artifacts`, `graphs`, and `quadRows`.|
|Table Nova|localStorage|`ont-theme`|Theme preference through shared-looking site header.|Shared `settings`, scope `user:local`, key `theme`, default `light`.|
|Mermaid|IndexedDB|`MermaidIDE.projects`|User project records.|Shared `projects` after migration.|
|Mermaid|IndexedDB|`MermaidIDE.diagrams`|Project-scoped Mermaid diagrams.|Shared `artifacts`, `artifactKind: 'mermaid-diagram'`.|
|Mermaid|IndexedDB|`MermaidIDE.syncQueue`|Pending sync/work queue.|App-local operational queue unless project export/import requires it.|
|Visual Lynx|No durable app-owned browser persistence found in focused sweep|N/A|Current app appears file/transform/view oriented.|Add shared project artifacts only when saved workspaces/runs are introduced.|
|SPARQL Pattern Visualizer|No durable app-owned browser persistence found in focused sweep|N/A|Current app appears visualizer/session oriented.|Add query/visual artifacts only when persistence is introduced.|
|Ontology Tabulator|No durable app-owned browser persistence found in focused sweep|N/A|Current app appears import/export oriented.|Add ontology/table artifacts only when persistence is introduced.|

No app-owned `sessionStorage` or cookie persistence was found in the focused sweep.

Settings classification:

```text
User settings:
  theme
  language
  user profile metadata
  default ontology profile
  user-level namespace assertion profiles
  user-level IRI reservation registry

Project settings:
  ontology generation defaults
  active project artifact
  selected workspace inclusions
  project-level namespace assertion profiles

App settings:
  UI preferences and app defaults that are not part of a project artifact
  app-specific query endpoint defaults
  app-specific search defaults

Artifact metadata:
  native prefixes extracted from uploaded RDF/SPARQL
  source file names, MIME types, extensions, fingerprints
  provenance and generated output summaries

App-local caches:
  service-worker caches
  search indexes
  parsed lookup acceleration structures
  sync queues
```

## Key Decisions

- Treat all RDF as quads at storage boundaries. Triple-only workflows are default-graph projections.
- Treat user files as artifacts. The artifact can have source bytes/text, loaded normalized records, staged state, and transformed outputs.
- Do not store “current UI” as the canonical data model. Store project records, artifact records, run records, settings, and normalized payloads; UI state is optional metadata.
- Keep parsers out of storage. Storage accepts normalized records and payloads; RDF/tabular/SPARQL/Mermaid parsing belongs to their own capability packages.
- Keep DOM events out of storage core. Apps can subscribe to storage results and dispatch UI notifications.
- Support multiple backends later. IndexedDB should be first; File System Access and OPFS should implement the same project/artifact interface when needed.
- Promote File System Access as an optional local-folder backend for project files. The handle registry still lives in IndexedDB because `FileSystemDirectoryHandle` values are browser-local permissions, not portable project data.
- Use manifest-last writes for folder-backed project saves so a partially written project does not appear complete after a browser crash.

## File System Access Backend

Mermaid's FSA implementation is the current reference design. It is more than a stub: it includes path sanitization, permission handling, atomic temp-file writes, Web Lock serialization, file/folder list/read/write/rename/remove operations, an IndexedDB-backed handle registry, audit logging, and tests.

The shared package should promote this as a backend adapter, not as Mermaid-specific application code.

Recommended boundary:

```text
Project/artifact/run/settings records
  -> IndexedDB stores by default
  -> File System Access project folder when the user designates a local folder
```

Decisions made:

- When a user grants File System Access to a project folder, the folder is authoritative for durable artifact bytes. IndexedDB remains authoritative for the project index, settings, run records, derived graph/table caches, UI resume state, folder handle registry, and sync status.
- Synchronization should be bidirectional. The folder can receive writes from IndexedDB-backed app operations, and folder files can be scanned and registered back into IndexedDB project records.
- The package should not assume live folder change listeners. Browser FSA does not provide a reliable cross-browser folder watch API. Use explicit scans on project open, app startup, user refresh, or a future polling/sync action.
- New loose files discovered in the folder should enter a review workflow. The app should show a "new files found" panel before registering/importing them as project artifacts.
- Conflicts should not be silently overwritten. If both the IndexedDB artifact record/payload and folder file changed since the last sync, mark the artifact as conflicted and let the user choose folder version, IndexedDB version, keep both, export a copy, or ignore.
- Use manifest records for every folder-backed artifact. Loose files are allowed in the folder, but they should be represented as `discovered` scan results until the user or deterministic app policy registers them into the manifest.
- Prefer newest modified timestamp only for non-conflict cases where one side changed since the last sync. If both sides changed, require explicit user choice.
- Do not auto-run transformations because an input file changed. If `source.csv` changes, generated RDF artifacts and graph rows should be marked stale until the user reruns the CSV-to-RDF workflow.
- Do not auto-materialize RDF/tabular file changes into graph or table stores unless an app provides an explicit auto-refresh mode. The default is metadata update plus stale-cache notification.

Recommended sync status values:

```text
synced
folder-newer
indexeddb-newer
conflict
discovered
missing-folder-file
missing-indexeddb-record
stale-derived-output
```

Recommended folder scan flow:

1. List project folder entries and compare file path, size, last modified time, and known checksum where available against the manifest and IndexedDB artifact records.
2. Produce scan results without mutating project records.
3. Register known clean changes automatically only when the policy is unambiguous.
4. Present discovered files and conflicts in a review panel.
5. On user approval, create or update artifact records, manifest entries, and sync status.
6. Mark downstream generated/transformed artifacts stale when their source artifact changed.

Recommended folder layout:

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

Promotion rule:

```text
Promote the FSA primitives and folder-backed project adapter.
Do not promote Mermaid's diagram-specific project routing as the cross-app model.
```

See [File System Access Promotion Plan](./file-system-access-promotion-plan.md) for the proposed API, expansion requirements, and maturity assessment.

## Fixtures Needed

- `project-basic.json`: one project with settings and two artifacts.
- `artifact-rdf-source.json`: uploaded Turtle source artifact metadata.
- `artifact-rdf-loaded-quads.json`: loaded quad rows with default and named graphs.
- `artifact-tabular-source.json`: uploaded CSV source artifact metadata.
- `run-transformation.json`: transformation run with input/output artifacts.
- `run-diagnostic.json`: diagnostic run with report artifact.
- `query-artifacts.json`: SPARQL, SQL, and NoSQL query artifacts.
- `mermaid-project.json`: project with two Mermaid diagrams.
- `migration-axiolotl-default-graph.json`: empty-string graph rows converted to canonical default graph representation.

## Cross-App Project Portfolio Clarification

The project portfolio is intended to span apps. A project is not owned by OntoEagle, TOM, Axiolotl, Table Nova, IRI Swapper, Mermaid, or any other single app. Each app may contribute its own artifacts, runs, settings, and derived outputs to the same project.

Recommended storage split:

```text
OntologyWorkbenchProjects
  projects
  artifacts
  runs
  settings

App-local databases
  app-specific caches
  vendor-required legacy stores
  derived indexes
  transient acceleration structures
```

Examples:

- OntoEagle contributes selected ontology catalog artifacts, ontology slim artifacts, search/import runs, and project-level selection settings.
- CQ Ferret contributes competency-question JSON-LD artifacts, CSV import runs, Mermaid/query sub-artifacts, and generated vocabulary outputs.
- TOM contributes ontology workspace snapshots, prefix/import settings, table rows, axiom artifacts, and exported RDF artifacts.
- Axiolotl contributes RDF graph artifacts, quad rows, SPARQL query artifacts, query result artifacts, inference runs, and workspace state.
- Table Nova contributes source tabular files, parsed tabular records, RDF conversion outputs, and export artifacts.
- IRI Swapper contributes source ontology artifacts, IRI mapping artifacts, rewritten RDF artifacts, and replacement run records.
- Mermaid contributes diagram artifacts inside the same project portfolio rather than living in a separate mental model.

App-local databases are still valid, but they should be treated as implementation details unless the stored data is durable user work. For example, OntoEagle's extracted document cache and search indexes can stay app-local, while user-selected ontologies, imported files, transformed outputs, and runs should be represented in the shared project portfolio.

## Reference Catalogs Versus Project Work

Stock/default resources should not automatically become user project data. They should be modeled as reference resources that a project can explicitly use.

```text
ReferenceCatalog
  ReferenceDataset
  ReferenceArtifact

ProjectPortfolio
  Project
    ProjectArtifact
    WorkspaceInclusion
    RunRecord
    Settings
```

Reference resources include:

- OntoEagle's preloaded ontology catalog.
- Axiolotl's stock graphs that are ready to load but not automatically inserted into the user's active store.
- TOM's optimized parent lookup JSON, if promoted into a fuller ontology/reference catalog.
- Stock SHACL templates, SPARQL query templates, Mermaid templates, namespace catalogs, and other reusable resources.

Project resources include:

- User-uploaded ontology files.
- User-selected reference datasets added to a project workspace.
- Parsed tabular records.
- Loaded RDF datasets or quad rows.
- Staged transformations.
- Generated ontology slims, rewritten ontology files, diagnostic reports, diagrams, query results, and exports.

Decision:

```text
Reference data = available shared knowledge.
Project data = user-selected or user-created durable work.
App-local cache = performance/runtime implementation detail.
```

## Workspace Inclusion Records

Many ontology workflows need reference ontologies available in an active workspace for labels, taxonomy closure, superclass discovery, parent lookup, and validation. Reading every available reference graph implicitly would be confusing and could create hidden collisions. The project should therefore record explicit workspace inclusions.

```js
{
  inclusionId: 'inclusion:project-x:bfo',
  projectId: 'project:x',
  targetType: 'reference-dataset', // reference-dataset | artifact
  targetId: 'reference:bfo',
  role: 'imported-reference',      // imported-reference | project-source | generated-output
  enabled: true,
  graphIri: 'urn:graph:reference:bfo',
  includeMode: 'read-only',        // read-only | editable | generated
  createdAt: '2026-07-30T00:00:00.000Z',
  metadata: {
    reason: 'taxonomy closure and labels'
  }
}
```

For a user-loaded ontology artifact:

```js
{
  inclusionId: 'inclusion:project-x:user-domain-ontology',
  projectId: 'project:x',
  targetType: 'artifact',
  targetId: 'artifact:user-domain-ontology',
  role: 'project-source',
  enabled: true,
  graphIri: 'urn:graph:project:x:user-domain-ontology',
  includeMode: 'editable'
}
```

Workspace inclusions make it easy for users to add/remove reference ontologies from an active project without copying the reference catalog itself into every project. They also make graph visibility explicit: a project reads only enabled inclusions.

## Active Workspace Graph

An active workspace graph is a computed or materialized view over enabled workspace inclusions.

```text
ActiveWorkspaceGraph(projectId)
  = enabled reference datasets
  + enabled project source artifacts
  + enabled staged/generated artifacts
```

Named graphs should remain explicit:

```text
urn:graph:reference:bfo
urn:graph:reference:cco
urn:graph:project:x:user-source
urn:graph:project:x:generated-slim
```

This supports multiple graph views:

- Label/taxonomy view: all enabled reference and project graphs.
- Editable view: editable project graphs only.
- Export view: selected output graph(s).
- Reasoning/closure view: project graph plus selected references.
- Debug view: all enabled named graphs with provenance.

Collision handling should happen at named-graph and inclusion boundaries. The package should avoid flattening all reference and user data into one anonymous graph too early.

## Canonical Graph Store Schema

Decision: use Axiolotl's proven row-oriented RDF persistence model as the operational foundation, but add graph metadata and project scoping before promoting it across apps.

Recommended stores:

```text
graphs
quadRows
```

`graphs` stores metadata about a default or named graph:

```js
{
  graphId: 'graph:project-x:source',
  projectId: 'project:x',
  graphIri: null,                 // null default graph, or named graph IRI
  artifactId: 'artifact:source',
  role: 'source',                 // source | reference | loaded | generated | inferred-overlay
  label: 'User source graph',
  materialization: {
    strategy: 'materialized-on-import',
    status: 'ready',
    quadCount: 1000,
    indexedAt: '2026-07-30T00:00:00.000Z'
  },
  provenance: {
    derivedFrom: ['artifact:source']
  },
  metadata: {}
}
```

`quadRows` stores the RDF statements:

```js
{
  projectId: 'project:x',
  graphId: 'graph:project-x:source',
  artifactId: 'artifact:source',
  subject: 'http://example.org/s',
  subjectType: 'NamedNode',
  predicate: 'http://example.org/p',
  predicateType: 'NamedNode',
  object: 'value',
  objectType: 'Literal',
  objectLang: '',
  objectDatatype: 'http://www.w3.org/2001/XMLSchema#string',
  graph: null,
  graphIri: null,
  graphType: 'DefaultGraph'
}
```

Compatibility rule:

```text
Axiolotl-style rows with graph: '' are accepted at import/storage boundaries and normalize to graph: null.
```

This keeps the existing Comunica path viable:

```text
IndexedDB quadRows -> RDF/JS quads -> N3.Store -> Comunica rdfjsSource
```

It avoids building a custom lazy IndexedDB-backed Comunica source during this capability cycle. That can be reconsidered later if graph volume makes full in-memory RDF/JS loading the bottleneck.

## Artifact Lifecycle Buckets

A project artifact is any durable unit of user-relevant work, whether original, loaded, staged, transformed, generated, or exported.

Recommended artifact roles:

```text
reference
source
loaded
staged
transformed
generated
export
cache
```

Recommended artifact kinds:

```text
rdf-file
rdf-dataset
quad-rows
tabular-file
tabular-records
iri-mapping-table
sparql-query
sql-query
nosql-query
mermaid-diagram
shacl-shapes
r2rml-mapping
diagnostic-report
ontology-slim
search-index
```

Table Nova example:

```text
source CSV file
  -> loaded tabular records
  -> transformed RDF dataset
  -> exported Turtle/JSON-LD file
```

IRI Swapper example:

```text
source ontology file
source old-to-new IRI mapping
  -> loaded RDF dataset
  -> transformed rewritten RDF dataset
  -> exported rewritten ontology file
```

Each operation should also create a `RunRecord` connecting input and output artifact ids.

```js
{
  runKind: 'rdf-iri-rewrite',
  inputArtifactIds: [
    'artifact:source-ontology',
    'artifact:iri-mapping-table'
  ],
  outputArtifactIds: [
    'artifact:rewritten-rdf-dataset',
    'artifact:rewritten-rdf-file'
  ],
  payload: {
    replacementCount: 128,
    unmappedCount: 3,
    targetFormat: 'text/turtle'
  }
}
```

## File-Manager Style Navigation

The storage architecture should support a UI similar to Protege, Windows File Explorer, or a project explorer. The UI should expose a logical tree, not raw IndexedDB object stores.

Possible navigation model:

```text
Projects
  Diabetes Ontology Cleanup
    Active Workspace
      Included References
        BFO                  read-only
        CCO                  read-only
      Project Sources
        diabetes-source.ttl  editable
      Staged Work
        parent choices
        axiom draft table
      Transformed Outputs
        rewritten-output.ttl
        generated-slim.ttl
    Ontologies
    Tabular Data
    Mappings
    Queries
    Diagrams
    Reports
    Runs / History
    Settings

Reference Catalogs
  OntoEagle Built-ins
  Axiolotl Stock Graphs
  TOM Parent Lookup Catalog
  Query Templates
  SHACL Templates

Caches
  Search indexes
  Parsed lookup indexes
```

The tree can be generated from normalized records rather than folder paths:

```text
projectId
artifactKind
role
source.origin
workspace inclusion enabled/disabled state
provenance.derivedFrom
runKind
createdAt / updatedAt
```

A later shared utility can provide this as a pure UI-neutral projection:

```js
createProjectNavigationTree(records, options)
```

Apps can render that tree differently while preserving the same logical organization.

## Resolved Design Decisions For User Feedback

### Default Project Behavior

Each app should assume it is contributing to a shared active project. If the user has not chosen or named a project, the app should write to the default project.

Decision:

```text
Apps save durable user work to the active project.
If no active project exists, apps create/use the shared default project.
```

This avoids forcing project-management UI into every app before the storage model is useful. It also keeps the model compatible with later project selection, project rename, and cross-app project navigation.

### Reference Inclusion Records

Adding a reference dataset to a project should create a `WorkspaceInclusionRecord`. It should not create a full project artifact unless the user forks, annotates, edits, snapshots, or exports that reference data.

Recommended rule:

```text
Reference selected for use = WorkspaceInclusionRecord only.
Reference copied/mutated by user = ProjectArtifact plus WorkspaceInclusionRecord.
```

A lightweight project artifact that points to a reference can be useful later for project manifests, offline bundles, or exportable project packages. It should not be required for ordinary workspace inclusion, because that would make reference use look like user-created project data even when it is only a read-only dependency.

### Reference Mutation And Revert

Reference datasets should be immutable by default, but users should be allowed to fork them into editable project artifacts.

The forked artifact should preserve provenance and mutation status:

```js
{
  artifactKind: 'rdf-dataset',
  role: 'forked-reference',
  source: {
    origin: 'reference-fork',
    referenceId: 'reference:bfo',
    fingerprint: 'sha256:original-reference'
  },
  provenance: {
    derivedFrom: ['reference:bfo']
  },
  metadata: {
    mutatedFromReference: true,
    canRevertToReference: true
  }
}
```

Reverting should not mutate the reference catalog. It should either:

- Replace the forked project artifact payload with the current stock/reference payload.
- Disable/delete the forked artifact and re-enable the original read-only reference inclusion.

The second option is cleaner for provenance because it preserves the distinction between stock data and user-edited data.

### Active Workspace Materialization

Active workspace graph views should support both computed and materialized strategies. The strategy should be app-specific.

Recommended modes:

```text
computed-on-demand
materialized-on-import
materialized-on-first-use
materialized-on-run
```

OntoEagle should materialize selected built-in and user-added ontology datasets because search, IRI seed management, and slim generation depend on fast indexed access. Axiolotl can defer materialization until the user loads a graph into the active store or runs an operation that requires local quad access. Table Nova and IRI Swapper can usually materialize only around a transformation run.

The package should make this explicit on the workspace inclusion or artifact summary:

```js
{
  materialization: {
    strategy: 'materialized-on-import',
    status: 'ready',
    quadCount: 45000,
    indexedAt: '2026-07-30T00:00:00.000Z'
  }
}
```

### Collision Warnings

The project storage package should not produce user-facing collision warnings by default.

Decision:

```text
Storage records provenance and graph boundaries.
Specialized apps inspect conflicts when needed.
```

Ontology Compliance Diagnostic and related validation tools are better places to surface conflicting labels, subclass relations, domain/range assertions, or metadata. The storage layer should preserve enough named-graph and provenance information for those tools to inspect conflicts accurately.

### Cache Visibility

Caches should appear in the navigator only under advanced/debug mode.

Default project navigation should show durable user work:

- Projects.
- Active workspace inclusions.
- Source artifacts.
- Staged artifacts.
- Transformed/generated artifacts.
- Queries.
- Diagrams.
- Reports.
- Runs/history.
- Settings.

Advanced/debug navigation can show implementation details:

- Search indexes.
- Parsed lookup indexes.
- Materialized quad stores.
- Vendor-local stores.
- App-local acceleration caches.

This keeps the user mental model focused on work products, while still giving developers and advanced users a way to inspect storage behavior.

### Controlled Vocabulary Before TOM, Axiolotl, And Mermaid Migration

The controlled vocabulary should be broad enough for the next migrations, but not so broad that every app invents its own near-duplicate terms.

Recommended `artifactKind` values:

```text
ontology-rdf
ontology-table
rdf-file
rdf-dataset
quad-rows
tabular-file
tabular-records
iri-mapping-table
sparql-query
sparql-update
sql-query
nosql-query
query-results
mermaid-diagram
shacl-shapes
r2rml-mapping
diagnostic-report
measurement-report
ontology-slim
ontology-catalog
iri-bundle
reference-dataset
namespace-profile
iri-reservation-registry
user-profile
ontology-profile
project-snapshot
app-settings
export-bundle
```

Use `artifactKind` for the durable data shape or domain-significant data class:

- `ontology-rdf`: ontology source or output serialized as RDF, such as Turtle, JSON-LD, RDF/XML, TriG, or N-Quads.
- `ontology-table`: TOM-style normalized spreadsheet/table intended to describe an ontology, not merely arbitrary tabular data.
- `rdf-file`: generic RDF file when ontology semantics are unknown or not relevant.
- `rdf-dataset` / `quad-rows`: loaded RDF graph data, including default-graph triples, named-graph quads, instance data, and inferred/materialized overlays.
- `tabular-file` / `tabular-records`: generic tabular source or parsed tabular records.
- `mermaid-diagram`, `sparql-query`, `sql-query`, `nosql-query`, and report/mapping kinds: durable side artifacts that can be project-wide without taking ownership of the primary RDF/ontology work.
- `namespace-profile`: user/project/app-defined prefix assertions that should remain separate from the canonical namespace registry.
- `iri-reservation-registry`: a user or project registry of reserved/taken/deprecated IRIs and curation ownership.
- `user-profile` and `ontology-profile`: exportable defaults for creator/contributor metadata and ontology IRI/repository defaults when settings alone are too opaque.

Avoid one artifact kind per app. App ownership should be recorded in `source.appId`, `metadata.appId`, or run provenance. Purpose should be recorded in `role`, `runKind`, and optional semantic metadata.

Recommended `role` values:

```text
reference
source
loaded
staged
transformed
generated
forked-reference
inferred-overlay
query
report
setting
cache
export
```

Recommended `runKind` values:

```text
import
export
parse
load
query
transformation
rdf-iri-rewrite
tabular-to-rdf
diagnostic
inference
generation
materialization
migration
```

App-oriented examples:

- TOM: `ontology-table` with `role: staged/source`, or `ontology-rdf` with `role: export/generated`.
- Axiolotl: `rdf-dataset` or `quad-rows`; ontology, instance data, and inferred overlays are distinguished by `role`, graph IRI, provenance, and metadata rather than separate app-specific kinds.
- OntoEagle: mostly `ontology-rdf`, `ontology-catalog`, and `ontology-documents`; knowledge-graph instance data can remain `rdf-dataset`.
- CQ Ferret: RDF/JSON-LD domain/problem-area artifacts, plus optional `tabular-file`, `mermaid-diagram`, and query artifacts.
- Bundler: `ontology-slim`, `iri-bundle`, or `rdf-dataset` depending whether the artifact is the ROBOT seed text, generated ontology slim, or loaded graph data.
- OCD: `diagnostic-report` and `measurement-report` generated from `ontology-rdf` or `rdf-dataset` inputs.
- Table Nova: `tabular-file` or `tabular-records` inputs, `rdf-dataset` or `ontology-rdf` outputs when it generates a naive ontology from schema.
- IRI Swapper: `iri-mapping-table` plus `rdf-file`/`ontology-rdf` or query input; transformed output keeps the same broad kind with `role: transformed`.
- Ontology Tabulator: `ontology-rdf` input, `ontology-table` or `tabular-records` output.
- Linked Data Transformer / Visual Lynx: RDF inputs with generated RDF, Mermaid, D3 JSON, or visual artifacts.
- Mermaid: `mermaid-diagram` is a first-class project artifact.

Recommended `source.origin` values:

```text
builtin
reference-catalog
upload
generated
transformed
remote
imported-folder
legacy-migration
reference-fork
user-profile
```

Recommended `WorkspaceInclusionRecord.role` values:

```text
imported-reference
project-source
staged-work
generated-output
forked-reference
query-context
validation-context
```

Recommended `includeMode` values:

```text
read-only
editable
generated
disabled
```

These values should be normalized in code rather than treated as loose strings. Unknown values can be allowed during early migration, but should trigger warnings in development tests so vocabulary drift does not reappear across apps.

