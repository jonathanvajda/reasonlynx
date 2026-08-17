# Namespace Registry Promoted Function Proposal

## Purpose

This note records the proposed mature JavaScript functions for the namespace-prefix capability after comparing naming, domains, ranges, error handling, logging, side effects, dependencies, and app migration pressure. It intentionally does not modify `inventory.md`; that file remains the survey ledger.

The strongest direction is a small package surface, not one Frankenstein utility. Registry data, prefix extraction, prefix merging, CURIE conversion, serialization adapters, SPARQL formatting, and namespace-stem discovery have different contracts and should stay separate.

## Proposed Canonical Functions

|Function|Domain|Range|Error and warning model|Side effects|Promotion status|
|:---|:---|:---|:---|:---|:---|
|`COMMON_NAMESPACE_REGISTRY`|No input.|Frozen registry entries with `prefix`, `namespaceIri`, and stable `ids`.|No runtime errors; validated by tests.|None.|Package ready as immutable data.|
|`namespacePrefixMapFromRegistry(registry)`|Registry object keyed by stable entry name.|Frozen prefix-to-namespace map.|No throws for ordinary use.|None.|Package ready.|
|`namespaceToPrefixMap(prefixes)`|Prefix-to-namespace map.|Frozen namespace-to-prefix map.|No throws for ordinary use.|None.|Package ready.|
|`iriForNamespaceId(registryKey, idKey, registry)`|Registry key and local ID key.|`{ ok: true, value }` or structured unknown result.|Unknown namespace and unknown ID return result errors.|None.|Package ready after expanded ID coverage.|
|`normalizePrefixMap(prefixes)`|User, file, project, or app prefix map-like object.|`{ ok: true, prefixes, warnings }`.|Invalid entries are skipped with warnings.|None.|Package ready.|
|`mergeProjectPrefixes(...prefixMaps)`|Prefix maps in increasing precedence order.|`{ ok: true, prefixes, warnings }`.|Invalid entries are accumulated as warnings.|None.|Package ready.|
|`saveProjectPrefixes(storageAdapter, projectId, prefixes)`|Explicit storage adapter plus prefix map.|Promise resolving normalized prefix result.|Throws only for missing adapter or adapter persistence failure.|Storage adapter only.|Reusable adapter boundary.|
|`extractRdfPrefixesFromText(text, options)`|RDF text plus MIME/parser options.|Prefix result with `source` evidence.|Parser/JSON failures can return `ok: false`; unsupported syntax warns.|None unless injected parser does work.|Reusable adapter selector.|
|`extractSparqlPrefixesFromText(queryText)`|SPARQL query or update text.|Prefix result plus `baseIri`.|No throws for ordinary text; warnings for ambiguous prologue facts.|None.|Package ready for prologue extraction.|
|`formatSparqlPrefixDeclarations(prefixes)`|Prefix map.|Sorted SPARQL `PREFIX` declaration string.|Invalid prefix entries become warnings.|None.|Package ready.|
|`prependSparqlPrefixes(queryText, prefixes, options)`|SPARQL body, prefix map, optional base IRI.|SPARQL text with prologue.|Invalid prefix entries become warnings.|None.|Package ready; no prologue replacement.|
|`findLongestPrefixMatch(iri, prefixes)`|Absolute IRI and prefix map.|Best matching prefix result or unknown namespace result.|Invalid/unknown behavior is explicit.|None.|Package ready.|
|`compactIriToCurie(iri, prefixes)`|Absolute IRI and prefix map.|Strict CURIE result with prefix, namespace, local name.|Invalid IRI, unknown namespace, invalid local name return result errors.|None.|Package ready.|
|`expandCurieToIri(curie, prefixes, options)`|CURIE token and prefix map.|IRI result with prefix, namespace, local name.|Invalid CURIE, empty local, unknown prefix return result errors.|None.|Package ready.|
|`deriveNamespaceStemFromIri(iri)`|Absolute IRI.|Namespace stem result with source evidence.|Invalid IRI or missing stem return result errors.|None.|Package ready.|
|`listNamespaceStemsInStore(store)`|RDF/JS-like store with `getQuads`.|Sorted namespace stem array result.|Non-named terms are ignored.|Reads store only.|Package ready as RDF/JS helper.|
|`discoverBaseIriOrNamespaceStem(input)`|Ontology IRI, base IRI, RDF text, SPARQL text, or store summary.|Best namespace/base result with source evidence.|Unusable input returns structured result errors.|Reads passed input only.|Reusable after pilot fixtures.|

## Registry Coverage Decision

`COMMON_NAMESPACE_REGISTRY` should remain fairly extensive for stable vocabularies. OWL, SKOS, XSD, RDF, RDFS, and DCTERMS terms are slow-changing standards, and pre-processed local IDs reduce repeated hard-coded fragments in ontology tooling, tabular ontology generation, RDF export, SPARQL helpers, and compliance reporting.

Stable portfolio-wide namespaces belong in the common registry even when one app surfaced them first. OBO, BFO, IAO, CCO/CCEO/CCO2, FOAF, PROV, DCAT, Geo, GeoJSON, and vCard are promoted registry facts. Truly app-local namespaces such as OKEA, Table Nova placeholders, project IRIs, and customer prefixes should extend the canonical prefix map through `mergeProjectPrefixes(namespacePrefixMapFromRegistry(), appPrefixes, projectPrefixes)`.

## Candidate Synthesis

|Capability|Best candidate traits retained|Traits rejected|
|:---|:---|:---|
|Common registry|OntoEagle immutability, Ontology Tabulator test-used namespace constants, Table Nova extension pattern.|Mutable globals, reverse maps as source of truth, SPARQL declaration strings as registry data.|
|Prefix merging|TOM and Axiolotl user/project prefix needs.|DOM alerts, localStorage reads, global mutation in core helpers.|
|RDF prefix extraction|OCM runtime injection and N3 callback prefix capture; Visual Lynx and IRI Swapper syntax fallbacks.|Direct `window.N3` coupling, private parser fields as only path, logging in core.|
|SPARQL prefix extraction|IRI Swapper prologue parsing.|Blending token replacement and prologue extraction into one function.|
|CURIE compaction|Axiolotl and Visual Lynx longest-prefix behavior; Visual Lynx local-name validation.|Display local-name fallback inside strict CURIE compaction.|
|CURIE expansion|TOM and IRI Swapper simple expansion behavior.|Returning empty strings/nulls for unknown prefixes in shared core.|
|Serialization prefix use|OCM and Table Nova prefix pass-through patterns; IRI Swapper rdflib binding.|Vendor mutation hidden in generic pure functions.|
|Namespace discovery|OntoEagle `computeNamespace` simplicity and OCM store scanning.|Implicit fallback logic without source evidence.|

## Naming and Contract Notes

- Names should stay action-oriented: `compactIriToCurie`, `expandCurieToIri`, `extractSparqlPrefixesFromText`, `deriveNamespaceStemFromIri`.
- Domains should always be explicit. Functions receive `prefixes`, registry data, text, adapters, or stores as parameters instead of reading app globals.
- Ranges should use frozen plain objects and structured `{ ok, ... }` result shapes where the caller needs to handle invalid input.
- Logging belongs at app boundaries. Shared functions return errors and warnings; UI adapters decide whether to show toasts, console logs, modals, or validation messages.
- Browser, DOM, IndexedDB, File System Access, OPFS, and localStorage assumptions stay outside core functions.

## App Adoption Changes

|App|Change if promoted package is adopted|
|:---|:---|
|OntoEagle Semantic Lookup / Bundler|Replace local common prefix constants with `namespacePrefixMapFromRegistry()`. Replace `shortIri` strict cases with `compactIriToCurie`; keep a tiny display fallback wrapper for search result labels. Replace namespace splitting with `deriveNamespaceStemFromIri`.|
|Ontology Tabulator|Replace `NS` and hand-maintained reverse lookup with registry-derived maps. Keep tabulator-specific display labels local, but drive CURIE expansion/compaction from shared helpers. Remove pure-helper logging; log only at UI/caller boundaries.|
|Visual Lynx / Linked-Data Transformer|Use `extractRdfPrefixesFromText` for RDF source prefixes and `createN3WriterOptionsWithPrefixes` / rdflib adapter helpers for serialization prefix injection. Replace internal longest-prefix compaction helpers with `compactIriToCurie`; retain graph display adapters for non-CURIE labels.|
|Competency Question Ferret / Term Extractor|Use `namespacePrefixMapFromRegistry()` plus project prefixes when exporting JSON-LD/RDF-ish metadata. Use DCTERMS IDs from `iriForNamespaceId` for project metadata fields such as title, description, creator, created, modified, and license.|
|Mermaid Diagram Builder|No heavy namespace core dependency unless RDF/SPARQL metadata is added. If project metadata is serialized, use registry-derived DCTERMS IRIs and keep Mermaid syntax handling app-local.|
|Tabular Ontology Maker|Replace mutable `iriPrefixes` as shared truth with merged common, app, and project prefix maps. Route `iriToCurie` and `curieToIri` through `compactIriToCurie` and `expandCurieToIri`. Keep prefix editing UI as an adapter that calls `normalizePrefixMap` before saving.|
|Table Nova|Extend the common registry with Table Nova-specific prefixes in app code. Replace local `compactIri` where strict CURIE behavior is desired; keep Turtle formatter wrappers for `<IRI>` fallback. Use XSD IDs from the expanded registry for datatype handling.|
|SPARQL Pattern Visualizer|Replace visualizer-local longest-prefix compaction with `compactIriToCurie`. Keep Cytoscape node/edge model generation app-local.|
|Axiolotl SPARQL & Inference|Store active prefix choices as keys, but derive declaration text with `formatSparqlPrefixDeclarations` and `prependSparqlPrefixes`. Replace `bestPrefixForIri` with `findLongestPrefixMatch`. Keep query execution, inference, and localStorage adapters outside the package.|
|Ontology Compliance Diagnostic|Use expanded OWL, SKOS, XSD, and DCTERMS IDs for annotation, metadata, datatype, and report checks. Keep compliance rule definitions app-local, but build IRIs through `iriForNamespaceId` to avoid duplicate fragments.|
|Myna RDF IRI Swapper|Use RDF prefix extraction helpers for source ontology prefixes, `mergeProjectPrefixes` for mapping/session prefixes, and shared CURIE expansion/compaction for validation/display. Keep RDF parsing, replacement, and serialization workflows in RDF IO packages.|
|Myna SPARQL IRI Swapper|Use `extractSparqlPrefixesFromText` and `expandCurieToIri` in the SPARQL rewrite engine. Keep token scanning/rewrite behavior app-local until SPARQL utilities become their own promoted capability.|

## Required Follow-Up Fixtures

- Registry fixtures for representative OWL, SKOS, XSD, DCTERMS, RDF, and RDFS IDs.
- Syntax fixtures for Turtle, TriG, RDF/XML, JSON-LD, SPARQL query, and SPARQL update prefix extraction.
- Migration fixtures for strict CURIE behavior versus display fallback behavior.
- Adapter fixtures for N3 writer options and rdflib prefix binding.

## Maturity Recommendation

The namespace registry package should be rated `4 - Package ready` for immutable registry data, prefix-map normalization/merging, strict CURIE compaction/expansion, SPARQL prologue formatting, and namespace-stem helpers after the expanded registry tests pass. It should not be rated `5 - Canonical` until pilot apps adopt it and local duplicates are removed.
