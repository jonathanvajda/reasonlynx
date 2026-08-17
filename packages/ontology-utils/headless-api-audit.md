# Headless API Audit

## Capability Family

- **Capability family:** Ontology-related utilities
- **Date updated:** 2026-08-16

## Audit Conclusion

The `ontology-utils` package exposes a stable headless API for IRI/token validation, RDF/JS term role checks, ontology-input classification, vocabulary namespace checks, XSD datatype helpers, and UUID/timestamped graph IRI helpers.

The package has no DOM, storage, file, download, or logging side effects. UUID generation is intentionally backed by Web Crypto and throws when secure randomness is unavailable unless a deterministic test source is injected.

## Public API Groups

| API group | Representative exports | Boundary category | Side effects | Headless status |
| --- | --- | --- | --- | --- |
| IRI tokens | `normalizeIriToken`, `isAbsoluteIri`, `isBlankNodeId`, `normalizeNamespaceIri` | Pure core | None | Stable |
| RDF/JS terms | `isRdfTerm`, `isBlankNodeTerm`, `canUseTermAsSubject`, `canUseTermAsPredicate`, `canUseTermAsObject`, `canUseTermAsGraph`, `hasBlankNodeTermInQuad` | Pure core | None | Stable |
| Ontology input | `classifyOntologyInput` | Pure classifier | None | Stable |
| Namespace checks | `isIriInNamespace`, `isRegisteredVocabularyIri` | Pure core over namespace registry | None | Stable |
| XSD datatype helpers | `getXsdDatatypeLocalName`, `formatDatatypeIriForDisplay`, `describeXsdDatatypeForJsonSchema`, `coerceLexicalValueForXsdDatatype` | Pure datatype helpers | None | Stable |
| Identifiers | `createUuid`, `isUuid`, `createTimestampedGraphIri` | Secure-random and timestamp helper | Uses injected/default Web Crypto and injected/default date | Stable, test-injectable |

## Boundary Rules

- Apps should use this package instead of local IRI, blank-node, RDF term, XSD datatype, or UUID helpers.
- The package must continue to use namespace-registry terms for RDF, RDFS, OWL, SKOS, XSD, and related vocabulary IRIs.
- The package must not fall back to `Math.random()` for UUID generation.
- RDF parsing stays in `rdf-io`; ontology metadata read/write stays in `ontology-metadata`.

## Headless Coverage

Jest covers IRI token normalization, absolute IRI validation, blank node detection, RDF/JS term role checks, ontology input classification, registered namespace checks, XSD datatype display/schema/coercion, secure UUID generation, unavailable-crypto errors, and timestamped graph IRI generation.

