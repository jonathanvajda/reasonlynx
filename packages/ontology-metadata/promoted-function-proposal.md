# Ontology Metadata Promoted Function Proposal

## Scope

This capability should promote read/write utilities for ontology-level metadata and IRI provisioning. The old roadmap label, `Ontology metadata extraction`, is too narrow.

The package should support:

- Reading ontology metadata from RDF quads, JSON-LD object form, and JSON-LD `@graph` form.
- Writing ontology metadata statements back into RDF/JSON-LD-ready record shapes.
- Normalizing predicate priority across OWL, DCTERMS, DC, RDFS, SKOS, and OKEA.
- Creating version IRIs from semantic version strings or datetimes.
- Managing ontology imports as ontology IRIs or version IRIs.
- Representing base IRI and local IRI policy for opaque and human-readable local names.
- Provisioning the next local IRI for incremented opaque schemes.
- Provisioning readable local IRIs with normalized case styles.
- Injecting ontology declaration and metadata triples into generated TBox or combined RDF outputs when an app has enough run/project context to populate the metadata.

## Canonical Metadata Predicates

Use full IRIs internally. Compact keys are only for serialization.

|Metadata field|Preferred predicate|Accepted read aliases|Notes|
|:---|:---|:---|:---|
|Ontology IRI|RDF subject with `rdf:type owl:Ontology`|Named graph or explicit caller option when no ontology declaration exists.|Do not invent a local key when an IRI subject is available.|
|Version IRI|`owl:versionIRI`|None.|Value should be an IRI.|
|Imports|`owl:imports`|None.|Values may be ontology IRIs or version IRIs.|
|Title|`dcterms:title`|`dc:title`, `rdfs:label`.|Prefer language-tagged literals when available.|
|Description|`dcterms:description`|`dc:description`, `rdfs:comment`.|SKOS definitions are entity definitions, not ontology description defaults.|
|License/access rights|`dcterms:license`|`dc:license`, `dcterms:accessRights`, `dc:accessRights`, `skos:accessRights`.|License URL literals should use `xsd:anyURI` where serialized as typed literals.|
|Creator|`dcterms:creator`|`dc:creator`.|Values may be ORCID IRIs or text literals.|
|Contributor|`dcterms:contributor`|`dc:contributor`.|Values may be ORCID IRIs or text literals.|
|Created datetime|`dcterms:created`|App legacy `createdAt` / `createdAtIso` inputs during normalization.|Use `xsd:dateTime` literals. For generated ontology outputs, this should match the transformation run datetime.|
|Modified datetime|`dcterms:modified`|App legacy `modifiedAt` / `modifiedAtIso` inputs during normalization.|Use `xsd:dateTime` literals. For generated ontology outputs, default to the run datetime unless a later edit timestamp is known.|
|Source|`dcterms:source`|None.|Use a privacy-safe local filename string for browser file inputs. Do not emit full local filesystem paths.|
|Format|`dcterms:format`|None.|Use the official MIME type for the serialized export, for example `text/turtle`, not `Turtle` or `ttl`.|
|Git repository URL|`okea:has_git_repository_url`|None.|New OKEA predicate, because DCTERMS/RDFS/SKOS do not cover this precisely.|
|Issue tracker URL|`okea:has_issue_tracker_url`|None.|New OKEA predicate.|
|Ontology download URL|`okea:has_ontology_download_url`|None.|New OKEA predicate.|
|Quality assurance report URL|`okea:has_quality_assurance_report_url`|None.|New OKEA predicate.|
|Generating software application name|`okea:has_generating_software_application_name`|None.|New OKEA predicate for generated ontology artifacts.|
|Generation run identifier|`okea:has_generation_run_identifier`|None.|New OKEA predicate. Value is an `xsd:string` identifier; UUID/GUID values are valid but not required.|

## Canonical Internal Record Shape

The canonical ontology metadata record is JSON-LD-compatible but is not treated as a final serialization. Apps may convert it to RDF/JS quads for storage, indexing, or serialization.

Decisions:

- Ontology IRI is represented by `@id`. Do not duplicate the ontology IRI under `dcterms:identifier`; use `dcterms:identifier` only for an additional external/local identifier string or code.
- `@type` includes `owl:Ontology`.
- Predicate keys are full IRIs from `COMMON_NAMESPACE_IRIS`.
- Literal values are JSON-LD value objects when represented in JSON-LD-compatible shape: `{ "@value": "...", "@language": "en" }` or `{ "@value": "...", "@type": xsdIri }`.
- Creator and contributor values are arrays and may mix `{ "@id": "https://orcid.org/..." }` and `{ "@value": "Text Name" }`.
- Missing values are `null` or empty arrays internally. Writer functions must not emit triples for absent values.
- Defaults resolve in this order: project setting, user/app setting, built-in default.
- Built-in defaults may initialize app settings silently. App settings may initialize project settings silently. User changes override both.
- Setting records should use ontology-backed full IRIs for both the setting key and value keys.

Example:

```js
{
  '@id': 'https://example.org/ExampleOntology',
  '@type': [COMMON_NAMESPACE_IRIS.owl.Ontology],
  [COMMON_NAMESPACE_IRIS.owl.versionIRI]: [
    { '@id': 'https://example.org/2026-08-10/ExampleOntology' }
  ],
  [COMMON_NAMESPACE_IRIS.owl.imports]: [
    { '@id': 'https://example.org/imported/ImportedOntology' }
  ],
  [COMMON_NAMESPACE_IRIS.dcterms.created]: [
    { '@value': '2026-08-10T15:32:45.000Z', '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime }
  ],
  [COMMON_NAMESPACE_IRIS.dcterms.format]: [
    { '@value': 'text/turtle' }
  ],
  [COMMON_NAMESPACE_IRIS.dcterms.source]: [
    { '@value': 'source-file.csv' }
  ],
  [COMMON_NAMESPACE_IRIS.dcterms.title]: [
    { '@value': 'Example Ontology', '@language': 'en' }
  ],
  [COMMON_NAMESPACE_IRIS.dcterms.description]: [],
  [COMMON_NAMESPACE_IRIS.dcterms.license]: [],
  [COMMON_NAMESPACE_IRIS.dcterms.creator]: [
    { '@id': 'https://orcid.org/0000-0000-0000-0000' },
    { '@value': 'Text Creator' }
  ],
  [COMMON_NAMESPACE_IRIS.dcterms.contributor]: [],
  [COMMON_NAMESPACE_IRIS.okea.hasGitRepositoryUrl]: [],
  [COMMON_NAMESPACE_IRIS.okea.hasIssueTrackerUrl]: [],
  [COMMON_NAMESPACE_IRIS.okea.hasOntologyDownloadUrl]: [],
  [COMMON_NAMESPACE_IRIS.okea.hasQualityAssuranceReportUrl]: [],
  [COMMON_NAMESPACE_IRIS.okea.hasGeneratingSoftwareApplicationName]: [
    { '@value': 'Table-Nova' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasGenerationRunIdentifier]: [
    { '@value': 'run:table-nova:example' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasOntologyBaseIri]: [
    { '@value': 'https://example.org', '@type': COMMON_NAMESPACE_IRIS.xsd.anyURI }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasIriPolicyModeTextValue]: [
    { '@value': 'opaque' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasIriLocalNameDelimiterTextValue]: [
    { '@value': '/' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasOpaqueIriLocalNamePrefixTextValue]: [
    { '@value': 'ont' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasOpaqueIriLocalNameIntegerWidthValue]: [
    { '@value': 6, '@type': COMMON_NAMESPACE_IRIS.xsd.nonNegativeInteger }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasOpaqueIriLocalNameIntegerStartValue]: [
    { '@value': 1, '@type': COMMON_NAMESPACE_IRIS.xsd.integer }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasIriLocalNameStyleTextValue]: [
    { '@value': 'PascalCase' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasIriVersionTokenStrategyTextValue]: [
    { '@value': 'datetime' }
  ],
  [COMMON_NAMESPACE_IRIS.okea.hasIriVersionInsertionPositionTextValue]: [
    { '@value': 'infix' }
  ]
}
```

## IRI Policy Predicate Decisions

The former local TOM fields are represented by OKEA terms:

|Former local field|Canonical predicate|Expected value|
|:---|:---|:---|
|`base`|`okea:has_ontology_base_iri`|`xsd:anyURI` literal|
|`delimiter`|`okea:has_iri_local_name_delimiter_text_value`|String literal|
|`iriMode`|`okea:has_iri_policy_mode_text_value`|`opaque` or `readable`|
|`opaqueLeading`|`okea:has_opaque_iri_local_name_prefix_text_value`|String literal|
|`opaqueDigits`|`okea:has_opaque_iri_local_name_integer_width_value`|`xsd:nonNegativeInteger` literal|
|`opaqueStart`|`okea:has_opaque_iri_local_name_integer_start_value`|`xsd:integer` literal|
|`readableCase`|`okea:has_iri_local_name_style_text_value`|Case-style name string|
|version token strategy|`okea:has_iri_version_token_strategy_text_value`|`datetime` or `semantic-version`|
|version insertion position|`okea:has_iri_version_insertion_position_text_value`|`prefix`, `infix`, or `suffix`|

Default version IRI policy:

- Token strategy: `datetime`.
- Insertion position: `infix`.
- Pattern: `base/ISO-datetime/name`.
- User-configurable alternatives: semantic version token, prefix insertion, infix insertion, suffix insertion, and caller-supplied version IRI.

## Proposed Functions

### `readOntologyMetadataRecord(dataset, options)`

Reads one ontology metadata record from RDF quads or JSON-LD-like graph data.

Input:

- RDF/JS quads, shared `rdf-io` dataset shape, or JSON-LD object/array.
- Optional ontology IRI selector.
- Optional predicate profile.

Output:

- `{ ok: true, value, warnings }` where `value` uses full IRI keys and RDF literal/node value objects.
- `{ ok: false, code, message, warnings }` when no ontology can be selected.

### `readOntologyMetadataRecords(dataset, options)`

Reads all ontology declarations in a dataset. This is the OntoEagle catalog use case.

### `writeOntologyMetadataQuads(metadataRecord, options)`

Writes ontology metadata as RDF/JS quads. This is the TOM and future project-store use case.

This function must also support generated-ontology workflows such as Table-Nova:

- The caller provides an ontology IRI or an IRI policy from which one can be generated.
- The output includes `<ontologyIri> rdf:type owl:Ontology`.
- The output includes standard metadata that can be inferred from the run, project, or app profile.
- The output does not mutate the caller's ABox/TBox quads unless the caller explicitly composes the returned metadata quads into the serialized dataset.

### `appendOntologyMetadataQuads(quads, metadataRecord, options)`

Appends ontology metadata quads to an RDF/JS dataset or N3-style Store. This is the expected Table-Nova use case for TBox and combined exports when generated ontology metadata is enabled.

Input:

- Existing dataset/store with `add` or `addQuad`, such as Table-Nova generated TBox or combined ABox/TBox datasets.
- Canonical ontology metadata record.
- Optional graph target for default graph vs named graph output.

Output:

- The same dataset/store object, after mutation.
- Stable `TypeError` when the dataset does not expose `add` or `addQuad`.

### `readOntologyMetadataRecordFromQuads(dataset, options)`

Reads one canonical full-IRI metadata record from RDF/JS quads.

- Selects the ontology subject from `rdf:type owl:Ontology`.
- Allows `options.ontologyIri` when the caller already knows the subject.
- Returns full IRI keys; compact terms remain serialization-only.

### `writeOntologyMetadataJsonLd(metadataRecord, options)`

Builds JSON-LD object form from the same normalized metadata record. It should depend on `writeOntologyMetadataQuads` or share its predicate normalization logic.

### `normalizeOntologyMetadataRecord(input, options)`

Normalizes caller input into the canonical full-IRI-keyed shape. This is where DCTERMS/DC/RDFS/SKOS aliases collapse into preferred predicates.

### `buildOntologyVersionIri(ontologyIri, options)`

Builds a version IRI using semantic version or datetime policy.

### `normalizeOntologyIriPolicy(policy, options)`

Normalizes base IRI, delimiter, opaque/readable mode, local-name style, opaque prefix, digit width, and start index.

### `provisionNextOpaqueOntologyIri(existingIris, policy, options)`

Finds the next incremented local IRI under an opaque policy.

### `provisionReadableOntologyIri(label, existingIris, policy, options)`

Builds a readable local IRI from a label and case-style policy, avoiding collisions.

## Error, Warning, And Logging Model

- Pure functions do not log.
- Recoverable ambiguity returns warnings, for example multiple ontology declarations or multiple title candidates.
- Invalid ontology IRI, version IRI, URL, or IRI policy returns `ok:false` with a stable code.
- Writer functions should not silently coerce invalid IRIs into literals.

## Package Structure

Implemented initial structure:

```text
docs/app/shared/ontology-metadata/
  index.js
  jsonld-metadata.js
  rdf-metadata.js
  settings.js
  import-target.js
monorepo-staging/packages/ontology-metadata/src/
  index.js
  jsonld-metadata.js
  rdf-metadata.js
  settings.js
  import-target.js
tests/
  ontology-metadata.test.js
monorepo-staging/packages/ontology-metadata/__tests__/
  ontology-metadata.test.js
```

The package now includes the canonical full-IRI metadata record shape, RDF quad writer, dataset appender, quad reader, and explicit OKEA-backed IRI policy profile. Remaining rollout work is app adoption and deletion of remaining local duplicates.

## Conditional App Adoption

### OntoEagle

- Replace local ontology metadata predicate tables in `ontology-meta.js` with `readOntologyRecordsFromJsonLd`.
- Replace local catalog fields `git_repo_url`, `issue_tracker_url`, and `file` with full-IRI-keyed OKEA metadata internally.
- Keep display labels and table columns as UI aliases only.

### Tabular Ontology Maker

- Replace local `generateOntologySettings` metadata construction with promoted `generateOntologySettings`.
- Replace local version IRI generation with promoted deterministic settings generation.
- Replace opaque/readable IRI helpers with `buildOpaqueOntologyIri`, `buildReadableOntologyIri`, `collectUsedOpaqueOntologyIriNumbers`, `findMaxOpaqueOntologyIriNumber`, and `findNextAvailableOpaqueOntologyIriNumber`.
- Replace local import-target derivation with `deriveOntologyImportTarget`.
- Store ontology metadata settings under `okea:OntologyMetadataProfile`.
- Store the setting value as `normalizeOntologyMetadataRecord(...)`, not as a TOM-local settings blob.
- Convert the canonical stored record to a TOM UI view with `createOntologySettingsViewFromMetadataRecord(...)` until the DOM is migrated.
- Generate ontology-level RDF assertions with `writeOntologyMetadataQuads(...)`; do not maintain a TOM-local settings-to-predicate loop.
- Keep DOM modal handlers as TOM-specific adapters.

### Table Nova

- When exporting TBox RDF, generate ontology metadata quads for the TBox ontology IRI before serialization.
- When exporting combined ABox/TBox RDF, include the same ontology declaration and metadata in the combined dataset.
- Keep ABox-only exports free of ontology metadata unless the user explicitly asks to describe the dataset as an ontology.
- Populate metadata from the transformation run where possible: source file name/title, generated datetime/version IRI, creator/profile settings if available, app/run provenance, and project artifact metadata.
- Use `buildTableNovaOntologyMetadataRecord` for Table-Nova's app-specific composition and `appendOntologyMetadataQuads` for RDF materialization; do not hand-roll `<iri> rdf:type owl:Ontology` or local metadata constants.
- Current behavior: emit metadata by default for TBox/combined exports, using generated ontology IRI, datetime version IRI, source filename, MIME `dcterms:format`, and generation run/app provenance. ABox-only exports remain unchanged.
- Future supported options may include requiring an explicit ontology IRI, generating one from project settings, or providing an opt-out setting.

## Jest Coverage Needed

- Read DCTERMS, DC, RDFS, and SKOS alias predicates into preferred metadata fields.
- Preserve language-tagged literals.
- Preserve ORCID creator/contributor IRIs and text literals.
- Read and write OKEA repository/issue/download/QA URLs.
- Write `<ontologyIri> rdf:type owl:Ontology` for generated ontology metadata records.
- Append ontology metadata quads to an existing TBox dataset without changing original ABox/TBox quads.
- Write metadata to RDF quads and read it back into the canonical full-IRI JSON-LD-compatible shape.
- Preserve `dcterms:created`, `dcterms:source`, `dcterms:format`, `okea:has_generating_software_application_name`, and `okea:has_generation_run_identifier`.
- Verify `dcterms:format` uses MIME values and `dcterms:source` does not leak full local paths.
- Generate semantic-version and datetime version IRIs.
- Provision next opaque IRI from sparse existing IRIs.
- Provision readable IRIs in PascalCase, camelCase, snake_case, kebab-case, Train-Case, and COBOL-CASE.
- Return stable errors for invalid ontology IRIs, URL literals, and unsupported IRI policies.
