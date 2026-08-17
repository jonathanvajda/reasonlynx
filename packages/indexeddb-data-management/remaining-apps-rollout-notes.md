# Remaining Apps Rollout Notes

## Date

2026-08-02

## Scope

This note records the first project-portfolio rollout after TOM and Axiolotl for:

- Ontology Curation Manager / Ontology Compliance Diagnostic.
- Visual Lynx / Linked-Data Transformer.
- SPARQL Pattern Visualizer.
- Ontology Tabulator.
- Table Nova.
- IRI Swapper RDF and SPARQL pages.
- Table Nova's related DocxHund page.

## Implemented

### Shared Package Availability

The promoted `indexeddb-data-management` package has been copied into each target app under:

```text
docs/app/shared/indexeddb-data-management/
```

The copied package imports have been adjusted for app-local shared package layout:

- `../format-registry/index.js`
- `../browser-file-io/index.js`
- `../namespace-registry/index.js`

The current `browser-file-io` package has also been synchronized so project export and folder-sync helpers can use the promoted filename and Blob predicates.

### Ontology Curation Manager / OCD

`docs/app/storage.js` now preserves the app-facing API:

```js
saveRun(input)
listRuns(limit)
getRun(runId)
deleteRun(runId)
getLastRunId()
```

The implementation now routes through the shared project portfolio database:

- Saved diagnostic runs are stored as shared `RunRecord`s.
- Legacy UI payload shape is preserved under `payload`.
- The last-run pointer is stored through the shared `settings` store.
- The OCD theme preference is stored through the shared `settings` store instead of `localStorage`.
- App code using `main.js` does not need to know about the storage backend change.

Representative Jest coverage was added in `test/project-storage.jest.test.js`.

### IRI Swapper

`docs/app/iri-swapper-run-store.js` was added as the shared run-history adapter for both pages.

The RDF page and SPARQL page keep local helper names for UI stability:

```js
makeRunId(kind, fileName, iso)
putRun(run)
getRun(runId)
listRuns()
deleteRun(runId)
clearAllRuns()
```

Those helpers now call the shared portfolio-backed adapter:

- RDF rewrite runs use `runKind: 'rdf-iri-rewrite'`.
- SPARQL rewrite runs use `runKind: 'sparql-iri-rewrite'`.
- Existing run ids and payload fields are preserved for previews/downloads.

The service worker cache list now includes the new adapter and data-management package modules.

Representative Jest coverage was added to `tests/shared-capabilities.test.js`.

### Table Nova

`docs/app/storage/indexedDb.js` now preserves the app-facing API:

```js
openTableNovaDb()
putRun(db, run)
listRuns(db)
deleteRun(db, graphIri)
getRunDataset(db, graphIri)
```

The implementation now stores runs in the shared project portfolio:

- Table Nova transformation runs use `runKind: 'tabular-to-rdf'`.
- The existing graph IRI remains the UI key and is preserved in payload.
- Existing run payload fields remain available for load/export behavior.

Representative Jest coverage was added in `tests/project-storage.test.js`.

Remaining app-authored `localStorage` use: Table Nova's `site-header.js` still persists `ont-theme` with `localStorage`. The page currently loads site-header code through a fallback chain that can prefer the OntoEagle-hosted shared header, so this should be handled in a separate shared-header/settings pass rather than patched only in Table Nova.

### Visual Lynx / Linked-Data Transformer

No durable app-owned IndexedDB store was found in the current focused sweep. The shared package is now available locally for the next persistence step, but no UI behavior was changed.

Related note: Sugar Serial should later reuse the shared namespace-registry prefix-selection behavior so prettified RDF emits only prefixes used by rendered RDF terms.

### SPARQL Pattern Visualizer

No durable app-owned IndexedDB store was found in the current focused sweep. The shared package is now available locally for future query/visual artifact persistence, but no UI behavior was changed.

### Ontology Tabulator

No durable app-owned IndexedDB store was found in the current focused sweep. The shared package is now available locally for future ontology/table artifact persistence, but no UI behavior was changed.

### DocxHund

DocxHund currently uses browser file/download utilities for generated Turtle output and does not have app-owned IndexedDB project/run storage. The shared package is available through Table Nova's `docs/app/shared` tree, but DocxHund storage behavior was not changed.

## Deferred

These items remain intentionally deferred rather than half-wired:

- Browser UI for project selection across these apps.
- Folder-sync UI and "new files found" review panels.
- Automatic migration/deletion of legacy app-specific databases.
- Artifact-level persistence for source files, mapping files, generated output files, query files, and reports.
- FSA mirror/export hooks for Table Nova, IRI Swapper, OCD, Visual Lynx, Ontology Tabulator, SPARQL Pattern Visualizer, and DocxHund.
- Materializing Table Nova or IRI Swapper transformed RDF into shared `graphs` and `quadRows`.

## Deep-Pass Follow-Up

### Namespace And IRI Registry

The remaining apps were swept again for app-local RDF/RDFS/OWL/SKOS/XSD/DCTERMS/CCO namespace constants and direct W3C/DCTERMS/CCO IRI strings. App-local hard-coded vocabulary IRIs are now removed from the active JS paths checked in this pass.

The copied `namespace-registry` package in each remaining app was synchronized from the promoted staging source. This removed the old `cco` registry entry from those copies and added explicit registry IDs for legacy fallback terms already used by Ontology Tabulator:

- `dc:accessRights`
- `dc:bibliographicCitation`
- `dc:rightsHolder`
- `iao:preferredTerm`
- `iao:acronym`
- `cceo:alternativeLabel`
- `cceo:doctrinalSource`
- `cco2:doctrinalSource`

Ontology Tabulator now uses `COMMON_NAMESPACE_IRIS` directly for ontology metadata and element-column predicates instead of building IRIs from namespace stems. OCD tests and engine lookup paths now use `COMMON_NAMESPACE_IRIS.cceo.curatedIn` for the `http://www.ontologyrepository.com/CommonCoreOntologies/` curated-in relation.

### JSON-LD Record Vocabulary

`createRecordJsonLdVocabulary()` in the promoted IndexedDB package and app-local copied packages now returns terms from `COMMON_NAMESPACE_IRIS` directly instead of calling `iriForNamespaceId()` term by term. This preserves full-IRI JSON-LD object keys and keeps CURIE compaction limited to serialization/presentation concerns.

### Storage

The active app-authored storage paths checked in this pass use shared IndexedDB project portfolio adapters where persistence has been wired. The remaining `localStorage` match is Table Nova's mirrored `site-header.js`; this should be fixed upstream in OntoEagle's shared header and then re-mirrored, not patched uniquely in Table Nova.

### Parser And Serializer Paths

The active app JS paths checked in this pass do not call `new N3.Parser`, `new N3.Writer`, `jsonld.fromRDF`, `jsonld.toRDF`, or `$rdf.parse` directly outside shared RDF adapter packages. The remaining non-shared parser-related match is Visual Lynx Sugar Serial checking for `N3.Parser` availability before using its specialized serializer.

### Promotion Candidates

The following app-specific behavior deserves a promotion review rather than being left as hidden app code:

- Visual Lynx Sugar Serial / rdflib Sugar Serial: promoted RDF prettifier layer over shared `rdf-io`, including used-prefix emission and ontology-oriented ordering.
- Ontology Tabulator element extraction field profiles: reusable ontology-to-table projection profile for labels, definitions, preferred labels, acronym, source, and curated-in columns.
- Table Nova draft metadata exports: reusable data-dictionary and JSON Schema draft builders for tabular-to-RDF workflows.
- DocxHund document-to-RDF mapping terms: candidate OKEA extension work before any broader promotion, because several document-part predicates are currently app-specific modeling decisions.

## Validation

Local checks passed after this rollout:

```text
ontology-curation-manager: npm run check
visual-lynx: npm run check
sparql-pattern-visualizer: npm run check
ontology-tabulator: npm run check
table-nova: npm run check
iri-swapper: npm run check
```

## Next Recommended Step

Add a small project selector/status strip shared across apps before artifact-level persistence expands. Without that UI affordance, apps can technically write to the shared default project, but users cannot yet see or change the active project from within each app.
