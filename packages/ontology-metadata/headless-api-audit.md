# Ontology Metadata Read/Write And IRI Provisioning Headless API Audit

Date: 2026-08-15

## Scope

This package owns ontology metadata extraction, canonical metadata record normalization, ontology metadata RDF writing, ontology import-target derivation, ontology metadata settings projection, and ontology/entity IRI provisioning.

It does not own DOM forms, modal state, localStorage, IndexedDB, File System Access, file downloads, RDF parser runtimes, ontology catalog rendering, or app-specific persistence flows.

## Headless Boundary Finding

The promoted ontology metadata surface is headless.

- Core functions accept JSON-LD objects, RDF/JS quads/datasets, plain metadata records, and explicit IRI policy options.
- Core functions return canonical full-IRI JSON-LD-compatible records, RDF/JS quads, TOM-compatible adapter views, import targets, or IRI strings.
- No source function touches DOM, browser file APIs, IndexedDB, localStorage, network, or console logging.
- RDF materialization uses the shared `rdf-io` model functions and does not serialize or parse RDF text.
- Metadata vocabulary terms are read from `namespace-registry`; new OKEA terms are used only where DCTERMS/RDFS/SKOS/OWL do not already provide the property.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### JSON-LD Metadata Reading

- `getJsonLdGraphNodes(jsonld)`
- `getAnyJsonLdValue(node, keys)`
- `readOntologyRecordsFromJsonLd(jsonld)`

### Canonical Metadata And Settings

- `generateOntologySettings(options)`
- `normalizeOntologyMetadataRecord(input, options)`
- `createOntologySettingsViewFromMetadataRecord(metadataRecord)`
- `ONTOLOGY_METADATA_PROFILE_SETTING_KEY`

`generateOntologySettings()` returns the durable full-IRI JSON-LD-compatible record shape. `createOntologySettingsViewFromMetadataRecord()` is the adapter boundary for legacy TOM DOM fields such as `iriMode`, `opaqueDigits`, and `readableCase`.

### IRI Provisioning

- `getOntologyIriBaseAndDelimiter(settings)`
- `buildOpaqueOntologyIri(nextNumber, settings)`
- `buildReadableOntologyIri(label, settings, existingIris)`
- `collectUsedOpaqueOntologyIriNumbers(iris, settings)`
- `findMaxOpaqueOntologyIriNumber(iris, settings)`
- `findNextAvailableOpaqueOntologyIriNumber(usedNumbers, settings, startAt)`

Provisioning helpers accept either canonical full-IRI OKEA policy records or app adapter views.

### Import Target

- `deriveOntologyImportTarget(quads, iris)`

### RDF Metadata Materialization

- `writeOntologyMetadataQuads(metadataRecord, options)`
- `appendOntologyMetadataQuads(dataset, metadataRecord, options)`
- `readOntologyMetadataRecordFromQuads(dataset, options)`

## Canonical Metadata Record

The durable record shape is JSON-LD-compatible and uses full IRI keys internally:

```js
{
  '@id': 'https://example.org/Ontology',
  '@type': ['http://www.w3.org/2002/07/owl#Ontology'],
  'http://www.w3.org/2002/07/owl#versionIRI': [{ '@id': 'https://example.org/2026-08-15/Ontology' }],
  'http://purl.org/dc/terms/title': [{ '@value': 'Ontology', '@language': 'en' }]
}
```

Compact CURIE keys are serialization concerns and should not be used as the internal storage shape.

## Input Contracts

- JSON-LD readers accept object, `@graph` object, array, or empty input.
- Metadata normalization accepts canonical full-IRI records and legacy TOM-style settings.
- Creator/contributor/license/source values may be JSON-LD nodes, value objects, strings, or arrays.
- ORCID creator/contributor strings are materialized as named nodes by the RDF writer.
- IRI policy functions accept canonical OKEA values or adapter-view local fields.
- Import target derivation accepts RDF/JS-like quads.

## Output Contracts

- `readOntologyRecordsFromJsonLd` returns OntoEagle catalog-compatible records plus lookup maps.
- `normalizeOntologyMetadataRecord` returns a full-IRI JSON-LD-compatible ontology metadata record.
- `generateOntologySettings` returns a canonical record, not a UI view.
- `createOntologySettingsViewFromMetadataRecord` returns TOM-compatible adapter fields for existing UI code.
- `writeOntologyMetadataQuads` returns RDF/JS quads.
- `readOntologyMetadataRecordFromQuads` returns a canonical full-IRI metadata record or `null`.
- IRI provisioning functions return strings, numbers, or number sets.

## Error Model

- Metadata readers are tolerant and return empty records or `null` when no ontology subject is present.
- `writeOntologyMetadataQuads` throws `TypeError` when no ontology `@id` is available.
- `appendOntologyMetadataQuads` throws `TypeError` when no mutable dataset/store adapter is supplied.
- IRI provisioning helpers normalize missing policy values to documented defaults.

## Adapter Rule

Browser, CLI, CI, and agent adapters may:

- read metadata form fields;
- load default app/user/project settings;
- call `normalizeOntologyMetadataRecord` before persistence;
- project canonical records into UI forms with `createOntologySettingsViewFromMetadataRecord`;
- materialize quads and pass them to `rdf-io` serializers;
- persist records through the IndexedDB/project data-management package.

Adapters must not:

- define local metadata data properties;
- store compact CURIE keys as the internal durable shape;
- create app-local IRI policy fields except in adapter views;
- duplicate ontology metadata predicate priority tables;
- write RDF metadata triples by hand when `writeOntologyMetadataQuads` covers the assertion.

## Headless Coverage

Jest coverage exercises:

- JSON-LD object/graph metadata extraction;
- preferred DCTERMS/DC/RDFS/OWL predicates;
- canonical settings generation without local policy keys;
- canonical-to-TOM adapter view projection;
- opaque and readable IRI provisioning;
- provisioning from canonical OKEA IRI policy values;
- legacy settings normalization into full-IRI records;
- metadata quad write/read round trips;
- `dcterms:format`, `dcterms:source`, creator, generation software, and generation run metadata;
- ontology import target derivation from `owl:Ontology` and `owl:versionIRI`.

## Maturity Assessment

Current maturity: Level 5 for ontology metadata read/write, metadata settings, IRI provisioning, and import-target derivation.

Rationale:

- public functions are pure except the explicit dataset mutation in `appendOntologyMetadataQuads`;
- internal data models use full IRIs and the shared namespace registry;
- app-specific DOM fields are isolated to an explicit adapter view;
- RDF materialization is performed through shared RDF model functions;
- current pilot consumers cover OntoEagle, TOM, Table-Nova, and OCD;
- regression tests cover canonical generation, round trips, and provisioning edge cases.
