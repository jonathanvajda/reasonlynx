# Future Milestone: JSON-LD Vocabulary Catalogs

## Purpose

The current namespace registry should remain the authority for canonical prefixes and namespace IRIs. A future milestone should add generated vocabulary catalogs so shared code can discover known classes, object properties, datatype properties, annotation properties, datatypes, labels, comments, and selected axioms from source vocabulary data instead of hand-maintained JavaScript term lists.

This milestone supports the DRY data-model constraint: JavaScript should not locally define ontology terms, RDF vocabulary terms, or data properties when those terms are already defined in RDF, OWL, SKOS, XSD, DCTERMS, CCO, IAO, OKEA, or another promoted vocabulary source.

## Design Decision

Do not replace the namespace registry.

Use two layers:

1. `namespace-registry`
   - Owns prefix-to-namespace mappings.
   - Owns namespace-to-prefix mappings.
   - Supports CURIE expansion and compaction.
   - Remains small, synchronous, and safe for hot paths.

2. `vocabulary-catalog`
   - Owns known terms inside registered namespaces.
   - Is generated from JSON-LD/RDF source vocabularies where practical.
   - Supports term lookup, type lookup, labels, comments, domain/range metadata, and validation hints.
   - May be loaded lazily when full vocabulary detail is needed.

## Recommended File Structure

```text
packages/
  namespace-registry/
    src/
      namespace-registry.js
      curie.js
      vocabulary-catalog.js
      vocabulary-loader.js
      generated/
        rdf-terms.js
        rdfs-terms.js
        owl-terms.js
        skos-terms.js
        xsd-terms.js
        dcterms-terms.js
        iao-terms.js
        cceo-terms.js
        cco2-terms.js
        okea-terms.js
    vocabularies/
      source/
        rdf.jsonld
        rdfs.jsonld
        owl.jsonld
        skos.jsonld
        xsd.jsonld
        dcterms.jsonld
        iao.jsonld
        cceo.jsonld
        cco2.jsonld
        okea.jsonld
      README.md
    scripts/
      generate-vocabulary-catalog.js
    __tests__/
      vocabulary-catalog.test.js
      vocabulary-generation.test.js
```

The runtime mirror should keep generated files under:

```text
docs/app/shared/namespace-registry/
  vocabulary-catalog.js
  vocabulary-loader.js
  generated/
    *.js
  vocabularies/
    source/
      *.jsonld
```

## Source Vocabulary Rules

Source vocabularies should be checked in as JSON-LD when licensing and provenance allow it. If the upstream source is Turtle, RDF/XML, or another RDF serialization, generate JSON-LD from the source and document the source URL, retrieval date, and conversion command.

Each source vocabulary entry should document:

- vocabulary name
- canonical namespace IRI
- canonical prefix
- source URL or local source path
- license/provenance
- retrieval or generation date
- conversion tool and version
- whether the file is authoritative upstream data, curated local data, or generated local data

OKE A should define only terms not already covered by DCTERMS, SKOS, RDF, RDFS, OWL, XSD, BFO, CCO, or IAO.

## Generated Term Shape

Generated catalogs should use full IRIs as identifiers. Compact keys are serialization concerns, not the canonical in-memory representation.

Recommended generated shape:

```js
export const XSD_VOCABULARY_TERMS = Object.freeze({
  'http://www.w3.org/2001/XMLSchema#string': Object.freeze({
    iri: 'http://www.w3.org/2001/XMLSchema#string',
    prefix: 'xsd',
    localName: 'string',
    termKind: 'datatype',
    label: 'string',
    comment: ''
  })
});
```

Allowed `termKind` values:

- `class`
- `objectProperty`
- `datatypeProperty`
- `annotationProperty`
- `rdfProperty`
- `datatype`
- `individual`
- `ontology`
- `unknown`

Where source data supports it, generated term records may include:

- `rdfs:label`
- `rdfs:comment`
- `rdfs:domain`
- `rdfs:range`
- `rdfs:subClassOf`
- `rdfs:subPropertyOf`
- `owl:equivalentClass`
- `owl:equivalentProperty`
- `owl:deprecated`
- `skos:definition`
- `dcterms:description`
- `dcterms:source`

These metadata fields should use full IRI keys from `COMMON_NAMESPACE_IRIS`, not local constants or compact keys.

## Proposed APIs

Names should remain action-oriented and contract-oriented.

```js
listRegisteredVocabularyTerms(options)
getVocabularyTermDescriptor(iri, options)
hasRegisteredVocabularyTerm(iri, options)
classifyRegisteredVocabularyTerm(iri, options)
listVocabularyTermsByKind(termKind, options)
listVocabularyTermsForNamespace(namespaceKey, options)
getVocabularyTermAnnotation(iri, predicateIri, options)
createCommonIriMapFromVocabularyCatalog(options)
```

These APIs should return structured result objects where failure is expected:

```js
{ ok: true, value }
{ ok: false, error, input }
```

Throw only for programmer errors such as invalid options or malformed catalog data.

## Consumption Rules

Application and shared-package code should follow this order:

1. Use `COMMON_NAMESPACE_IRIS.<prefix>.<id>` for hot-path known terms that are part of the generated common IRI map.
2. Use `getVocabularyTermDescriptor(iri)` when term metadata is needed.
3. Use `classifyRegisteredVocabularyTerm(iri)` when behavior depends on whether a term is a class, property, datatype, etc.
4. Use `compactIriToCurie()` only for display or serialization.
5. Do not define local constants that simply rename registered IRIs.
6. Do not define app-local JSON properties when an RDF vocabulary term already exists.

Example preferred use:

```js
if (predicateIri === COMMON_NAMESPACE_IRIS.rdfs.label) {
  // ...
}
```

Example discouraged use:

```js
const RDFS_LABEL = COMMON_NAMESPACE_IRIS.rdfs.label;
```

Example vocabulary metadata use:

```js
const descriptor = getVocabularyTermDescriptor(COMMON_NAMESPACE_IRIS.skos.prefLabel);
if (descriptor.ok && descriptor.value.termKind === 'annotationProperty') {
  // ...
}
```

## Generation Workflow

The generation script should:

1. Read the namespace registry.
2. Read source JSON-LD vocabulary files.
3. Parse JSON-LD into RDF terms/quads using the shared RDF IO adapter layer.
4. Extract term subjects from known declaration patterns.
5. Classify terms by RDF/OWL type.
6. Extract labels, comments, definitions, domains, ranges, deprecation markers, and selected hierarchy axioms.
7. Emit frozen JavaScript modules under `src/generated/`.
8. Emit a generation report with counts and warnings.
9. Fail on namespace mismatches, duplicate conflicting term definitions, or malformed source files.

The generator should not silently invent terms. Unknown terms discovered in local code should be either:

- added to the relevant source vocabulary,
- added to OKEA if genuinely uncovered,
- or documented as app-local data that should not be promoted.

## Testing Requirements

Jest coverage should include:

- RDF, RDFS, OWL, SKOS, XSD, DCTERMS representative term lookup.
- XSD datatype lookup for string, boolean, decimal, float, double, integer, int, unsignedByte, date, dateTime, time, and anyURI.
- Class/property/datatype classification.
- Label/comment extraction where the source vocabulary provides it.
- Domain/range extraction where the source vocabulary provides it.
- Unknown IRI behavior.
- Prefix mismatch behavior.
- Generated `COMMON_NAMESPACE_IRIS` compatibility with current registry expectations.
- No local duplicate term list regression for common vocabulary families.

Regression tests should specifically protect against reintroducing arrays such as local XSD datatype name lists when the same terms are already represented by registry-derived IRIs.

## Migration Strategy

This should be a future milestone after the ontology-utils cycle is stable.

Recommended phases:

1. Add source vocabulary files and provenance documentation.
2. Build the generator without changing consumers.
3. Generate catalogs and compare against existing `COMMON_NAMESPACE_IRIS`.
4. Replace hand-maintained namespace `ids` where generation is reliable.
5. Update ontology-utils to use vocabulary classification where appropriate.
6. Sweep app-local constants again and remove any terms now covered by the vocabulary catalog.
7. Mirror shared package files across all repos.
8. Run all Jest/check suites.
9. Update maturity documentation for namespace and ontology-utils packages.

## Non-Goals

This milestone should not:

- Parse full ontology imports at app startup.
- Make hot-path prefix expansion depend on async vocabulary loading.
- Replace app project data with vocabulary source files.
- Use compact JSON-LD keys as canonical in-memory keys.
- Add OKEA terms where DCTERMS, SKOS, RDF, RDFS, OWL, XSD, BFO, CCO, or IAO already provide the term.

## Open Questions

- Which vocabularies should be bundled as authoritative source files versus generated summaries only?
- Should generated term catalogs be shipped as JS only, JSON-LD only, or both?
- Should large vocabularies such as CCO be lazy-loaded separately from small W3C vocabularies?
- Should OKEA source live in this package as a mirrored vendor/source copy, or should this package consume it from the OntoAlign ontology repository during generation?
- Should term classification prefer asserted OWL types only, or use fallback heuristics for vocabularies that are underspecified?
