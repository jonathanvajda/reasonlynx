# Reuse Maturity Ratings

## Capability Family

- **Capability family:** Ontology metadata read/write and IRI provisioning
- **Date updated:** 2026-08-15

## Rating Table

|ID|Function or package|Current level|Target level|Evidence|Blockers|Next action|Owner|Date updated|
|:---|:---|:---:|:---:|:---|:---|:---|:---|:---|
|MAT-001|Ontology metadata reader package|5|5|`readOntologyRecordsFromJsonLd` and `readOntologyMetadataRecordFromQuads` are implemented in `docs/app/shared/ontology-metadata` and `monorepo-staging/packages/ontology-metadata/src`; OntoEagle and OCD import shared readers instead of maintaining separate predicate extraction logic; Jest covers JSON-LD object/graph forms, RDF quad round trips, and DCTERMS/DC/RDFS/OWL aliases.|None for this milestone.|Use the package for additional apps when ontology catalog/import screens are added.|Codex|2026-08-10|
|MAT-002|Ontology metadata writer/settings package|5|5|`generateOntologySettings`, `normalizeOntologyMetadataRecord`, `createOntologySettingsViewFromMetadataRecord`, `writeOntologyMetadataQuads`, `appendOntologyMetadataQuads`, and `readOntologyMetadataRecordFromQuads` are promoted. The 18.10 headless audit confirms `generateOntologySettings` returns the canonical full-IRI JSON-LD-compatible record, TOM UI fields are isolated in `createOntologySettingsViewFromMetadataRecord`, TOM stores ontology metadata settings under `okea:OntologyMetadataProfile`, TOM RDF export appends ontology metadata through the shared writer, and Table-Nova generated TBox/combined outputs use shared metadata records.|TOM still has UI adapter fields, but those are DOM-view fields rather than durable data-property definitions.|Keep DOM migration separate from the promoted capability package.|Codex|2026-08-15|
|MAT-003|IRI provisioning package|5|5|Opaque/readable IRI provisioning functions are promoted; TOM row creation/backfill paths now use `buildOpaqueOntologyIri`, `buildReadableOntologyIri`, `collectUsedOpaqueOntologyIriNumbers`, `findMaxOpaqueOntologyIriNumber`, and `findNextAvailableOpaqueOntologyIriNumber`; Jest covers collision, next-number cases, and provisioning from canonical OKEA full-IRI policy values.|None for known current callers.|Adopt in future ontology authoring workflows as they appear.|Codex|2026-08-15|
|MAT-004|Ontology import target package|5|5|`deriveOntologyImportTarget` is promoted; TOM imports it directly and the local fallback was deleted; Jest covers versionIRI-preferred and ontology-IRI fallback behavior.|None for known current callers.|Adopt in other ontology import workflows when found.|Codex|2026-08-10|
|MAT-005|OKEA metadata predicates|5|5|Repository, issue tracker, ontology download, QA report URL, generation run identifier, and generating software application name predicates are represented in OKEA and registered in namespace-registry. The shared metadata normalizer/writer preserves these full-IRI keys.|None for this milestone.|Future metadata fields should be added to OKEA only when DCTERMS/RDFS/SKOS/OWL do not already cover them.|Codex|2026-08-10|
|MAT-006|Generated ontology metadata composition|5|5|Table-Nova now auto-composes ontology metadata for TBox and combined RDF outputs with `buildTableNovaOntologyMetadataRecord`, `buildOntologyDataset(..., { metadataRecord })`, and shared metadata writers. ABox-only output remains unchanged. Jest covers privacy-safe filename source, MIME `dcterms:format`, generator/run provenance, and ontology IRI/version IRI generation.|Manual browser validation remains useful for export UX, but package behavior is tested.|Apply the same generated-ontology metadata pattern to later Table-Nova feature work and similar converter apps.|Codex|2026-08-10|

## Promotion Checklist

- [x] Function name describes the action, not the source app or one current use case.
- [x] Inputs and outputs are explicit and documented.
- [x] Core logic is pure or mostly pure.
- [x] DOM, storage, file, download, and vendor side effects are behind adapters.
- [x] Error and warning behavior is predictable.
- [x] Representative fixtures exist.
- [x] Jest tests cover happy paths, edge cases, and known invalid inputs.
- [x] Browser, worker, and Node assumptions are documented.
- [x] Dependency and vendor provenance is documented.

## Notes

- Initial package promotion is complete for the current milestone. OntoEagle, TOM, Table-Nova, and OCD are pilot consumers.
- Table-Nova is the generated-ontology writer/composition validation case: generated TBox and combined RDF include ontology declaration and metadata injection, while ABox-only output remains unchanged by default.
- TOM now follows the durable storage rule for ontology metadata settings: the setting key is `okea:OntologyMetadataProfile`, and the setting value uses full IRI keys for ontology metadata and IRI policy. The current TOM DOM still receives an adapter view with legacy field names until the UI itself is migrated.
- The 18.10 headless audit is recorded in `headless-api-audit.md`; generated settings now use the canonical full-IRI record shape, with TOM adapter fields produced only at the UI boundary.
