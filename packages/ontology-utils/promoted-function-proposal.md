# Ontology Utils Promoted Function Proposal

## Scope

This package promotes ontology-adjacent pure utilities that are currently split across apps:

- IRI token normalization and absolute IRI validation.
- Blank-node and RDF/JS term-role predicates.
- Ontology input classification before RDF parsing.
- Registered vocabulary and namespace containment checks.
- XSD datatype display, JSON Schema description, and lexical coercion.
- UUID and timestamped graph IRI generation.

It deliberately does not replace:

- `namespace-registry` for prefixes, CURIEs, or common IRI terms.
- `format-registry` for MIME type, extension, or format descriptors.
- `rdf-io` for RDF/JS term construction, quad normalization, parsing, or serialization.

## Canonical Functions

|Function|Input Domain|Output Range|Error Model|Logging|Primary Replacement|
|:---|:---|:---|:---|:---|:---|
|`normalizeIriToken(value, options)`|Unknown token from UI, RDF/SPARQL text, table cell, or stored record.|Normalized string.|Never throws for ordinary inputs.|None.|Axiolotl `normalizeIriString`, TOM `normalizeIriishToken`, tabular-io `normalizeIriCell` where exported behavior is needed.|
|`isAbsoluteIri(value, options)`|Unknown value or normalized token.|Boolean.|Never throws.|None.|Axiolotl strict `isAbsoluteIri`, OntoEagle `isNamedIri`, local regex checks.|
|`isBlankNodeId(value)`|Unknown value expected to be a blank-node identifier string.|Boolean.|Never throws.|None.|OntoEagle `isBlankId`, rdflib/RDFJS adapter blank-node string checks.|
|`normalizeNamespaceIri(value)`|Unknown namespace IRI-like value.|String.|Never throws.|None.|Visual Lynx duplicate `normalizeNamespaceIri` functions.|
|`isRdfTerm(value)`|Unknown value.|Boolean.|Never throws.|None.|Local private `isRdfTerm` checks.|
|`isBlankNodeTerm(value)`|Unknown RDF/JS term candidate.|Boolean.|Never throws.|None.|Ontology Tabulator `isBlankNode` without console logging.|
|`canUseTermAsSubject(term)`|Unknown RDF/JS term candidate.|Boolean.|Never throws.|None.|Axiolotl `canBeSubject`.|
|`canUseTermAsPredicate(term)`|Unknown RDF/JS term candidate.|Boolean.|Never throws.|None.|Axiolotl `canBePredicate`.|
|`canUseTermAsObject(term)`|Unknown RDF/JS term candidate.|Boolean.|Never throws.|None.|Axiolotl `canBeObject`.|
|`canUseTermAsGraph(term)`|Unknown RDF/JS graph term candidate or nullish default graph placeholder.|Boolean.|Never throws.|None.|Axiolotl `canBeGraph`.|
|`hasBlankNodeTermInQuad(quad)`|Unknown quad candidate.|Boolean.|Never throws; malformed inputs return false.|None.|Axiolotl `quadHasBlankNode`.|
|`classifyOntologyInput(input)`|`{ filename?, mimeType?, text? }`.|Structured classification object.|Never throws for normal inputs; warnings array records unsupported metadata.|None.|TOM `isValidOntology`, IRI Swapper `detectOntologyFormat` preflight logic.|
|`isIriInNamespace(iri, namespaceIri)`|Unknown IRI and namespace values.|Boolean.|Never throws.|None.|OCD `isInOntologyNamespace`.|
|`isRegisteredVocabularyIri(iri, options)`|Unknown IRI value, optional registry prefix include/exclude sets.|Boolean.|Never throws.|None.|OCD `isBuiltInIri` with registry-backed namespace list.|
|`getXsdDatatypeLocalName(datatypeIri)`|Unknown datatype IRI.|String local name or empty string.|Never throws.|None.|Table Nova `datatypeLocalName`.|
|`formatDatatypeIriForDisplay(datatypeIri)`|Unknown datatype IRI.|CURIE or original IRI string.|Never throws.|None.|Table Nova `formatDatatypeLabel`.|
|`describeXsdDatatypeForJsonSchema(datatypeIri)`|Unknown datatype IRI.|Frozen JSON Schema fragment.|Never throws.|None.|Table Nova `mapXsdDatatypeToJsonSchema`.|
|`coerceLexicalValueForXsdDatatype(value, datatypeIri)`|Unknown lexical value and datatype IRI.|String, number, boolean, or undefined.|Never throws.|None.|Table Nova `coerceExampleValue`.|
|`createUuid(options)`|Optional UUID source and hyphen policy.|UUID string.|Can throw only if injected source throws.|None.|Axiolotl `uuid`, `makeGuidLike`.|
|`isUuid(value)`|Unknown value.|Boolean.|Never throws.|None.|New validation utility.|
|`createTimestampedGraphIri(baseIri, options)`|Absolute base IRI, optional clock and UUID source.|Absolute graph IRI string.|Throws `TypeError` for invalid base IRI or invalid clock.|None.|Axiolotl `makeNamedGraphIRI`.|

## Deep Comparison Decisions

### IRI Validation

Axiolotl has the strongest validation behavior because it explicitly rejects CURIEs while accepting common absolute IRI schemes. The existing namespace-registry `isAbsoluteIri` is intentionally broad for prefix-map validation. The promoted ontology utility uses Axiolotl's stricter behavior by default, with `{ allowedSchemes: null }` available when a caller needs broad scheme acceptance.

### IRI Token Normalization

TOM, Axiolotl, and IRI Swapper all normalize IRI-like tokens, but they do so in different local contexts. The promoted function separates normalization from validation. It trims, removes display labels, and strips angle brackets. It does not expand CURIEs.

### RDF Term Predicates

RDF IO already owns term construction and throwing normalization. Axiolotl's inference code shows the need for non-throwing role predicates. The promoted package adds predicates only; it does not duplicate RDF IO constructors.

### Ontology Input Classification

TOM's `isValidOntology` is quick but too lossy. IRI Swapper's filename format detection is useful but should be format-registry-backed. The promoted `classifyOntologyInput` returns evidence, confidence, MIME, and warnings so callers can decide whether to block, warn, or proceed to parser validation.

### XSD Datatypes

Table Nova has the strongest current implementation. The promoted functions preserve its practical behavior: numeric and boolean lexical values can coerce; date/time values stay strings with JSON Schema format hints.

### UUID and Graph IRI Generation

Axiolotl has three variants. The promoted API keeps the required variation as options: hyphenated or compact UUIDs, injectable UUID source, injectable clock, and strict base IRI validation for graph IRIs.

## Conditional App Migration Notes

### OntoEagle

- Replace `slim-core.js` local `isNamedIri` with `isAbsoluteIri` using default strict schemes.
- Replace `isBlankId` with `isBlankNodeId`.
- Use `classifyOntologyInput` for ontology upload preflight where a boolean check is currently used.

### Tabular Ontology Maker

- Replace `tom-core-utils.js` and `tom-core.js` `isValidOntology` with an adapter over `classifyOntologyInput`.
- Replace `normalizeIriishToken` and predicate-input direct regex checks with `normalizeIriToken` plus namespace-registry CURIE expansion.
- Replace any XSD datatype utility drift with `getXsdDatatypeLocalName` and related helpers if TOM adds datatype inference.

### Axiolotl

- Replace local `isAbsoluteIri` and `normalizeIriString` duplicates with `isAbsoluteIri` and `normalizeIriToken`.
- Replace inference `quadHasBlankNode` and `canBe*` functions with RDF term predicates.
- Replace `uuid`, `makeGuidLike`, and `makeNamedGraphIRI` with `createUuid` and `createTimestampedGraphIri`.

### Ontology Compliance Diagnostic

- Replace `isBuiltInIri` with `isRegisteredVocabularyIri`, using include/exclude prefixes if compliance metrics need a narrower list.
- Replace `isInOntologyNamespace` with `isIriInNamespace`.

### Visual Lynx / Linked-Data Transformer

- Replace duplicated `normalizeNamespaceIri` functions with the promoted utility or move that final function into namespace-registry during rollout.
- Continue using RDF IO for parsing/serialization; ontology-utils should only provide classification and validation preflight.

### Ontology Tabulator

- Replace logged `isBlankNode` with `isBlankNodeTerm` where a pure predicate is sufficient.
- Keep RDF parsing and metadata extraction in current packages until the ontology metadata capability cycle.

### Table Nova

- Replace local datatype helpers in `metadataDrafts.js` with XSD datatype helpers.
- Keep app-specific schema draft assembly local; only datatype description/coercion should be shared.

### IRI Swapper

- Replace ontology filename preflight with `classifyOntologyInput`.
- Replace mapping-table IRI normalization internals with `normalizeIriToken` if/when `tabular-io` delegates to ontology-utils.

### SPARQL Pattern Visualizer

- No immediate app-local replacements beyond shared package availability. Future SPARQL capability work may use `isAbsoluteIri` and `normalizeIriToken` when inspecting parsed query terms.

## Maturity Target

The new package is at level 4 once Jest passes and docs are complete. It reaches level 5 only after all listed local duplicates are deleted and app tests prove the rewiring.
