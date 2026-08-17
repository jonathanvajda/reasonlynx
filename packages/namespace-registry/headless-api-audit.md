# Namespace Registry Headless API Audit

Date: 2026-08-15

Milestone: 18.3 Namespace prefix registry headless API audit and contract stabilization.

## Contract Decision

`namespace-registry` is the canonical headless source for common namespace facts, generated full-IRI maps, prefix-map normalization, CURIE expansion/compaction, prefix extraction from RDF text syntaxes, serializer prefix preparation, and namespace-stem discovery.

The package has two API tiers:

- Pure core APIs: deterministic functions with no environment side effects.
- Explicit adapter-boundary APIs: functions that call an injected storage adapter or mutate an injected vendor object. These are public because they standardize integration boundaries, but they are not pure core.

The package must not read browser globals, localStorage, IndexedDB, File System Access handles, DOM controls, app globals, or network resources.

## Public API

| Function or export | Contract | Boundary | Failure model |
| --- | --- | --- | --- |
| `COMMON_NAMESPACE_REGISTRY` | Immutable namespace registry entries and registered local IDs. | Pure core | Not applicable. |
| `COMMON_NAMESPACE_IRIS` | Generated full-IRI map from registry IDs. | Pure core | Not applicable. |
| `namespaceIriMapFromRegistry(registry)` | Generate full-IRI maps from registry entries. | Pure core | Empty maps for empty registry. |
| `namespacePrefixMapFromRegistry(registry)` | Generate prefix-to-namespace map. | Pure core | Empty map for empty registry. |
| `namespaceToPrefixMap(prefixes)` | Generate namespace-to-prefix reverse map. | Pure core | Empty map for empty input. |
| `iriForNamespaceId(registryKey, idKey, registry)` | Build a full IRI from a registered namespace/id pair. | Pure core | Structured unknown namespace/id result. |
| `curieForNamespaceId(registryKey, idKey, registry)` | Build a CURIE from a registered namespace/id pair. | Pure core | Structured unknown namespace/id result. |
| `isAbsoluteIri(value)` | Lightweight absolute IRI predicate. | Pure core | Boolean false. |
| `isValidPrefixName(prefix)` | Prefix-label predicate. | Pure core | Boolean false. |
| `normalizePrefixMap(prefixes)` | Normalize and validate prefix maps. | Pure core | Skips invalid entries with warnings. |
| `mergeProjectPrefixes(...prefixMaps)` | Merge normalized prefix maps in increasing precedence order. | Pure core | Accumulates warnings. |
| `saveProjectPrefixes(storageAdapter, projectId, prefixes)` | Normalize prefixes and persist through an injected adapter. | Explicit storage adapter | Throws only for missing adapter or adapter failure. |
| `findLongestPrefixMatch(iri, prefixes)` | Find longest namespace match. | Pure core | Structured unknown namespace result. |
| `compactIriToCurie(iri, prefixes)` | Strict CURIE compaction. | Pure core | Structured invalid/unknown/local-name result. |
| `expandCurieToIri(curie, prefixes, options)` | CURIE expansion. | Pure core | Structured invalid/empty/unknown-prefix result. |
| `formatIriForDisplay(iri, prefixes)` | CURIE-first display fallback. | Pure core/display helper | Empty string or local/original fallback. |
| `extractTurtlePrefixDeclarations(text)` | Extract Turtle/SPARQL-style prefix declarations. | Pure syntax adapter | Empty map. |
| `extractXmlNamespacePrefixes(text)` | Extract XML namespace declarations with regex. | Pure syntax adapter | Empty map. |
| `extractJsonLdContextPrefixes(text)` | Extract simple JSON-LD object context prefixes. | Pure syntax adapter | Structured invalid JSON-LD result or warnings. |
| `extractRdfPrefixesFromText(text, options)` | Route text prefix extraction by MIME or injected N3 parser. | Syntax/vendor adapter boundary | Structured parser or invalid JSON-LD result. |
| `createN3WriterOptionsWithPrefixes(options)` | Normalize prefixes into N3 writer options. | Pure adapter-prep | Warnings for invalid prefixes. |
| `selectPrefixesUsedByRdfTerms(prefixes, dataset)` | Select only prefixes used by RDF terms in a dataset-like value. | Pure core | Empty map for empty dataset. |
| `applyPrefixesToRdflibStore(store, prefixes)` | Apply prefixes to an injected rdflib-like store. | Explicit vendor adapter | Structured unsupported target result. |
| `deriveNamespaceStemFromIri(iri)` | Derive hash/slash namespace stem. | Pure core | Structured invalid IRI result. |
| `listNamespaceStemsInStore(store)` | List stems from RDF dataset-like values. | Pure core over explicit data | Empty list for empty/missing store. |
| `discoverBaseIriOrNamespaceStem(options)` | Discover base IRI from explicit inputs. | Pure core | Structured base-not-found result. |

## Stabilization Decision

`curieForNamespaceId()` was added as the canonical way to build a CURIE from a registered term. This replaces downstream local helpers such as `curieForRegisteredTerm()` and keeps compact keys limited to display/serialization use. Durable internal JSON-LD and data records should continue to use full IRIs.

## Runtime Boundary

- Node safe: yes.
- Browser safe: yes.
- Worker safe: yes.
- Requires DOM: no.
- Requires localStorage, IndexedDB, FSA, OPFS, network, or app globals: no.
- Vendor use: only through explicit injected parser/store objects.
- Logging: no.

## Interface Matrix

| Capability | JS API | Browser | CLI | CI | Agent/Tool | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Parse/inspect | Yes | Via adapters | Not yet | Via Jest | Not yet | Prefix extraction and namespace-stem discovery are headless. |
| Validate | Yes | Via adapters | Not yet | Via Jest | Not yet | Prefix maps and CURIEs return structured failures/warnings. |
| Convert/transform | Yes | Via adapters | Not yet | Via Jest | Not yet | Full IRI, CURIE, prefix maps, and reverse maps. |
| Serialize/export | Partial | Via RDF/browser adapters | Not yet | Via Jest | Not yet | Prepares serializer prefix data; does not serialize RDF itself. |
| Diagnostics/report | Result objects | Via adapters | Not yet | Via Jest | Not yet | Expected failures use structured result objects; invalid prefix entries are warnings. |

## Test Coverage

`__tests__/namespace-registry.test.js` covers:

- Immutable registry facts and generated full-IRI maps.
- Common RDF/RDFS/OWL/SKOS/XSD/DCTERMS/DC/BFO/IAO/CCEO/CCO2/OKEA IDs.
- Full IRI and CURIE lookup for registered namespace IDs.
- Prefix map normalization, warnings, merge precedence, and injected storage adapter persistence.
- Turtle, XML namespace, JSON-LD context, and injected N3 parser prefix extraction.
- Longest-prefix CURIE compaction and structured expansion failures.
- N3 writer option preparation, rdflib prefix application, and unsupported vendor target result.
- Prefix selection from RDF terms and namespace-stem discovery.

Command run:

```powershell
npm test
```

from `monorepo-staging/packages/namespace-registry`.

Result: 11 tests passed.
